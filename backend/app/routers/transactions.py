from fastapi import APIRouter, Depends
from bson import ObjectId

from app.database import transactions_collection
from app.models.transaction import TransactionResponse, TransactionListResponse, SavingsSummary
from app.services.savings_engine import process_all_unprocessed, get_savings_summary
from app.utils.security import get_current_user

router = APIRouter()


def txn_doc_to_response(doc: dict) -> TransactionResponse:
    return TransactionResponse(
        id=str(doc["_id"]),
        user_id=doc["user_id"],
        plaid_transaction_id=doc.get("plaid_transaction_id"),
        merchant=doc["merchant"],
        amount=doc["amount"],
        date=doc["date"],
        ai_category=doc.get("ai_category"),
        savings_pct=doc.get("savings_pct"),
        savings_amount=doc.get("savings_amount"),
        processed=doc.get("processed", False),
        created_at=doc["created_at"],
    )


@router.get("/", response_model=TransactionListResponse)
async def list_transactions(
    limit: int = 50,
    skip: int = 0,
    current_user: dict = Depends(get_current_user),
):
    """List user's transactions with savings info."""
    user_id = str(current_user["_id"])

    cursor = (
        transactions_collection.find({"user_id": user_id})
        .sort("date", -1)
        .skip(skip)
        .limit(limit)
    )

    transactions = []
    total_savings = 0.0
    async for doc in cursor:
        transactions.append(txn_doc_to_response(doc))
        if doc.get("savings_amount"):
            total_savings += doc["savings_amount"]

    return TransactionListResponse(
        transactions=transactions,
        total_savings=total_savings,
        count=len(transactions),
    )


@router.post("/process")
async def process_transactions(current_user: dict = Depends(get_current_user)):
    """Process all unprocessed transactions (calculate savings, update pool)."""
    user_id = str(current_user["_id"])
    results = await process_all_unprocessed(user_id)

    return {
        "processed": len(results),
        "results": results,
    }


@router.get("/savings", response_model=SavingsSummary)
async def savings_summary(current_user: dict = Depends(get_current_user)):
    """Get savings summary for the user."""
    user_id = str(current_user["_id"])
    summary = await get_savings_summary(user_id)
    return SavingsSummary(**summary)
