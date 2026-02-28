import asyncio
from typing import Optional

from alpaca.trading.client import TradingClient
from alpaca.trading.requests import MarketOrderRequest
from alpaca.trading.enums import OrderSide, TimeInForce

from app.config import get_settings

settings = get_settings()


def get_alpaca_client() -> TradingClient:
    return TradingClient(
        api_key=settings.ALPACA_API_KEY,
        secret_key=settings.ALPACA_SECRET_KEY,
        paper=True,
    )


def _place_fractional_order_sync(symbol: str, notional: float) -> dict:
    """Synchronous fractional order placement."""
    client = get_alpaca_client()

    order_data = MarketOrderRequest(
        symbol=symbol,
        notional=round(notional, 2),
        side=OrderSide.BUY,
        time_in_force=TimeInForce.DAY,
    )

    order = client.submit_order(order_data)

    return {
        "order_id": str(order.id),
        "symbol": order.symbol,
        "notional": float(order.notional) if order.notional else notional,
        "status": str(order.status.value) if hasattr(order.status, "value") else str(order.status),
        "filled_qty": float(order.filled_qty) if order.filled_qty else 0.0,
        "filled_avg_price": float(order.filled_avg_price) if order.filled_avg_price else 0.0,
        "submitted_at": str(order.submitted_at),
    }


async def place_fractional_order(symbol: str, notional: float) -> dict:
    """
    Place a fractional share market order using notional (dollar) amount.

    Args:
        symbol: The ticker symbol (e.g., "SPY")
        notional: The dollar amount to invest

    Returns:
        Order details dict
    """
    return await asyncio.to_thread(_place_fractional_order_sync, symbol, notional)


def _get_portfolio_positions_sync() -> list[dict]:
    """Synchronous portfolio positions fetch."""
    client = get_alpaca_client()
    positions = client.get_all_positions()

    holdings = []
    for pos in positions:
        holdings.append({
            "symbol": pos.symbol,
            "qty": float(pos.qty),
            "market_value": float(pos.market_value),
            "avg_entry_price": float(pos.avg_entry_price),
            "current_price": float(pos.current_price),
            "unrealized_pl": float(pos.unrealized_pl),
            "unrealized_plpc": float(pos.unrealized_plpc),
        })

    return holdings


async def get_portfolio_positions() -> list[dict]:
    """Get all current portfolio positions."""
    return await asyncio.to_thread(_get_portfolio_positions_sync)


def _get_account_info_sync() -> dict:
    """Synchronous account info fetch."""
    client = get_alpaca_client()
    account = client.get_account()

    return {
        "portfolio_value": float(account.portfolio_value),
        "buying_power": float(account.buying_power),
        "cash": float(account.cash),
        "equity": float(account.equity),
    }


async def get_account_info() -> dict:
    """Get Alpaca account information."""
    return await asyncio.to_thread(_get_account_info_sync)


def _get_order_status_sync(order_id: str) -> Optional[dict]:
    """Synchronous order status fetch."""
    client = get_alpaca_client()
    try:
        order = client.get_order_by_id(order_id)
        return {
            "order_id": str(order.id),
            "symbol": order.symbol,
            "status": str(order.status.value) if hasattr(order.status, "value") else str(order.status),
            "filled_qty": float(order.filled_qty) if order.filled_qty else 0.0,
            "filled_avg_price": float(order.filled_avg_price) if order.filled_avg_price else 0.0,
        }
    except Exception:
        return None


async def get_order_status(order_id: str) -> Optional[dict]:
    """Get the status of a specific order."""
    return await asyncio.to_thread(_get_order_status_sync, order_id)
