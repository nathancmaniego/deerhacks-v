from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class OrderStatus(str, Enum):
    PENDING = "pending"
    NEW = "new"
    ACCEPTED = "accepted"
    PARTIALLY_FILLED = "partially_filled"
    FILLED = "filled"
    DONE_FOR_DAY = "done_for_day"
    CANCELED = "canceled"
    CANCELLED = "cancelled"
    EXPIRED = "expired"
    REPLACED = "replaced"
    PENDING_CANCEL = "pending_cancel"
    PENDING_REPLACE = "pending_replace"
    PENDING_NEW = "pending_new"
    ACCEPTED_FOR_BIDDING = "accepted_for_bidding"
    STOPPED = "stopped"
    REJECTED = "rejected"
    SUSPENDED = "suspended"
    CALCULATED = "calculated"
    HELD = "held"
    FAILED = "failed"


# Response schemas
class InvestmentResponse(BaseModel):
    id: str
    user_id: str
    alpaca_order_id: Optional[str] = None
    asset: str
    amount_invested: float
    shares: Optional[float] = None
    status: str  # Use str instead of enum to handle any Alpaca status
    created_at: datetime


class InvestmentHistoryResponse(BaseModel):
    investments: list[InvestmentResponse]
    total_invested: float
    count: int


class PortfolioHolding(BaseModel):
    symbol: str
    qty: float
    market_value: float
    avg_entry_price: float
    current_price: float
    unrealized_pl: float
    unrealized_plpc: float


class PortfolioResponse(BaseModel):
    holdings: list[PortfolioHolding]
    total_value: float
    total_gain_loss: float
    savings_pool: float
