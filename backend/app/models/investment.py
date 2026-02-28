from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum


class OrderStatus(str, Enum):
    PENDING = "pending"
    FILLED = "filled"
    FAILED = "failed"


class InvestmentResponse(BaseModel):
    id: str
    user_id: str
    asset: str
    amount_invested: float
    shares: Optional[float] = None
    price_at_purchase: Optional[float] = None
    status: str
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
