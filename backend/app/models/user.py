from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime, timezone
from enum import Enum


class RiskProfile(str, Enum):
    CHILL = "chill"
    MODERATE = "moderate"
    AGGRESSIVE = "aggressive"


# Request schemas
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    name: str = Field(..., min_length=1)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UpdateRiskProfile(BaseModel):
    risk_profile: RiskProfile


# Response schemas
class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    risk_profile: RiskProfile = RiskProfile.MODERATE
    savings_pool: float = 0.0
    has_plaid_connected: bool = False
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# Database document schema
class UserDocument(BaseModel):
    email: str
    password_hash: str
    name: str
    risk_profile: RiskProfile = RiskProfile.MODERATE
    plaid_access_token: Optional[str] = None
    plaid_item_id: Optional[str] = None
    savings_pool: float = 0.0
    preferred_asset: str = "SPY"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
