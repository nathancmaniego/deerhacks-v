from contextlib import asynccontextmanager

import pymongo
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db
from app.routers import auth


def _redact_uri(uri: str) -> str:
    """Hide password in URI for safe logging."""
    if "@" in uri and "://" in uri:
        scheme, rest = uri.split("://", 1)
        if "@" in rest:
            user_part, host_part = rest.rsplit("@", 1)
            user = user_part.split(":")[0] if ":" in user_part else user_part
            return f"{scheme}://{user}:****@{host_part}"
    return uri[:50] + "..." if len(uri) > 50 else uri


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: connect to DB and create indexes. If MongoDB is down, app still starts.
    try:
        await init_db()
        print("[Startup] MongoDB connected and indexes ready.")
    except pymongo.errors.ServerSelectionTimeoutError:
        uri = get_settings().MONGODB_URI
        print("\n*** MongoDB connection failed. URI in use:", _redact_uri(uri))
        if "mongodb.net" in uri:
            print("   Atlas? Check: Network Access → Add IP → Allow from anywhere (0.0.0.0/0) for dev.")
        else:
            print("   Set MONGODB_URI in backend/.env and restart the server.\n")

    yield
    # Shutdown: nothing to do for now


app = FastAPI(
    title="SubConscious Invest API",
    description="Auth-only API; add Plaid/investments later.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth only for now
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])


@app.get("/")
async def root():
    return {"message": "SubConscious Invest API", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
