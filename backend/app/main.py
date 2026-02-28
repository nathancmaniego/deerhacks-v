from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers import auth


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await init_db()
        print("[Startup] Supabase connected.")
    except Exception as e:
        print(f"\n*** Supabase connection failed: {e}")
        print("   Set SUPABASE_URL and SUPABASE_KEY in backend/.env\n")
    yield


app = FastAPI(
    title="SubConscious Invest API",
    description="Auth-only API; add Plaid/investments later.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["Authentication"])


@app.get("/")
async def root():
    return {"message": "SubConscious Invest API", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
