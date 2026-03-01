from pathlib import Path

from pydantic_settings import BaseSettings
from functools import lru_cache

# Load .env from backend/ folder (parent of app/) so it's found no matter where you run uvicorn from
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
_ENV_FILE = _BACKEND_ROOT / ".env"


class Settings(BaseSettings):
    # Supabase (use service_role key for backend so RLS doesn't block server-side inserts)
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""  # optional; if set, used for DB client (bypasses RLS)

    # JWT
    JWT_SECRET: str = "change-this-secret-key"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_DAYS: int = 7

    # Plaid
    PLAID_CLIENT_ID: str = ""
    PLAID_SECRET: str = ""
    PLAID_ENV: str = "sandbox"

    # Savings
    SAVINGS_POOL_THRESHOLD: float = 5.0
    DEFAULT_ASSET: str = "BTC"

    # Alpaca (optional – for stock prices; paper keys work)
    ALPACA_API_KEY: str = ""
    ALPACA_SECRET_KEY: str = ""
    ALPACA_BASE_URL: str = "https://paper-api.alpaca.markets"

    # Gemini (transaction classification + investment advice)
    GEMINI_API_KEY: str = ""

    model_config = {
        "env_file": _ENV_FILE,
        "env_file_encoding": "utf-8",
    }


@lru_cache()
def get_settings() -> Settings:
    return Settings()
