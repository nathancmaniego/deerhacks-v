from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from bson import ObjectId

from app.database import transactions_collection, users_collection
from app.services.gemini_service import classify_transactions
from app.utils.security import get_current_user

router = APIRouter()


class ClassifyRequest(BaseModel):
    transaction_ids: list[str] | None = None  # If None, classify all unprocessed


class ClassificationResult(BaseModel):
    transaction_id: str
    category: str
    recommended_pct: float
    reasoning: str


class ClassifyResponse(BaseModel):
    classifications: list[ClassificationResult]
    count: int


@router.post("/classify", response_model=ClassifyResponse)
async def classify_user_transactions(
    data: ClassifyRequest | None = None,
    current_user: dict = Depends(get_current_user),
):
    """Classify transactions using Gemini AI."""
    user_id = str(current_user["_id"])

    # Build query for unclassified transactions
    query = {"user_id": user_id, "ai_category": None}
    if data and data.transaction_ids:
        query["_id"] = {"$in": [ObjectId(tid) for tid in data.transaction_ids]}

    # Fetch transactions to classify
    cursor = transactions_collection.find(query).sort("date", -1).limit(50)
    txns = []
    async for doc in cursor:
        txns.append({
            "id": str(doc["_id"]),
            "merchant": doc["merchant"],
            "amount": doc["amount"],
            "date": doc["date"],
            "plaid_category": doc.get("plaid_category"),
        })

    if not txns:
        return ClassifyResponse(classifications=[], count=0)

    # Identify upcoming bills (essential transactions in the next 7 days)
    upcoming_cursor = transactions_collection.find({
        "user_id": user_id,
        "ai_category": "essential",
    }).sort("date", -1).limit(10)

    upcoming_bills = []
    async for doc in upcoming_cursor:
        upcoming_bills.append({
            "merchant": doc["merchant"],
            "amount": doc["amount"],
            "date": doc["date"],
        })

    # Classify with Gemini
    risk_profile = current_user.get("risk_profile", "moderate")
    classifications = await classify_transactions(txns, risk_profile, upcoming_bills)

    # Update transactions with classifications
    for cls in classifications:
        txn_id = cls.get("transaction_id")
        if txn_id:
            try:
                await transactions_collection.update_one(
                    {"_id": ObjectId(txn_id)},
                    {
                        "$set": {
                            "ai_category": cls["category"],
                            "savings_pct": cls["recommended_pct"],
                        }
                    },
                )
            except Exception:
                pass

    return ClassifyResponse(
        classifications=[
            ClassificationResult(
                transaction_id=c["transaction_id"],
                category=c["category"],
                recommended_pct=c["recommended_pct"],
                reasoning=c.get("reasoning", ""),
            )
            for c in classifications
        ],
        count=len(classifications),
    )
