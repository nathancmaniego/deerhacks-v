"""
Crypto prices via CoinGecko. Focus: Solana ecosystem and meme coins only.
"""

import httpx

COINGECKO_BASE = "https://api.coingecko.com/api/v3"

# Solana + Solana meme coins only (secondary to stocks in the app)
SYMBOL_TO_COINGECKO_ID = {
    "SOL": "solana",
    "BONK": "bonk",
    "JUP": "jupiter-exchange-solana",
    "WIF": "dogwifhat",
    "POPCAT": "popcat",
}
SUPPORTED_CRYPTO = list(SYMBOL_TO_COINGECKO_ID.keys())
SUPPORTED_SYMBOLS = SUPPORTED_CRYPTO


async def get_crypto_price(symbol: str) -> float:
    """Fetch the current USD price for a single crypto asset (Solana ecosystem)."""
    cg_id = SYMBOL_TO_COINGECKO_ID.get(symbol.upper())
    if not cg_id:
        raise ValueError(f"Unsupported asset: {symbol}. Supported: {SUPPORTED_CRYPTO}")

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{COINGECKO_BASE}/simple/price",
            params={"ids": cg_id, "vs_currencies": "usd"},
        )
        resp.raise_for_status()
        data = resp.json()

    price = data.get(cg_id, {}).get("usd")
    if price is None:
        raise RuntimeError(f"Could not fetch price for {symbol}. Try again in a moment.")
    return float(price)


async def get_crypto_prices(symbols: list[str]) -> dict[str, float]:
    """Fetch current USD prices for multiple crypto assets in one call."""
    cg_ids = []
    for s in symbols:
        cg_id = SYMBOL_TO_COINGECKO_ID.get(s.upper())
        if cg_id:
            cg_ids.append(cg_id)

    if not cg_ids:
        return {}

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f"{COINGECKO_BASE}/simple/price",
            params={"ids": ",".join(cg_ids), "vs_currencies": "usd"},
        )
        resp.raise_for_status()
        data = resp.json()

    id_to_symbol = {v: k for k, v in SYMBOL_TO_COINGECKO_ID.items()}
    return {
        id_to_symbol[cg_id]: info["usd"]
        for cg_id, info in data.items()
        if cg_id in id_to_symbol and "usd" in info
    }


async def simulate_buy(symbol: str, usd_amount: float) -> dict:
    """Simulate a crypto purchase at the current market price."""
    price = await get_crypto_price(symbol)
    shares = usd_amount / price
    return {
        "symbol": symbol.upper(),
        "price": price,
        "shares": shares,
        "amount_usd": usd_amount,
        "status": "filled",
    }
