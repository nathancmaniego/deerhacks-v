"""
Stock price and search using real market data (yfinance).
Any ticker can be looked up; no preset list required.
"""

import asyncio
from typing import Optional

# Suggested tickers for quick-pick (optional); users can search any symbol
SUGGESTED_STOCKS = ["SPY", "AAPL", "GOOGL", "MSFT", "AMZN", "NVDA", "META", "TSLA"]


def _get_stock_price_sync(symbol: str) -> Optional[float]:
    """Synchronous fetch of latest stock price via yfinance. Tries multiple sources."""
    try:
        import yfinance as yf
        ticker = yf.Ticker(symbol)
        info = getattr(ticker, "fast_info", None)
        if info is not None and hasattr(info, "last_price") and info.last_price:
            return float(info.last_price)
        hist = ticker.history(period="1d")
        if hist is not None and not hist.empty:
            return float(hist["Close"].iloc[-1])
        hist = ticker.history(period="5d")
        if hist is not None and not hist.empty:
            return float(hist["Close"].iloc[-1])
        info_dict = getattr(ticker, "info", None) or {}
        if isinstance(info_dict, dict):
            for key in ("regularMarketPrice", "currentPrice", "previousClose", "open"):
                v = info_dict.get(key)
                if v is not None and float(v) > 0:
                    return float(v)
    except Exception:
        pass
    return None


def _quote_attr(q: object, *keys: str):
    """Get first present attribute from quote (object or dict)."""
    for k in keys:
        try:
            if isinstance(q, dict):
                v = q.get(k)
            else:
                v = getattr(q, k, None)
            if v is not None and v != "":
                return v
        except Exception:
            pass
    return None


def _search_stocks_sync(query: str, limit: int = 15) -> list[dict]:
    """Search stocks by symbol or company name; return symbol, name, price."""
    out = []
    seen = set()
    try:
        import yfinance as yf
        search = yf.Search(query, max_results=max(limit, 10))
        quotes = getattr(search, "quotes", None) or getattr(search, "all", None) or []
        if not quotes and isinstance(quotes, list):
            quotes = getattr(search, "response", None)
            if isinstance(quotes, dict) and "quotes" in quotes:
                quotes = quotes.get("quotes") or []
        for q in quotes or []:
            sym = _quote_attr(q, "symbol", "ticker", "Symbol")
            if not sym:
                continue
            sym = str(sym).strip().upper()
            if sym in seen:
                continue
            seen.add(sym)
            name = _quote_attr(q, "shortname", "shortName", "longname", "longName", "name")
            name = str(name or sym)
            price = _quote_attr(q, "regularMarketPrice", "price")
            if price is not None:
                try:
                    price = float(price)
                except (TypeError, ValueError):
                    price = None
            if price is None or price <= 0:
                price = _get_stock_price_sync(sym)
            if price is not None and price > 0:
                out.append({"symbol": sym, "name": name, "price": float(price)})
            if len(out) >= limit:
                break
        if not out and query.strip():
            sym = query.strip().upper()
            price = _get_stock_price_sync(sym)
            if price is not None and price > 0:
                name = sym
                try:
                    t = yf.Ticker(sym)
                    info = getattr(t, "info", None) or {}
                    if isinstance(info, dict) and info.get("shortName"):
                        name = info.get("shortName") or sym
                except Exception:
                    pass
                out.append({"symbol": sym, "name": str(name), "price": float(price)})
    except Exception:
        if query.strip():
            sym = query.strip().upper()
            price = _get_stock_price_sync(sym)
            if price is not None and price > 0:
                out.append({"symbol": sym, "name": sym, "price": float(price)})
    return out[:limit]


async def get_stock_price(symbol: str) -> float:
    """Fetch current USD price for any stock ticker. Raises if invalid or fetch fails."""
    sym = (symbol or "").strip().upper()
    if not sym:
        raise ValueError("Stock symbol is required")
    price = await asyncio.to_thread(_get_stock_price_sync, sym)
    if price is None or price <= 0:
        raise RuntimeError(f"Could not fetch price for {symbol}. Check symbol or try again.")
    return price


async def get_stock_prices(symbols: list[str]) -> dict[str, float]:
    """Fetch current USD prices for multiple stocks (any tickers)."""
    result = {}
    for s in symbols:
        sym = (s or "").strip().upper()
        if not sym:
            continue
        try:
            result[sym] = await get_stock_price(sym)
        except Exception:
            pass
    return result


async def search_stocks(query: str, limit: int = 15) -> list[dict]:
    """Search stocks by name or symbol; returns list of { symbol, name, price }."""
    q = (query or "").strip()
    if not q:
        return []
    return await asyncio.to_thread(_search_stocks_sync, q, max(1, min(limit, 25)))
