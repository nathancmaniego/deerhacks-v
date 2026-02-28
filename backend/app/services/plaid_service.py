import asyncio
from typing import Optional

import plaid
from plaid.api import plaid_api
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.transactions_sync_request import TransactionsSyncRequest
from plaid.model.products import Products
from plaid.model.country_code import CountryCode

from app.config import get_settings

settings = get_settings()


def get_plaid_client() -> plaid_api.PlaidApi:
    configuration = plaid.Configuration(
        host={
            "sandbox": plaid.Environment.Sandbox,
            "development": plaid.Environment.Development,
            "production": plaid.Environment.Production,
        }.get(settings.PLAID_ENV, plaid.Environment.Sandbox),
        api_key={
            "clientId": settings.PLAID_CLIENT_ID,
            "secret": settings.PLAID_SECRET,
        },
    )
    api_client = plaid.ApiClient(configuration)
    return plaid_api.PlaidApi(api_client)


def _create_link_token_sync(user_id: str) -> str:
    """Synchronous Plaid link token creation."""
    client = get_plaid_client()
    request = LinkTokenCreateRequest(
        products=[Products("transactions")],
        client_name="SubConscious Invest",
        country_codes=[CountryCode("CA"), CountryCode("US")],
        language="en",
        user=LinkTokenCreateRequestUser(client_user_id=user_id),
    )
    response = client.link_token_create(request)
    return response["link_token"]


async def create_link_token(user_id: str) -> str:
    """Create a Plaid Link token for the frontend."""
    return await asyncio.to_thread(_create_link_token_sync, user_id)


def _exchange_public_token_sync(public_token: str) -> dict:
    """Synchronous Plaid public token exchange."""
    client = get_plaid_client()
    request = ItemPublicTokenExchangeRequest(public_token=public_token)
    response = client.item_public_token_exchange(request)
    return {
        "access_token": response["access_token"],
        "item_id": response["item_id"],
    }


async def exchange_public_token(public_token: str) -> dict:
    """Exchange a public token for an access token."""
    return await asyncio.to_thread(_exchange_public_token_sync, public_token)


def _fetch_transactions_sync(access_token: str, cursor: Optional[str] = None) -> dict:
    """Synchronous Plaid transaction fetching."""
    client = get_plaid_client()

    added = []
    has_more = True
    next_cursor = cursor or ""

    while has_more:
        request = TransactionsSyncRequest(
            access_token=access_token,
            cursor=next_cursor,
        )
        response = client.transactions_sync(request)

        added.extend(response["added"])
        has_more = response["has_more"]
        next_cursor = response["next_cursor"]

    transactions = []
    for txn in added:
        transactions.append({
            "plaid_transaction_id": txn["transaction_id"],
            "merchant": txn.get("merchant_name") or txn.get("name", "Unknown"),
            "amount": abs(txn["amount"]),  # Plaid uses positive for debits
            "date": str(txn["date"]),
            "category": txn.get("personal_finance_category", {}).get("primary", "OTHER"),
        })

    return {
        "transactions": transactions,
        "cursor": next_cursor,
    }


async def fetch_transactions(access_token: str, cursor: Optional[str] = None) -> dict:
    """Fetch transactions using Plaid Sync API."""
    return await asyncio.to_thread(_fetch_transactions_sync, access_token, cursor)
