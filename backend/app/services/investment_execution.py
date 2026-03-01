"""
Simulated investment execution: get live price and compute fill.
No real orders; deducts from app balance (savings_pool) and records in DB.
This module is the single place for "execute a buy" so AI strategy can call it later.
"""

from app.services.price_service import get_price, ASSET_TYPE_CRYPTO, ASSET_TYPE_STOCK, get_supported_assets


def _infer_asset_type(symbol: str) -> str:
    """Infer asset_type: if in crypto list then crypto, else treat as stock (any ticker allowed)."""
    sym = symbol.upper()
    assets = get_supported_assets()
    if sym in assets["crypto"]:
        return ASSET_TYPE_CRYPTO
    return ASSET_TYPE_STOCK


async def execute_simulated_buy(
    asset: str,
    usd_amount: float,
    asset_type: str | None = None,
) -> dict:
    """
    Simulate a buy at current market price. Uses real APIs for pricing.
    Returns dict: symbol, price, shares, amount_usd, status, asset_type.

    Caller is responsible for: deducting from savings_pool and inserting into investments table.
    """
    sym = asset.upper()
    atype = asset_type or _infer_asset_type(sym)

    price = await get_price(sym, atype)
    if price <= 0:
        raise RuntimeError(f"Invalid price for {sym}")
    shares = usd_amount / price

    return {
        "symbol": sym,
        "price": price,
        "shares": shares,
        "amount_usd": usd_amount,
        "status": "filled",
        "asset_type": atype,
    }
