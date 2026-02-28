from fastapi import APIRouter, HTTPException, status, Depends
from bson import ObjectId

from app.database import users_collection
from app.models.user import (
    UserRegister,
    UserLogin,
    UserResponse,
    TokenResponse,
    UpdateRiskProfile,
)
from app.utils.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)

router = APIRouter()


def user_doc_to_response(user: dict) -> UserResponse:
    return UserResponse(
        id=str(user["_id"]),
        email=user["email"],
        name=user["name"],
        risk_profile=user.get("risk_profile", "moderate"),
        savings_pool=user.get("savings_pool", 0.0),
        has_plaid_connected=user.get("plaid_access_token") is not None,
        created_at=user["created_at"],
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(data: UserRegister):
    # Check if user already exists
    existing = await users_collection.find_one({"email": data.email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Create user document
    from datetime import datetime, timezone

    user_doc = {
        "email": data.email,
        "password_hash": hash_password(data.password),
        "name": data.name,
        "risk_profile": "moderate",
        "plaid_access_token": None,
        "plaid_item_id": None,
        "savings_pool": 0.0,
        "preferred_asset": "SPY",
        "created_at": datetime.now(timezone.utc),
    }

    result = await users_collection.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id

    token = create_access_token(str(result.inserted_id), data.email)

    return TokenResponse(
        access_token=token,
        user=user_doc_to_response(user_doc),
    )


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin):
    user = await users_collection.find_one({"email": data.email})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_access_token(str(user["_id"]), user["email"])

    return TokenResponse(
        access_token=token,
        user=user_doc_to_response(user),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return user_doc_to_response(current_user)


@router.put("/risk-profile", response_model=UserResponse)
async def update_risk_profile(
    data: UpdateRiskProfile,
    current_user: dict = Depends(get_current_user),
):
    await users_collection.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"risk_profile": data.risk_profile.value}},
    )
    current_user["risk_profile"] = data.risk_profile.value
    return user_doc_to_response(current_user)
