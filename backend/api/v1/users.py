"""
Secure-MaintAI — User Profile API.

Provides endpoints for inspecting active profile and permissions.
"""

from typing import Annotated

from fastapi import APIRouter, Depends

from backend.core.dependencies import get_current_active_user
from backend.models.user import UserAccount
from backend.schemas.user import RoleEnum, UserProfileResponse

router = APIRouter()


@router.get(
    "/me",
    response_model=UserProfileResponse,
    summary="Get current user profile and active permissions",
)
async def get_my_profile(
    current_user: Annotated[UserAccount, Depends(get_current_active_user)],
) -> UserProfileResponse:
    """
    Retrieve details and effective permissions for the currently authenticated user.
    """
    role_name = current_user.role.name if current_user.role else "STUDENT"
    permissions = current_user.role.permissions if current_user.role and current_user.role.permissions else {}

    return UserProfileResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        role=RoleEnum(role_name),
        status=current_user.status,
        permissions=permissions,
        last_login_at=current_user.last_login_at,
        created_at=current_user.created_at,
    )
