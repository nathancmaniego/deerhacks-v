from urllib.parse import urlparse

from motor.motor_asyncio import AsyncIOMotorClient
from app.config import get_settings

settings = get_settings()

client = AsyncIOMotorClient(settings.MONGODB_URI)

# Extract database name from URI, fall back to default
_parsed = urlparse(settings.MONGODB_URI)
_db_name = _parsed.path.lstrip("/").split("?")[0] or "subconscious_invest"
db = client[_db_name]

# Collections
users_collection = db["users"]
transactions_collection = db["transactions"]
investments_collection = db["investments"]


async def init_db():
    """Create indexes for collections."""
    await users_collection.create_index("email", unique=True)
    await transactions_collection.create_index("user_id")
    await transactions_collection.create_index("plaid_transaction_id", unique=True, sparse=True)
    await investments_collection.create_index("user_id")
