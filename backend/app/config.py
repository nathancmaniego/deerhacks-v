from pathlib import Path

from pydantic_settings import BaseSettings
from functools import lru_cache

# Load .env from backend/ folder (parent of app/) so it's found no matter where you run uvicorn from
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
_ENV_FILE = _BACKEND_ROOT / ".env"


class Settings(BaseSettings):
    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""

    # JWT
    JWT_SECRET: str = "change-this-secret-key"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_DAYS: int = 7

    # Plaid
    PLAID_CLIENT_ID: str = ""
    PLAID_SECRET: str = ""
    PLAID_ENV: str = "sandbox"

    # Alpaca
    ALPACA_API_KEY: str = ""
    ALPACA_SECRET_KEY: str = ""
    ALPACA_BASE_URL: str = "https://paper-api.alpaca.markets"

    # Gemini
    GEMINI_API_KEY: str = ""

    # Savings
    SAVINGS_POOL_THRESHOLD: float = 5.0
    DEFAULT_ASSET: str = "SPY"

    model_config = {
        "env_file": _ENV_FILE,
        "env_file_encoding": "utf-8",
    }


@lru_cache()
def get_settings() -> Settings:
    return Settings()
