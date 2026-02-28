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
from app.services.crypto_service import (
    simulate_buy,
    get_crypto_prices,
    SUPPORTED_SYMBOLS,
)
from app.config import get_settings
from app.utils.security import get_current_user

settings = get_settings()
router = APIRouter()


class ExecuteInvestmentRequest(BaseModel):
    amount: Optional[float] = None
    asset: Optional[str] = None


@router.get("/supported")
async def supported_assets():
    """Return the list of supported crypto symbols."""
    return {"assets": SUPPORTED_SYMBOLS}


@router.post("/execute", response_model=InvestmentResponse)
async def execute_investment(
    data: ExecuteInvestmentRequest | None = None,
    current_user: dict = Depends(get_current_user),
):
    """Buy crypto using savings pool funds."""
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

    asset = (
        (data.asset.upper() if data and data.asset else None)
        or current_user.get("preferred_asset")
        or settings.DEFAULT_ASSET
    )
    if asset not in SUPPORTED_SYMBOLS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported asset: {asset}. Supported: {SUPPORTED_SYMBOLS}",
        )

    try:
        result = await simulate_buy(asset, invest_amount)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Price fetch failed: {e}",
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
        "created_at": now,
    }

    supabase.table("investments").insert(row).execute()

    new_pool = savings_pool - invest_amount
    supabase.table("users").update({"savings_pool": new_pool}).eq("id", user_id).execute()

    return InvestmentResponse(**row)


@router.get("/portfolio", response_model=PortfolioResponse)
async def get_portfolio(current_user: dict = Depends(get_current_user)):
    """Aggregate holdings and attach live prices."""
    user_id = current_user["id"]

    rows = (
        supabase.table("investments")
        .select("*")
        .eq("user_id", user_id)
        .eq("status", "filled")
        .execute()
    ).data

    agg: dict[str, dict] = {}
    for r in rows:
        sym = r["asset"]
        if sym not in agg:
            agg[sym] = {"qty": 0.0, "cost": 0.0}
        agg[sym]["qty"] += r["shares"]
        agg[sym]["cost"] += r["amount_invested"]

    if not agg:
        return PortfolioResponse(
            holdings=[],
            total_value=0.0,
            total_gain_loss=0.0,
            savings_pool=current_user.get("savings_pool", 0.0) or 0.0,
        )

    try:
        prices = await get_crypto_prices(list(agg.keys()))
    except Exception:
        prices = {}

    holdings: list[PortfolioHolding] = []
    total_value = 0.0
    total_gl = 0.0

    for sym, data in agg.items():
        price = prices.get(sym, 0.0)
        mv = data["qty"] * price
        avg = data["cost"] / data["qty"] if data["qty"] else 0.0
        pl = mv - data["cost"]
        plpc = pl / data["cost"] if data["cost"] else 0.0

        holdings.append(
            PortfolioHolding(
                symbol=sym,
                qty=data["qty"],
                market_value=mv,
                avg_entry_price=avg,
                current_price=price,
                unrealized_pl=pl,
                unrealized_plpc=plpc,
            )
        )
        total_value += mv
        total_gl += pl

    return PortfolioResponse(
        holdings=holdings,
        total_value=total_value,
        total_gain_loss=total_gl,
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

    investments = [InvestmentResponse(**r) for r in result.data]
    total_invested = sum(r["amount_invested"] for r in result.data)

    return InvestmentHistoryResponse(
        investments=investments,
        total_invested=total_invested,
        count=len(investments),
    )
