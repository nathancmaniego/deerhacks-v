import asyncio
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler

from app.config import get_settings

settings = get_settings()

scheduler = BackgroundScheduler()


def _run_async(coro):
    """Helper to run async functions from sync scheduler."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _poll_transactions_for_all_users():
    """Poll Plaid for new transactions for all users with linked accounts."""
    from app.database import users_collection, transactions_collection
    from app.services.plaid_service import fetch_transactions

    cursor = users_collection.find({"plaid_access_token": {"$ne": None}})
    async for user in cursor:
        try:
            user_id = str(user["_id"])
            access_token = user["plaid_access_token"]
            plaid_cursor = user.get("plaid_cursor")

            result = await fetch_transactions(access_token, plaid_cursor)

            for txn in result["transactions"]:
                existing = await transactions_collection.find_one(
                    {"plaid_transaction_id": txn["plaid_transaction_id"]}
                )
                if existing:
                    continue

                await transactions_collection.insert_one({
                    "user_id": user_id,
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
                })

            # Update cursor
            await users_collection.update_one(
                {"_id": user["_id"]},
                {"$set": {"plaid_cursor": result["cursor"]}},
            )

            print(f"[Scheduler] Polled {len(result['transactions'])} transactions for user {user_id}")
        except Exception as e:
            print(f"[Scheduler] Error polling transactions for user {user.get('email')}: {e}")


async def _classify_and_process():
    """Classify unprocessed transactions with AI and calculate savings."""
    from app.database import users_collection, transactions_collection
    from app.services.gemini_service import classify_transactions
    from app.services.savings_engine import process_all_unprocessed

    cursor = users_collection.find({})
    async for user in cursor:
        user_id = str(user["_id"])
        risk_profile = user.get("risk_profile", "moderate")

        try:
            # Find unclassified transactions
            txn_cursor = transactions_collection.find({
                "user_id": user_id,
                "ai_category": None,
            }).limit(50)

            txns = []
            async for doc in txn_cursor:
                txns.append({
                    "id": str(doc["_id"]),
                    "merchant": doc["merchant"],
                    "amount": doc["amount"],
                    "date": doc["date"],
                    "plaid_category": doc.get("plaid_category"),
                })

            if txns:
                # Classify with Gemini
                classifications = await classify_transactions(txns, risk_profile)

                # Update transactions
                from bson import ObjectId
                for cls in classifications:
                    txn_id = cls.get("transaction_id")
                    if txn_id:
                        await transactions_collection.update_one(
                            {"_id": ObjectId(txn_id)},
                            {
                                "$set": {
                                    "ai_category": cls["category"],
                                    "savings_pct": cls["recommended_pct"],
                                }
                            },
                        )

            # Process all unprocessed (calculate savings)
            results = await process_all_unprocessed(user_id)
            if results:
                print(f"[Scheduler] Processed {len(results)} transactions for user {user_id}")

        except Exception as e:
            print(f"[Scheduler] Error classifying for user {user.get('email')}: {e}")


async def _auto_invest():
    """Auto-invest for users whose savings pool exceeds threshold."""
    from app.database import users_collection, investments_collection
    from app.services.alpaca_service import place_fractional_order

    threshold = settings.SAVINGS_POOL_THRESHOLD

    cursor = users_collection.find({"savings_pool": {"$gte": threshold}})
    async for user in cursor:
        user_id = str(user["_id"])
        pool = user.get("savings_pool", 0.0)
        asset = user.get("preferred_asset", settings.DEFAULT_ASSET)

        try:
            order_result = await place_fractional_order(asset, pool)

            # Record investment
            await investments_collection.insert_one({
                "user_id": user_id,
                "alpaca_order_id": order_result["order_id"],
                "asset": asset,
                "amount_invested": pool,
                "shares": order_result.get("filled_qty", 0.0),
                "status": order_result["status"],
                "created_at": datetime.now(timezone.utc),
            })

            # Reset savings pool
            await users_collection.update_one(
                {"_id": user["_id"]},
                {"$set": {"savings_pool": 0.0}},
            )

            print(f"[Scheduler] Auto-invested ${pool:.2f} in {asset} for user {user_id}")
        except Exception as e:
            print(f"[Scheduler] Error auto-investing for user {user.get('email')}: {e}")


def poll_transactions_job():
    """Sync wrapper for transaction polling."""
    _run_async(_poll_transactions_for_all_users())


def classify_and_process_job():
    """Sync wrapper for classification and processing."""
    _run_async(_classify_and_process())


def auto_invest_job():
    """Sync wrapper for auto-investing."""
    _run_async(_auto_invest())


def start_scheduler():
    """Start the background scheduler with all jobs."""
    # Poll transactions every 30 minutes
    scheduler.add_job(
        poll_transactions_job,
        "interval",
        minutes=30,
        id="poll_transactions",
        replace_existing=True,
    )

    # Classify and process every 30 minutes (5 min after polling)
    scheduler.add_job(
        classify_and_process_job,
        "interval",
        minutes=30,
        id="classify_and_process",
        replace_existing=True,
    )

    # Auto-invest daily at 10:00 AM UTC
    scheduler.add_job(
        auto_invest_job,
        "cron",
        hour=10,
        minute=0,
        id="auto_invest",
        replace_existing=True,
    )

    scheduler.start()
    print("[Scheduler] Background scheduler started")


def shutdown_scheduler():
    """Shutdown the scheduler gracefully."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        print("[Scheduler] Background scheduler stopped")
