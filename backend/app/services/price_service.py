"""
Unified price service: single entry point for crypto and stock prices.
Designed so AI or strategy layer can call get_price(asset, asset_type) later.
"""

from app.services.crypto_service import (
    get_crypto_price,
    get_crypto_prices,
    SUPPORTED_CRYPTO,
)
from app.services.stock_service import (
    get_stock_price,
    get_stock_prices,
    SUGGESTED_STOCKS,
)

ASSET_TYPE_CRYPTO = "crypto"
ASSET_TYPE_STOCK = "stock"


async def get_price(symbol: str, asset_type: str) -> float:
    """Get current USD price for one asset. Used by execution and portfolio."""
    sym = symbol.upper()
    if asset_type == ASSET_TYPE_CRYPTO:
        return await get_crypto_price(sym)
    if asset_type == ASSET_TYPE_STOCK:
        return await get_stock_price(sym)
    raise ValueError(f"Unknown asset_type: {asset_type}. Use 'crypto' or 'stock'.")


async def get_prices_by_type(assets: list[tuple[str, str]]) -> dict[str, float]:
    """
    Get prices for a list of (symbol, asset_type).
    Returns dict symbol -> price. Used for portfolio valuation.
    """
    crypto_syms = [s for s, t in assets if t == ASSET_TYPE_CRYPTO]
    stock_syms = [s for s, t in assets if t == ASSET_TYPE_STOCK]

    prices = {}
    if crypto_syms:
        prices.update(await get_crypto_prices(crypto_syms))
    if stock_syms:
        stock_prices = await get_stock_prices(stock_syms)
        prices.update(stock_prices)
    return prices


def get_supported_assets() -> dict[str, list[str]]:
    """Return { crypto: [...], stocks: [...] }. Crypto = Solana meme coins; stocks = suggested quick-pick (users can search any ticker)."""
    return {
        "crypto": list(SUPPORTED_CRYPTO),
        "stocks": list(SUGGESTED_STOCKS),
    }
