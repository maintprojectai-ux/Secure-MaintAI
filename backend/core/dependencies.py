"""
Secure-MaintAI — FastAPI Dependency Injection.

Provides reusable dependencies for database sessions, authentication,
and role-based authorization.

Per engineering rules Section 8: backend authorization is mandatory.
Every privileged endpoint must explicitly verify permissions.
"""

from collections.abc import Callable
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.core.database import get_async_session
from backend.core.security import decode_access_token
from backend.models.user import UserAccount
from backend.schemas.user import RoleEnum, TokenPayload

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> UserAccount:
    """
    Extract and validate the current user from the JWT token.

    Raises:
        HTTPException 401 if the token is invalid or user not found.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    user_id_raw = payload.get("sub")
    if user_id_raw is None:
        raise credentials_exception

    try:
        user_id = UUID(str(user_id_raw))
    except (ValueError, TypeError, AttributeError):
        raise credentials_exception from None

    result = await session.execute(
        select(UserAccount).options(selectinload(UserAccount.role)).where(UserAccount.id == user_id)
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    return user


async def get_current_active_user(
    user: Annotated[UserAccount, Depends(get_current_user)],
) -> UserAccount:
    """
    Ensure the current user is active.

    Raises:
        HTTPException 403 if the user account is locked, suspended, or inactive.
    """
    if user.status == "locked":
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Account is locked. Please contact an administrator.",
        )
    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is {user.status}.",
        )
    return user


async def get_current_user_with_role(
    user: Annotated[UserAccount, Depends(get_current_active_user)],
) -> TokenPayload:
    """
    Get the current active user's token payload with resolved role name.

    Returns:
        TokenPayload with user ID and role.
    """
    role_name = user.role.name if user.role else "UNKNOWN"

    return TokenPayload(
        sub=str(user.id),
        role=role_name,
    )


def require_role(*allowed_roles: RoleEnum | list[RoleEnum]) -> Callable:
    """
    Create a dependency that enforces role-based access control.

    Usage:
        @router.get("/admin-only", dependencies=[Depends(require_role(RoleEnum.ADMIN))])

    Args:
        allowed_roles: One or more roles that are permitted access.

    Returns:
        A FastAPI dependency function returning the active UserAccount.
    """
    flattened_roles: list[str] = []
    for r in allowed_roles:
        if isinstance(r, list):
            flattened_roles.extend([x.value if isinstance(x, RoleEnum) else str(x) for x in r])
        elif isinstance(r, RoleEnum):
            flattened_roles.append(r.value)
        else:
            flattened_roles.append(str(r))

    async def _role_checker(
        current_user: Annotated[UserAccount, Depends(get_current_active_user)],
    ) -> UserAccount:
        role_name = current_user.role.name if current_user.role else "UNKNOWN"
        if role_name not in flattened_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{role_name}' does not have permission for this action.",
            )
        return current_user

    return _role_checker


# Alias for backward and plural compatibility
require_roles = require_role


def require_permission(*required_permissions: str) -> Callable:
    """
    Create a dependency that enforces granular permission checking from user_role.

    Usage:
        @router.get("/users", dependencies=[Depends(require_permission("users.manage"))])

    Args:
        required_permissions: One or more permissions required to access the endpoint.

    Returns:
        A FastAPI dependency function returning the active UserAccount.
    """

    async def _permission_checker(
        current_user: Annotated[UserAccount, Depends(get_current_active_user)],
    ) -> UserAccount:
        # ADMIN role has superuser override for all permissions
        if current_user.role and current_user.role.name == RoleEnum.ADMIN.value:
            return current_user

        user_permissions = current_user.role.permissions if current_user.role and current_user.role.permissions else {}

        missing = [perm for perm in required_permissions if not user_permissions.get(perm, False)]

        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required permission(s): {', '.join(missing)}.",
            )

        return current_user

    return _permission_checker
