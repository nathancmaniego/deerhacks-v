from app.database import supabase
from app.config import get_settings
from app.services.auto_invest import trigger_auto_invest

settings = get_settings()

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
    txn_result = supabase.table("transactions").select("*").eq("id", transaction_id).execute()
    if not txn_result.data:
        return None
    txn = txn_result.data[0]
    if txn.get("processed"):
        return None

    user_result = supabase.table("users").select("*").eq("id", user_id).execute()
    if not user_result.data:
        return None
    user = user_result.data[0]

    risk_profile = user.get("risk_profile", "moderate")

    savings_amount, pct_used = calculate_savings_amount(
        transaction_amount=txn["amount"],
        savings_pct=txn.get("savings_pct"),
        ai_category=txn.get("ai_category"),
        risk_profile=risk_profile,
    )

    supabase.table("transactions").update({
        "savings_amount": savings_amount,
        "savings_pct": pct_used,
        "processed": True,
    }).eq("id", transaction_id).execute()

    current_pool = user.get("savings_pool", 0.0) or 0.0
    new_pool = current_pool + savings_amount
    supabase.table("users").update({"savings_pool": new_pool}).eq("id", user_id).execute()

    # Auto-invest: whenever we added any savings and pool has at least $1, invest (min $1 so it shows)
    auto_invest_result = None
    if savings_amount > 0 and new_pool >= 1.0:
        try:
            auto_invest_result = await trigger_auto_invest(
                user_id=user_id,
                savings_amount=savings_amount,
                current_pool=new_pool,
                risk_profile=risk_profile,
            )
            if auto_invest_result:
                new_pool = new_pool - (auto_invest_result.get("amount_invested") or 0)
        except Exception as e:
            print(f"Auto-invest skipped: {e}")

    return {
        "transaction_id": transaction_id,
        "savings_amount": savings_amount,
        "savings_pct": pct_used,
        "new_pool_balance": new_pool,
        "auto_invested": auto_invest_result is not None,
        "auto_invest_asset": auto_invest_result.get("asset") if auto_invest_result else None,
    }


async def process_all_unprocessed(user_id: str) -> list[dict]:
    result = (
        supabase.table("transactions")
        .select("*")
        .eq("user_id", user_id)
        .eq("processed", False)
        .execute()
    )

    results = []
    for txn in result.data:
        r = await process_transaction_savings(txn["id"], user_id)
        if r:
            results.append(r)
    return results


async def get_savings_summary(user_id: str) -> dict:
    user_result = supabase.table("users").select("savings_pool").eq("id", user_id).execute()
    pool = user_result.data[0]["savings_pool"] if user_result.data else 0.0
    pool = pool or 0.0

    txn_result = (
        supabase.table("transactions")
        .select("date, savings_amount")
        .eq("user_id", user_id)
        .eq("processed", True)
        .order("date")
        .execute()
    )

    total_saved = 0.0
    history_map: dict[str, dict] = {}
    for r in txn_result.data:
        amt = r.get("savings_amount") or 0.0
        total_saved += amt
        d = r["date"]
        if d not in history_map:
            history_map[d] = {"date": d, "amount": 0.0, "transactions": 0}
        history_map[d]["amount"] += amt
        history_map[d]["transactions"] += 1

    inv_result = (
        supabase.table("investments")
        .select("amount_invested")
        .eq("user_id", user_id)
        .eq("status", "filled")
        .execute()
    )
    total_invested = sum(r["amount_invested"] for r in inv_result.data)

    return {
        "total_saved": total_saved,
        "savings_pool": pool,
        "total_invested": total_invested,
        "savings_history": list(history_map.values()),
    }
