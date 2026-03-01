import asyncio
import json
from typing import Optional

import google.generativeai as genai

from app.config import get_settings

settings = get_settings()
if getattr(settings, "GEMINI_API_KEY", None):
    genai.configure(api_key=settings.GEMINI_API_KEY)


CLASSIFICATION_PROMPT = """You are a financial AI assistant that classifies spending transactions and recommends savings percentages.

The user has a risk profile of: {risk_profile}
- "chill": Conservative saver, savings range 2-5% per transaction
- "moderate": Balanced saver, savings range 5-10% per transaction  
- "aggressive": Aggressive saver, savings range 8-15% per transaction

Context about the user's upcoming financial obligations:
{cash_flow_context}

Classify each transaction below as either "essential" (bills, groceries, rent, utilities, insurance, medical, transportation) or "discretionary" (dining out, entertainment, shopping, subscriptions, luxury items, coffee shops).

For essential transactions, use the LOWER end of the savings range.
For discretionary transactions, use the HIGHER end of the savings range.
If the user has upcoming bills, slightly reduce the savings percentages to maintain liquidity.

Transactions to classify:
{transactions}

Respond with ONLY a valid JSON array. Each element should have:
- "transaction_id": the transaction ID provided
- "category": "essential" or "discretionary"  
- "recommended_pct": a number (the percentage to save, e.g. 5 means 5%)
- "reasoning": a brief one-sentence explanation

Example response:
[{{"transaction_id": "abc123", "category": "discretionary", "recommended_pct": 10, "reasoning": "Coffee shop purchase is discretionary spending"}}]
"""


# Model IDs (tried in order; next used if one 404s or hits quota). Single-item tuple needs trailing comma.
GEMINI_MODELS = ("gemini-2.5-flash-lite","gemini-2.5-flash")

def _generate_content_sync(prompt: str, max_tokens: int = 256) -> str:
    last_error = None
    # Try with and without the "models/" prefix if needed
    for model_id in GEMINI_MODELS:
        try:
            # Tip: Some environments prefer the full path 'models/gemini-2.5-flash-lite'
            model = genai.GenerativeModel(model_id) 
            response = model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    max_output_tokens=max_tokens,
                    response_mime_type="application/json" # Force JSON natively
                ),
            )
            return response.text
        except Exception as e:
            last_error = e
            # Only continue to the next model if it's a 404 'Not Found' error
            if "404" in str(e) or "not found" in str(e).lower():
                print(f"Model {model_id} not found, trying next...")
                continue
            raise # Re-raise if it's a 401 (Auth) or 429 (Rate Limit)
            
    raise last_error or RuntimeError("No Gemini models available")


INVESTMENT_ADVICE_PROMPT = """You are a concise investment assistant. Given the user's balance and risk profile, suggest how to allocate their cash (savings_pool) into investments.

Risk profiles:
- chill: Prefer stable assets (SPY, maybe some SOL). Lower crypto %, higher stock %.
- moderate: Balanced mix of stocks (SPY, AAPL) and some crypto (SOL).
- aggressive: Willing to take more risk; can suggest more crypto (SOL, BONK) and growth stocks.

User context:
- Total balance: ${total_balance:.2f}
- Cash available to invest: ${savings_pool:.2f}
- Current holdings: {holdings_summary}
- Risk profile: {risk_profile}

Available: stocks (e.g. SPY, AAPL, NVDA) and Solana crypto (SOL, BONK, JUP, WIF, POPCAT).

Reply with ONLY a valid JSON object (no markdown, no extra text):
{{"advice": "One short paragraph (1-2 sentences) of what to do with their cash.", "suggestions": [{{"asset": "SPY", "asset_type": "stock", "amount_pct": 50, "reason": "Brief reason"}}, ...]}}

Limit to 2-4 suggestions. amount_pct is percentage of their available cash to put in that asset. Keep advice under 2 sentences."""


async def classify_transactions(
    transactions: list[dict],
    risk_profile: str = "moderate",
    upcoming_bills: Optional[list[dict]] = None,
) -> list[dict]:
    """
    Use Gemini to classify transactions and recommend savings percentages.
    """
    if not transactions:
        return []

    # Build transaction text
    txn_text = ""
    for txn in transactions:
        txn_text += f"- ID: {txn['id']}, Merchant: {txn['merchant']}, Amount: ${txn['amount']:.2f}, Date: {txn['date']}"
        if txn.get("plaid_category"):
            txn_text += f", Plaid Category: {txn['plaid_category']}"
        txn_text += "\n"

    # Build cash flow context
    if upcoming_bills:
        cash_flow_text = "Upcoming bills/obligations:\n"
        for bill in upcoming_bills:
            cash_flow_text += f"- {bill['merchant']}: ${bill['amount']:.2f} on {bill['date']}\n"
    else:
        cash_flow_text = "No specific upcoming bills identified."

    prompt = CLASSIFICATION_PROMPT.format(
        risk_profile=risk_profile,
        cash_flow_context=cash_flow_text,
        transactions=txn_text,
    )

    try:
        response_text = await asyncio.to_thread(_generate_content_sync, prompt)
        response_text = response_text.strip()

        # Remove markdown code fences if present
        if response_text.startswith("```"):
            response_text = response_text.split("\n", 1)[1]
            response_text = response_text.rsplit("```", 1)[0]

        classifications = json.loads(response_text)
        return classifications

    except json.JSONDecodeError:
        # Fallback: return default classifications
        return _fallback_classify(transactions, risk_profile)
    except Exception as e:
        print(f"Gemini API error: {e}")
        return _fallback_classify(transactions, risk_profile)


async def get_investment_advice(
    total_balance: float,
    savings_pool: float,
    risk_profile: str,
    holdings_summary: str = "None",
) -> dict:
    """
    Get a short Gemini-powered allocation suggestion. Returns { advice, suggestions }.
    Falls back to a static suggestion if Gemini is unavailable.
    """
    if not getattr(settings, "GEMINI_API_KEY", None):
        return _fallback_advice(risk_profile, savings_pool)

    prompt = INVESTMENT_ADVICE_PROMPT.format(
        total_balance=total_balance,
        savings_pool=savings_pool,
        holdings_summary=holdings_summary,
        risk_profile=risk_profile,
    )
    try:
        response_text = await asyncio.to_thread(_generate_content_sync, prompt, max_tokens=320)
        response_text = response_text.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("\n", 1)[1].rsplit("```", 1)[0]
        data = json.loads(response_text)
        if isinstance(data.get("suggestions"), list) and isinstance(data.get("advice"), str):
            return data
    except (json.JSONDecodeError, Exception) as e:
        print(f"Gemini advice error: {e}")
    return _fallback_advice(risk_profile, savings_pool)


def _fallback_advice(risk_profile: str, savings_pool: float) -> dict:
    """Static suggestion when Gemini is not configured or fails."""
    pct = min(70, 40 + (20 if risk_profile == "moderate" else 30 if risk_profile == "aggressive" else 10))
    return {
        "advice": f"With a {risk_profile} profile, consider investing up to {pct}% of your cash in a mix of SPY (stocks) and SOL (crypto). Start with SPY for stability.",
        "suggestions": [
            {"asset": "SPY", "asset_type": "stock", "amount_pct": min(60, pct + 10), "reason": "Broad market, lower volatility"},
            {"asset": "SOL", "asset_type": "crypto", "amount_pct": max(10, pct - 50), "reason": "Solana ecosystem"},
        ],
    }


def _fallback_classify(transactions: list[dict], risk_profile: str) -> list[dict]:
    """Fallback classification when Gemini is unavailable."""
    # Simple keyword-based classification
    essential_keywords = [
        "grocery", "supermarket", "gas", "fuel", "pharmacy", "medical",
        "insurance", "utility", "electric", "water", "rent", "mortgage",
        "transit", "transport", "telecom", "phone", "internet",
    ]

    pct_ranges = {
        "chill": {"essential": 2, "discretionary": 5},
        "moderate": {"essential": 5, "discretionary": 10},
        "aggressive": {"essential": 8, "discretionary": 15},
    }
    pcts = pct_ranges.get(risk_profile, pct_ranges["moderate"])

    results = []
    for txn in transactions:
        merchant_lower = txn["merchant"].lower()
        is_essential = any(kw in merchant_lower for kw in essential_keywords)
        category = "essential" if is_essential else "discretionary"

        results.append({
            "transaction_id": txn["id"],
            "category": category,
            "recommended_pct": pcts[category],
            "reasoning": f"{'Essential' if is_essential else 'Discretionary'} spending based on merchant name",
        })

    return results
