from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from datetime import datetime, timezone

from app.database import users_collection, transactions_collection
from app.services.plaid_service import create_link_token, exchange_public_token, fetch_transactions
from app.utils.security import get_current_user

router = APIRouter()


class ExchangeTokenRequest(BaseModel):
    public_token: str


class LinkTokenResponse(BaseModel):
    link_token: str


@router.post("/link-token", response_model=LinkTokenResponse)
async def get_link_token(current_user: dict = Depends(get_current_user)):
    """Create a Plaid Link token for the frontend."""
    try:
        link_token = await create_link_token(str(current_user["_id"]))
        return LinkTokenResponse(link_token=link_token)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create link token: {str(e)}",
        )


@router.post("/exchange")
async def exchange_token(
    data: ExchangeTokenRequest,
    current_user: dict = Depends(get_current_user),
):
    """Exchange public token for access token and store it."""
    try:
        result = await exchange_public_token(data.public_token)

        await users_collection.update_one(
            {"_id": current_user["_id"]},
            {
                "$set": {
                    "plaid_access_token": result["access_token"],
                    "plaid_item_id": result["item_id"],
                }
            },
        )

        return {"message": "Bank account linked successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to exchange token: {str(e)}",
        )


@router.get("/transactions")
async def get_transactions(current_user: dict = Depends(get_current_user)):
    """Fetch new transactions from Plaid and store them."""
    access_token = current_user.get("plaid_access_token")
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No bank account linked. Please connect via Plaid first.",
        )

    try:
        cursor = current_user.get("plaid_cursor")
        result = await fetch_transactions(access_token, cursor)

        # Store new transactions
        new_transactions = []
        for txn in result["transactions"]:
            # Skip if already exists
            existing = await transactions_collection.find_one(
                {"plaid_transaction_id": txn["plaid_transaction_id"]}
            )
            if existing:
                continue

            doc = {
                "user_id": str(current_user["_id"]),
                "plaid_transaction_id": txn["plaid_transaction_id"],
                "merchant": txn["merchant"],
                "amount": txn["amount"],
                "date": txn["date"],
                "plaid_category": txn.get("category"),
                "ai_category": None,
                "savings_pct": None,
                "savings_amount": None,
                "processed": False,
                "created_at": datetime.now(timezone.utc),
            }
            insert_result = await transactions_collection.insert_one(doc)
            doc["_id"] = insert_result.inserted_id
            new_transactions.append(doc)

        # Update cursor
        await users_collection.update_one(
            {"_id": current_user["_id"]},
            {"$set": {"plaid_cursor": result["cursor"]}},
        )

        return {
            "new_transactions": len(new_transactions),
            "message": f"Fetched {len(new_transactions)} new transactions",
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch transactions: {str(e)}",
        )
