import asyncio
import json
from typing import Optional

import google.generativeai as genai

from app.config import get_settings

settings = get_settings()

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


def _generate_content_sync(prompt: str) -> str:
    """Synchronous Gemini content generation."""
    model = genai.GenerativeModel("gemini-1.5-flash")
    response = model.generate_content(prompt)
    return response.text


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
