import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional

from app.database import supabase
from app.models.investment import (
    InvestmentResponse,
    InvestmentHistoryResponse,
    PortfolioResponse,
    PortfolioHolding,
)
from app.services.price_service import get_supported_assets, get_prices_by_type, get_price, ASSET_TYPE_CRYPTO, ASSET_TYPE_STOCK
from app.services.investment_execution import execute_simulated_buy
from app.services.stock_service import search_stocks
from app.config import get_settings
from app.utils.security import get_current_user

settings = get_settings()
router = APIRouter()


class ExecuteInvestmentRequest(BaseModel):
    amount: Optional[float] = None
    asset: Optional[str] = None
    asset_type: Optional[str] = None  # "crypto" | "stock"; inferred from asset if omitted


class SellRequest(BaseModel):
    asset: str
    asset_type: str  # "crypto" | "stock"


@router.get("/supported")
async def supported_assets():
    """Return Solana crypto (meme coins) and suggested stocks. Stocks: use /stocks/search for any ticker."""
    return get_supported_assets()


@router.get("/stocks/search")
async def stocks_search(q: str = "", limit: int = 15):
    """Search stocks by symbol or company name. Returns list of { symbol, name, price }."""
    if not (q or "").strip():
        return {"results": []}
    results = await search_stocks(q.strip(), limit=max(1, min(limit, 25)))
    return {"results": results}


@router.post("/execute", response_model=InvestmentResponse)
async def execute_investment(
    data: ExecuteInvestmentRequest | None = None,
    current_user: dict = Depends(get_current_user),
):
    """Simulate a buy using savings pool; uses real APIs for prices."""
    user_id = current_user["id"]
    savings_pool = current_user.get("savings_pool", 0.0) or 0.0

    invest_amount = (data.amount if data and data.amount else None) or savings_pool
    if invest_amount > savings_pool:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient savings pool. Available: ${savings_pool:.2f}",
        )
    if invest_amount < 1.0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Minimum investment is $1.00. Current pool: ${savings_pool:.2f}",
        )

    assets = get_supported_assets()
    asset = (
        (data.asset.upper() if data and data.asset else None)
        or current_user.get("preferred_asset")
        or settings.DEFAULT_ASSET
    )
    asset_type = (data.asset_type or "").lower() or None
    if asset_type and asset_type not in (ASSET_TYPE_CRYPTO, ASSET_TYPE_STOCK):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="asset_type must be 'crypto' or 'stock'.",
        )
    if not asset_type:
        if asset in assets["crypto"]:
            asset_type = ASSET_TYPE_CRYPTO
        else:
            asset_type = ASSET_TYPE_STOCK
    if asset_type == ASSET_TYPE_CRYPTO and asset not in assets["crypto"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported crypto: {asset}. Solana options: {assets['crypto']}.",
        )

    try:
        result = await execute_simulated_buy(asset, invest_amount, asset_type)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        msg = str(e) if str(e) else "Price unavailable. Try again in a moment."
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Price fetch failed: {msg}",
        )

    now = datetime.now(timezone.utc).isoformat()
    row = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "asset": result["symbol"],
        "amount_invested": result["amount_usd"],
        "shares": result["shares"],
        "price_at_purchase": result["price"],
        "status": result["status"],
        "asset_type": result["asset_type"],
        "created_at": now,
    }

    supabase.table("investments").insert(row).execute()

    new_pool = savings_pool - invest_amount
    supabase.table("users").update({"savings_pool": new_pool}).eq("id", user_id).execute()

    return InvestmentResponse(**row)


@router.post("/sell")
async def sell_holding(
    data: SellRequest,
    current_user: dict = Depends(get_current_user),
):
    """Sell entire position for an asset. Proceeds go back to savings pool; balance updates automatically."""
    user_id = current_user["id"]
    savings_pool = float(current_user.get("savings_pool") or 0.0)
    asset = (data.asset or "").strip().upper()
    asset_type = (data.asset_type or "").lower()
    if asset_type not in (ASSET_TYPE_CRYPTO, ASSET_TYPE_STOCK):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="asset_type must be 'crypto' or 'stock'.")
    if not asset:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="asset is required.")

    rows = (
        supabase.table("investments")
        .select("id, shares, amount_invested")
        .eq("user_id", user_id)
        .eq("asset", asset)
        .eq("status", "filled")
        .execute()
    ).data or []

    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No position found for {asset}.",
        )

    total_shares = sum(float(r.get("shares") or 0) for r in rows)
    total_cost = sum(float(r.get("amount_invested") or 0) for r in rows)
    if total_shares <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Position has no shares.")

    try:
        price = await get_price(asset, asset_type)
    except Exception:
        price = total_cost / total_shares

    proceeds = total_shares * price
    new_pool = savings_pool + proceeds

    for r in rows:
        supabase.table("investments").delete().eq("id", r["id"]).execute()

    supabase.table("users").update({"savings_pool": new_pool}).eq("id", user_id).execute()

    return {
        "asset": asset,
        "asset_type": asset_type,
        "shares_sold": total_shares,
        "price": price,
        "proceeds": proceeds,
        "savings_pool": new_pool,
    }


@router.get("/portfolio", response_model=PortfolioResponse)
async def get_portfolio(current_user: dict = Depends(get_current_user)):
    """Aggregate holdings and attach live prices (crypto + stocks)."""
    user_id = current_user["id"]

    result = (
        supabase.table("investments")
        .select("*")
        .eq("user_id", user_id)
        .eq("status", "filled")
        .execute()
    )
    rows = result.data or []

    # Aggregate by (asset, asset_type); default asset_type to crypto for legacy rows
    agg: dict[tuple[str, str], dict] = {}
    for r in rows:
        sym = r["asset"]
        atype = (r.get("asset_type") or "crypto").lower()
        if atype not in (ASSET_TYPE_CRYPTO, ASSET_TYPE_STOCK):
            atype = ASSET_TYPE_CRYPTO
        key = (sym, atype)
        if key not in agg:
            agg[key] = {"qty": 0.0, "cost": 0.0}
        agg[key]["qty"] += r.get("shares") or 0.0
        agg[key]["cost"] += r.get("amount_invested") or 0.0

    if not agg:
        return PortfolioResponse(
            holdings=[],
            total_value=0.0,
            total_gain_loss=0.0,
            total_cost=0.0,
            total_gain_loss_pct=0.0,
            savings_pool=current_user.get("savings_pool", 0.0) or 0.0,
        )

    assets_with_type = [list(k) for k in agg.keys()]
    try:
        prices = await get_prices_by_type(assets_with_type)
    except Exception:
        prices = {}

    holdings: list[PortfolioHolding] = []
    total_value = 0.0
    total_gl = 0.0
    total_cost = 0.0

    for (sym, atype), data in agg.items():
        price = prices.get(sym, 0.0)
        mv = data["qty"] * price
        cost = data["cost"]
        total_cost += cost
        avg = cost / data["qty"] if data["qty"] else 0.0
        pl = mv - cost
        plpc = pl / cost if cost else 0.0

        holdings.append(
            PortfolioHolding(
                symbol=sym,
                qty=data["qty"],
                market_value=mv,
                avg_entry_price=avg,
                current_price=price,
                unrealized_pl=pl,
                unrealized_plpc=plpc,
                asset_type=atype,
            )
        )
        total_value += mv
        total_gl += pl

    total_gain_loss_pct = (total_gl / total_cost * 100.0) if total_cost else 0.0

    return PortfolioResponse(
        holdings=holdings,
        total_value=total_value,
        total_gain_loss=total_gl,
        total_cost=total_cost,
        total_gain_loss_pct=total_gain_loss_pct,
        savings_pool=current_user.get("savings_pool", 0.0) or 0.0,
    )


@router.get("/history", response_model=InvestmentHistoryResponse)
async def get_investment_history(
    limit: int = 50,
    skip: int = 0,
    current_user: dict = Depends(get_current_user),
):
    """Return paginated investment history."""
    user_id = current_user["id"]

    result = (
        supabase.table("investments")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .range(skip, skip + limit - 1)
        .execute()
    )

    investments = []
    for r in result.data or []:
        if "asset_type" not in r:
            r["asset_type"] = "crypto"
        investments.append(InvestmentResponse(**r))
    total_invested = sum(r.get("amount_invested", 0) for r in result.data or [])

    return InvestmentHistoryResponse(
        investments=investments,
        total_invested=total_invested,
        count=len(investments),
    )
