import random
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional

from app.database import supabase
from app.models.transaction import TransactionResponse, TransactionListResponse, SavingsSummary
from app.services.savings_engine import process_all_unprocessed, process_transaction_savings, get_savings_summary
from app.utils.security import get_current_user

router = APIRouter()


MOCK_MERCHANTS = [
    # (merchant, amount_range, category)
    ("Starbucks", (3.50, 7.50), "discretionary"),
    ("Uber Eats", (12.00, 35.00), "discretionary"),
    ("Netflix", (15.99, 15.99), "discretionary"),
    ("Spotify", (10.99, 10.99), "discretionary"),
    ("Amazon", (15.00, 120.00), "discretionary"),
    ("Nike", (45.00, 180.00), "discretionary"),
    ("Steam", (9.99, 59.99), "discretionary"),
    ("McDonald's", (6.00, 14.00), "discretionary"),
    ("Chipotle", (9.50, 16.00), "discretionary"),
    ("Apple Store", (29.00, 199.00), "discretionary"),
    ("Walmart Grocery", (35.00, 120.00), "essential"),
    ("Costco", (80.00, 250.00), "essential"),
    ("Shell Gas", (25.00, 65.00), "essential"),
    ("CVS Pharmacy", (8.00, 45.00), "essential"),
    ("Metro Transit", (2.75, 2.75), "essential"),
    ("Verizon Wireless", (65.00, 85.00), "essential"),
    ("Electric Company", (60.00, 150.00), "essential"),
    ("Water Utility", (30.00, 55.00), "essential"),
    ("State Farm Insurance", (120.00, 120.00), "essential"),
    ("Planet Fitness", (24.99, 24.99), "essential"),
]


def _random_demo_option():
    """Return one (merchant, amount, category) with random amount in range."""
    merchant, (lo, hi), category = random.choice(MOCK_MERCHANTS)
    amount = round(random.uniform(lo, hi), 2)
    return {"merchant": merchant, "amount": amount, "category": category}


def _demo_options(count: int = 8):
    """Return `count` demo options: half discretionary, half essential, with random amounts."""
    disc = [(m, r, c) for m, r, c in MOCK_MERCHANTS if c == "discretionary"]
    ess = [(m, r, c) for m, r, c in MOCK_MERCHANTS if c == "essential"]
    half = count // 2
    out = []
    for _ in range(half):
        if disc:
            m, (lo, hi), c = random.choice(disc)
            out.append({"merchant": m, "amount": round(random.uniform(lo, hi), 2), "category": c})
    for _ in range(count - half):
        if ess:
            m, (lo, hi), c = random.choice(ess)
            out.append({"merchant": m, "amount": round(random.uniform(lo, hi), 2), "category": c})
    random.shuffle(out)
    return out


@router.get("/demo-options")
async def get_demo_options(
    count: int = 8,
    current_user: dict = Depends(get_current_user),
):
    """Return a pool of demo transaction options (discretionary + essential) with random amounts."""
    options = _demo_options(max(4, min(count, 16)))
    return {"options": options}


@router.get("/", response_model=TransactionListResponse)
async def list_transactions(
    limit: int = 50,
    skip: int = 0,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["id"]

    result = (
        supabase.table("transactions")
        .select("*")
        .eq("user_id", user_id)
        .order("date", desc=True)
        .range(skip, skip + limit - 1)
        .execute()
    )

    transactions = [TransactionResponse(**r) for r in result.data]
    total_savings = sum(r.get("savings_amount") or 0.0 for r in result.data)

    return TransactionListResponse(
        transactions=transactions,
        total_savings=total_savings,
        count=len(transactions),
    )


class AddTransactionRequest(BaseModel):
    merchant: Optional[str] = None
    amount: Optional[float] = None
    category: Optional[str] = None  # "essential" | "discretionary"; default from risk
    date: Optional[str] = None  # YYYY-MM-DD; default today
    process: bool = True  # if True, run savings + auto-invest immediately
    demo: bool = False  # if True, ignore merchant/amount and add a random from MOCK_MERCHANTS


@router.post("/add")
async def add_transaction(
    data: AddTransactionRequest,
    current_user: dict = Depends(get_current_user),
):
    """Add a single transaction for demo. Optionally process it (savings + AI auto-invest) immediately."""
    user_id = current_user["id"]
    if data.demo:
        opt = _random_demo_option()
        merchant, amount, category = opt["merchant"], opt["amount"], opt["category"]
    else:
        merchant = (data.merchant or "").strip()
        amount = data.amount or 0
        category = (data.category or "discretionary").lower()
        if not merchant:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="merchant is required")
        if amount <= 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="amount must be positive")

    now = datetime.now(timezone.utc)
    date = data.date or now.strftime("%Y-%m-%d")
    if not data.demo:
        category = (data.category or "discretionary").lower()
        if category not in ("essential", "discretionary"):
            category = "discretionary"
    else:
        category = category  # already set from _random_demo_option()

    row = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "merchant": merchant.strip(),
        "amount": round(amount, 2),
        "date": date,
        "ai_category": category,
        "processed": False,
        "created_at": now.isoformat(),
    }
    supabase.table("transactions").insert(row).execute()

    result = None
    if data.process:
        result = await process_transaction_savings(row["id"], user_id)

    return {
        "transaction": TransactionResponse(**row),
        "processed": result is not None,
        "savings_added": result.get("savings_amount") if result else None,
        "auto_invested": result.get("auto_invested") if result else None,
        "auto_invest_asset": result.get("auto_invest_asset") if result else None,
    }


@router.post("/process")
async def process_transactions(current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]
    results = await process_all_unprocessed(user_id)
    return {"processed": len(results), "results": results}


@router.get("/savings", response_model=SavingsSummary)
async def savings_summary(current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]
    summary = await get_savings_summary(user_id)
    return SavingsSummary(**summary)


@router.post("/seed")
async def seed_mock_transactions(
    days: int = 30,
    count: int = 40,
    current_user: dict = Depends(get_current_user),
):
    """Generate realistic mock transactions and process them into the savings pool."""
    user_id = current_user["id"]

    existing = (
        supabase.table("transactions")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .execute()
    )
    if existing.count and existing.count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User already has {existing.count} transactions. Delete them first or use a fresh account.",
        )

    now = datetime.now(timezone.utc)
    rows = []
    for _ in range(count):
        merchant, (lo, hi), category = random.choice(MOCK_MERCHANTS)
        amount = round(random.uniform(lo, hi), 2)
        offset_days = random.randint(0, days - 1)
        date = (now - timedelta(days=offset_days)).strftime("%Y-%m-%d")

        rows.append({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "merchant": merchant,
            "amount": amount,
            "date": date,
            "ai_category": category,
            "processed": False,
            "created_at": now.isoformat(),
        })

    supabase.table("transactions").insert(rows).execute()

    results = await process_all_unprocessed(user_id)

    return {
        "seeded": len(rows),
        "processed": len(results),
        "total_savings_added": sum(r["savings_amount"] for r in results),
        "message": f"Created {len(rows)} mock transactions and added savings to pool.",
    }
