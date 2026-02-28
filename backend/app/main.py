from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers import auth, plaid, transactions, investments, ai


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()

    # Import and start scheduler
    from app.services.scheduler import start_scheduler, shutdown_scheduler
    start_scheduler()

    yield

    # Shutdown
    shutdown_scheduler()


app = FastAPI(
    title="SubConscious Invest API",
    description="Automated savings and investment platform",
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

# Routers
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(plaid.router, prefix="/plaid", tags=["Plaid"])
app.include_router(transactions.router, prefix="/transactions", tags=["Transactions"])
app.include_router(investments.router, prefix="/investments", tags=["Investments"])
app.include_router(ai.router, prefix="/ai", tags=["AI"])


@app.get("/")
async def root():
    return {"message": "SubConscious Invest API", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
