from bson import ObjectId

from app.database import transactions_collection, users_collection
from app.config import get_settings

settings = get_settings()


# Default percentage ranges per risk profile
RISK_DEFAULTS = {
    "chill": {"essential": 2.0, "discretionary": 5.0, "default": 3.0},
    "moderate": {"essential": 5.0, "discretionary": 10.0, "default": 7.0},
    "aggressive": {"essential": 8.0, "discretionary": 15.0, "default": 12.0},
}


def calculate_savings_amount(
    transaction_amount: float,
    savings_pct: float | None = None,
    ai_category: str | None = None,
    risk_profile: str = "moderate",
) -> tuple[float, float]:
    """
    Calculate the dollar amount to save for a given transaction.

    Returns:
        tuple of (savings_amount, savings_pct_used)
    """
    if savings_pct is not None:
        pct = savings_pct
    elif ai_category:
        defaults = RISK_DEFAULTS.get(risk_profile, RISK_DEFAULTS["moderate"])
        pct = defaults.get(ai_category, defaults["default"])
    else:
        defaults = RISK_DEFAULTS.get(risk_profile, RISK_DEFAULTS["moderate"])
        pct = defaults["default"]

    savings_amount = round(transaction_amount * (pct / 100.0), 2)
    return savings_amount, pct


async def process_transaction_savings(transaction_id: str, user_id: str) -> dict | None:
    """
    Process a single transaction: calculate savings and update the user's pool.

    Returns the updated transaction doc or None if already processed.
    """
    txn = await transactions_collection.find_one({"_id": ObjectId(transaction_id)})
    if not txn or txn.get("processed"):
        return None

    user = await users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        return None

    risk_profile = user.get("risk_profile", "moderate")

    savings_amount, pct_used = calculate_savings_amount(
        transaction_amount=txn["amount"],
        savings_pct=txn.get("savings_pct"),
        ai_category=txn.get("ai_category"),
        risk_profile=risk_profile,
    )

    # Update the transaction
    await transactions_collection.update_one(
        {"_id": ObjectId(transaction_id)},
        {
            "$set": {
                "savings_amount": savings_amount,
                "savings_pct": pct_used,
                "processed": True,
            }
        },
    )

    # Add to user's savings pool
    await users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$inc": {"savings_pool": savings_amount}},
    )

    return {
        "transaction_id": transaction_id,
        "savings_amount": savings_amount,
        "savings_pct": pct_used,
        "new_pool_balance": user.get("savings_pool", 0) + savings_amount,
    }


async def process_all_unprocessed(user_id: str) -> list[dict]:
    """Process all unprocessed transactions for a user."""
    cursor = transactions_collection.find({
        "user_id": user_id,
        "processed": False,
    })

    results = []
    async for txn in cursor:
        result = await process_transaction_savings(str(txn["_id"]), user_id)
        if result:
            results.append(result)

    return results


async def get_savings_summary(user_id: str) -> dict:
    """Get a summary of savings for a user."""
    user = await users_collection.find_one({"_id": ObjectId(user_id)})

    # Total saved across all transactions
    pipeline = [
        {"$match": {"user_id": user_id, "processed": True}},
        {"$group": {"_id": None, "total": {"$sum": "$savings_amount"}}},
    ]
    total_result = await transactions_collection.aggregate(pipeline).to_list(1)
    total_saved = total_result[0]["total"] if total_result else 0.0

    # Savings history by date
    history_pipeline = [
        {"$match": {"user_id": user_id, "processed": True}},
        {
            "$group": {
                "_id": "$date",
                "amount": {"$sum": "$savings_amount"},
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"_id": 1}},
    ]
    history = await transactions_collection.aggregate(history_pipeline).to_list(100)

    return {
        "total_saved": total_saved,
        "savings_pool": user.get("savings_pool", 0.0) if user else 0.0,
        "total_invested": total_saved - (user.get("savings_pool", 0.0) if user else 0.0),
        "savings_history": [
            {"date": h["_id"], "amount": h["amount"], "transactions": h["count"]}
            for h in history
        ],
    }
