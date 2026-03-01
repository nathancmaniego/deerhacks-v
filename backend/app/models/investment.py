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
    asset_type: Optional[str] = "crypto"  # "crypto" | "stock"; default for legacy rows


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
    asset_type: Optional[str] = "crypto"


class PortfolioResponse(BaseModel):
    holdings: list[PortfolioHolding]
    total_value: float
    total_gain_loss: float
    total_cost: float = 0.0
    total_gain_loss_pct: float = 0.0
    savings_pool: float
