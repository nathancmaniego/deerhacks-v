from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum


class SpendingCategory(str, Enum):
    ESSENTIAL = "essential"
    DISCRETIONARY = "discretionary"


class TransactionResponse(BaseModel):
    id: str
    user_id: str
    plaid_transaction_id: Optional[str] = None
    merchant: str
    amount: float
    date: str
    ai_category: Optional[str] = None
    savings_pct: Optional[float] = None
    savings_amount: Optional[float] = None
    processed: bool = False
    created_at: datetime


class TransactionListResponse(BaseModel):
    transactions: list[TransactionResponse]
    total_savings: float
    count: int


class SavingsSummary(BaseModel):
    total_saved: float
    savings_pool: float
    total_invested: float
    savings_history: list[dict]
