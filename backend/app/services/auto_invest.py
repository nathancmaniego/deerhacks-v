"""
Auto-invest: after each transaction adds savings to the pool, use AI to pick an asset
and invest that amount (or a portion) based on risk profile. Kept simple and fast.
"""

import uuid
from datetime import datetime, timezone

from app.database import supabase
from app.services.gemini_service import get_investment_advice
from app.services.investment_execution import execute_simulated_buy
from app.services.price_service import ASSET_TYPE_CRYPTO, ASSET_TYPE_STOCK, get_supported_assets


async def trigger_auto_invest(
    user_id: str,
    savings_amount: float,
    current_pool: float,
    risk_profile: str,
) -> dict | None:
    """
    After a transaction adds savings_amount to the pool, get AI suggestion and invest
    into the suggested asset. Invest at least $1 when there's any savings (so small txns still show a holding).
    Returns the investment row dict or None if skipped/failed.
    """
    if current_pool < 1.0:
        return None
    # Invest at least $1 so demo/small txns still create a visible holding; cap at pool
    invest_amount = min(max(1.0, savings_amount), current_pool)
    if invest_amount < 1.0:
        return None

    # Holdings summary for AI context
    inv_result = (
        supabase.table("investments")
        .select("asset, amount_invested")
        .eq("user_id", user_id)
        .eq("status", "filled")
        .execute()
    )
    rows = inv_result.data or []
    total_invested = sum(float(r.get("amount_invested") or 0) for r in rows)
    parts = [f"{r.get('asset', '?')} ${float(r.get('amount_invested') or 0):.0f}" for r in rows]
    holdings_summary = ", ".join(parts) if parts else "None"
    total_balance = current_pool + total_invested

    try:
        advice = await get_investment_advice(
            total_balance=total_balance,
            savings_pool=current_pool,
            risk_profile=(risk_profile or "moderate").lower(),
            holdings_summary=holdings_summary,
        )
    except Exception as e:
        print(f"Auto-invest: advice failed ({e}), using fallback asset.")
        advice = None

    asset = None
    asset_type = None
    assets = get_supported_assets()
    if advice and advice.get("suggestions"):
        first = advice["suggestions"][0]
        a = (first.get("asset") or "").strip().upper()
        at = (first.get("asset_type") or "stock").lower()
        if at not in (ASSET_TYPE_CRYPTO, ASSET_TYPE_STOCK):
            at = ASSET_TYPE_STOCK
        if a in assets["crypto"]:
            asset, asset_type = a, ASSET_TYPE_CRYPTO
        elif a:
            asset, asset_type = a, at or ASSET_TYPE_STOCK
    if not asset:
        # Fallback by risk: aggressive -> SOL, else SPY
        if (risk_profile or "").lower() == "aggressive":
            asset, asset_type = "SOL", ASSET_TYPE_CRYPTO
        else:
            asset, asset_type = "SPY", ASSET_TYPE_STOCK

    # Try primary asset, then fallback to the other if price fetch fails
    fallback = ("SOL", ASSET_TYPE_CRYPTO) if asset == "SPY" else ("SPY", ASSET_TYPE_STOCK)
    result = None
    for (a, at) in [(asset, asset_type), fallback]:
        try:
            result = await execute_simulated_buy(a, invest_amount, at)
            break
        except Exception as e:
            print(f"Auto-invest: {a} failed ({e}), trying fallback")
    if result is None:
        return None

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
    new_pool = current_pool - invest_amount
    supabase.table("users").update({"savings_pool": new_pool}).eq("id", user_id).execute()

    return row
