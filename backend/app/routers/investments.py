from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional

from app.database import users_collection, investments_collection
from app.models.investment import (
    InvestmentResponse,
    InvestmentHistoryResponse,
    PortfolioResponse,
    PortfolioHolding,
)
from app.services.alpaca_service import (
    place_fractional_order,
    get_portfolio_positions,
    get_account_info,
)
from app.config import get_settings
from app.utils.security import get_current_user

settings = get_settings()
router = APIRouter()


class ExecuteInvestmentRequest(BaseModel):
    amount: Optional[float] = None  # If None, invest entire savings pool
    asset: Optional[str] = None  # If None, use user's preferred asset


def investment_doc_to_response(doc: dict) -> InvestmentResponse:
    return InvestmentResponse(
        id=str(doc["_id"]),
        user_id=doc["user_id"],
        alpaca_order_id=doc.get("alpaca_order_id"),
        asset=doc["asset"],
        amount_invested=doc["amount_invested"],
        shares=doc.get("shares"),
        status=doc.get("status", "pending"),
        created_at=doc["created_at"],
    )


@router.post("/execute", response_model=InvestmentResponse)
async def execute_investment(
    data: ExecuteInvestmentRequest | None = None,
    current_user: dict = Depends(get_current_user),
):
    """Execute an investment from the savings pool."""
    user_id = str(current_user["_id"])
    savings_pool = current_user.get("savings_pool", 0.0)

    # Determine amount to invest
    if data and data.amount:
        invest_amount = data.amount
        if invest_amount > savings_pool:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient savings pool. Available: ${savings_pool:.2f}",
            )
    else:
        invest_amount = savings_pool

    if invest_amount < 1.0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Minimum investment is $1.00. Current pool: ${savings_pool:.2f}",
        )

    # Determine asset
    asset = (data.asset if data and data.asset else None) or current_user.get(
        "preferred_asset", settings.DEFAULT_ASSET
    )

    try:
        # Place the order
        order_result = await place_fractional_order(asset, invest_amount)

        # Create investment record
        investment_doc = {
            "user_id": user_id,
            "alpaca_order_id": order_result["order_id"],
            "asset": asset,
            "amount_invested": invest_amount,
            "shares": order_result.get("filled_qty", 0.0),
            "status": order_result["status"],
            "created_at": datetime.now(timezone.utc),
        }

        result = await investments_collection.insert_one(investment_doc)
        investment_doc["_id"] = result.inserted_id

        # Deduct from savings pool
        await users_collection.update_one(
            {"_id": current_user["_id"]},
            {"$inc": {"savings_pool": -invest_amount}},
        )

        return investment_doc_to_response(investment_doc)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute investment: {str(e)}",
        )


@router.get("/portfolio", response_model=PortfolioResponse)
async def get_portfolio(current_user: dict = Depends(get_current_user)):
    """Get current portfolio holdings from Alpaca."""
    try:
        positions = await get_portfolio_positions()
        account = await get_account_info()

        holdings = [PortfolioHolding(**pos) for pos in positions]
        total_gain = sum(h.unrealized_pl for h in holdings)

        return PortfolioResponse(
            holdings=holdings,
            total_value=account["portfolio_value"],
            total_gain_loss=total_gain,
            savings_pool=current_user.get("savings_pool", 0.0),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch portfolio: {str(e)}",
        )


@router.get("/history", response_model=InvestmentHistoryResponse)
async def get_investment_history(
    limit: int = 50,
    skip: int = 0,
    current_user: dict = Depends(get_current_user),
):
    """Get investment history."""
    user_id = str(current_user["_id"])

    cursor = (
        investments_collection.find({"user_id": user_id})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )

    investments = []
    total_invested = 0.0
    async for doc in cursor:
        investments.append(investment_doc_to_response(doc))
        total_invested += doc["amount_invested"]

    return InvestmentHistoryResponse(
        investments=investments,
        total_invested=total_invested,
        count=len(investments),
    )
