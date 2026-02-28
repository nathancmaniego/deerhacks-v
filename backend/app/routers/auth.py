from fastapi import APIRouter, HTTPException, status, Depends
from postgrest.exceptions import APIError

from app.database import supabase
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


def row_to_response(row: dict) -> UserResponse:
    return UserResponse(
        id=row["id"],
        email=row["email"],
        name=row["name"],
        risk_profile=row.get("risk_profile", "moderate"),
        savings_pool=row.get("savings_pool", 0.0),
        has_plaid_connected=row.get("plaid_access_token") is not None,
        created_at=row["created_at"],
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(data: UserRegister):
    existing = supabase.table("users").select("id").eq("email", data.email).execute()
    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    user_row = {
        "email": data.email,
        "password_hash": hash_password(data.password),
        "name": data.name,
        "risk_profile": "moderate",
        "savings_pool": 0.0,
        "preferred_asset": "BTC",
    }

    try:
        result = supabase.table("users").insert(user_row).execute()
    except APIError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database error: {e.message}",
        )

    user = result.data[0]
    token = create_access_token(user["id"], data.email)

    return TokenResponse(
        access_token=token,
        user=row_to_response(user),
    )


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin):
    result = supabase.table("users").select("*").eq("email", data.email).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    user = result.data[0]
    if not verify_password(data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_access_token(user["id"], user["email"])

    return TokenResponse(
        access_token=token,
        user=row_to_response(user),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return row_to_response(current_user)


@router.put("/risk-profile", response_model=UserResponse)
async def update_risk_profile(
    data: UpdateRiskProfile,
    current_user: dict = Depends(get_current_user),
):
    supabase.table("users").update(
        {"risk_profile": data.risk_profile.value}
    ).eq("id", current_user["id"]).execute()

    current_user["risk_profile"] = data.risk_profile.value
    return row_to_response(current_user)
