"""
Secure-MaintAI — Authentication API.

Phase 2 implementation:
- Login with access & refresh token rotation
- Token refresh endpoint
- Logout auditing
- Password change with old password verification
- Public registration (defaults to STUDENT role)

Per engineering rules Section 8: authentication and authorization are separate concerns.
Per engineering rules Section 23: login/logout/password events must be audited.
"""

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.core.config import get_settings
from backend.core.database import get_async_session
from backend.core.dependencies import get_current_active_user
from backend.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_password,
    verify_password,
)
from backend.models.user import UserAccount, UserRole
from backend.schemas.user import (
    PasswordChangeRequest,
    RefreshTokenRequest,
    RoleEnum,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserResponse,
)
from backend.services.audit import AuditService

router = APIRouter()


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate a user",
    responses={
        401: {"description": "Invalid credentials"},
        423: {"description": "Account locked"},
    },
)
async def login(
    credentials: UserLogin,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> TokenResponse:
    """
    Authenticate a user with username and password.
    Returns both access token and refresh token on success.
    Enforces brute-force lockout after max attempts.
    """
    settings = get_settings()
    audit = AuditService(session)

    # Find user with role preloaded (support university.edu alias for kku.edu.sa)
    search_identity = credentials.username.strip()
    if search_identity == "admin@university.edu":
        search_identity = "admin@kku.edu.sa"

    result = await session.execute(
        select(UserAccount)
        .options(selectinload(UserAccount.role))
        .where((UserAccount.username == search_identity) | (UserAccount.email == search_identity))
    )
    user = result.scalar_one_or_none()

    if user is None:
        await audit.log(
            actor=credentials.username,
            action="user.login",
            resource=f"user:{credentials.username}",
            source_ip=request.client.host if request.client else None,
            result="failure",
            metadata_={"reason": "user_not_found"},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check account lockout
    if user.status == "locked":
        await audit.log(
            actor=str(user.id),
            action="user.login",
            resource=f"user:{user.id}",
            source_ip=request.client.host if request.client else None,
            result="denied",
            metadata_={"reason": "account_locked"},
        )
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Account is locked. Please contact an administrator.",
        )

    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is {user.status}.",
        )

    # Verify password
    if not verify_password(credentials.password, user.password_hash):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= settings.auth_max_login_attempts:
            user.status = "locked"

        await audit.log(
            actor=credentials.username,
            action="user.login",
            resource=f"user:{user.id}",
            source_ip=request.client.host if request.client else None,
            result="failure",
            metadata_={
                "reason": "invalid_password",
                "attempt": user.failed_login_attempts,
                "locked": user.status == "locked",
            },
        )
        await session.commit()

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    role_name = user.role.name if user.role else "STUDENT"

    # Create tokens
    access_token = create_access_token(
        subject=str(user.id),
        role=role_name,
    )
    refresh_token = create_refresh_token(
        subject=str(user.id),
    )

    # Reset attempts & update last login
    user.last_login_at = datetime.now(timezone.utc)
    user.failed_login_attempts = 0

    await audit.log(
        actor=str(user.id),
        action="user.login",
        resource=f"user:{user.id}",
        source_ip=request.client.host if request.client else None,
        result="success",
    )
    await session.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.auth_jwt_access_token_expire_minutes * 60,
        role=role_name,
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refresh access token",
    responses={
        401: {"description": "Invalid or expired refresh token"},
        403: {"description": "Account not active"},
    },
)
async def refresh_token(
    payload_data: RefreshTokenRequest,
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> TokenResponse:
    """
    Issue a new access token and refresh token using a valid refresh token.
    """
    settings = get_settings()
    payload = decode_refresh_token(payload_data.refresh_token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload.",
        )

    result = await session.execute(
        select(UserAccount).options(selectinload(UserAccount.role)).where(UserAccount.id == user_id)
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists.",
        )

    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is {user.status}.",
        )

    role_name = user.role.name if user.role else "STUDENT"

    new_access_token = create_access_token(
        subject=str(user.id),
        role=role_name,
    )
    new_refresh_token = create_refresh_token(
        subject=str(user.id),
    )

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
        expires_in=settings.auth_jwt_access_token_expire_minutes * 60,
        role=role_name,
    )


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="Log out user and record audit event",
)
async def logout(
    request: Request,
    current_user: Annotated[UserAccount, Depends(get_current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> dict[str, str]:
    """
    Log out the current active user. Logs an audit trail event.
    """
    audit = AuditService(session)
    await audit.log(
        actor=str(current_user.id),
        action="user.logout",
        resource=f"user:{current_user.id}",
        source_ip=request.client.host if request.client else None,
        result="success",
    )
    await session.commit()
    return {"message": "Successfully logged out."}


@router.post(
    "/change-password",
    status_code=status.HTTP_200_OK,
    summary="Change authenticated user password",
    responses={
        400: {"description": "Incorrect current password or invalid new password"},
    },
)
async def change_password(
    data: PasswordChangeRequest,
    request: Request,
    current_user: Annotated[UserAccount, Depends(get_current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> dict[str, str]:
    """
    Change password for the currently logged-in user.
    Requires verification of current password.
    """
    audit = AuditService(session)

    if not verify_password(data.current_password, current_user.password_hash):
        await audit.log(
            actor=str(current_user.id),
            action="user.change_password",
            resource=f"user:{current_user.id}",
            source_ip=request.client.host if request.client else None,
            result="failure",
            metadata_={"reason": "incorrect_current_password"},
        )
        await session.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password.",
        )

    current_user.password_hash = hash_password(data.new_password)

    await audit.log(
        actor=str(current_user.id),
        action="user.change_password",
        resource=f"user:{current_user.id}",
        source_ip=request.client.host if request.client else None,
        result="success",
    )
    await session.commit()
    return {"message": "Password changed successfully."}


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Public user registration (defaults to STUDENT role)",
    responses={
        409: {"description": "Username or email already exists"},
    },
)
async def register(
    user_data: UserCreate,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> UserResponse:
    """
    Register a new user account.
    Public registration is restricted to the STUDENT role.
    """
    audit = AuditService(session)

    # Check username uniqueness
    existing = await session.execute(select(UserAccount).where(UserAccount.username == user_data.username))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already exists.",
        )

    # Check email uniqueness
    existing_email = await session.execute(select(UserAccount).where(UserAccount.email == user_data.email))
    if existing_email.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already exists.",
        )

    # Resolve STUDENT role for public registration
    role_result = await session.execute(select(UserRole).where(UserRole.name == RoleEnum.STUDENT.value))
    role = role_result.scalar_one_or_none()
    if role is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Default STUDENT role is not initialized. Please run seed_roles.",
        )

    # Create user
    new_user = UserAccount(
        username=user_data.username,
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        role_id=role.id,
        status="active",
    )
    session.add(new_user)
    await session.flush()

    await audit.log(
        actor=new_user.username,
        action="user.register",
        resource=f"user:{new_user.id}",
        source_ip=request.client.host if request.client else None,
        result="success",
        metadata_={"role": RoleEnum.STUDENT.value},
    )
    await session.commit()

    return UserResponse(
        id=new_user.id,
        username=new_user.username,
        email=new_user.email,
        role=RoleEnum(role.name),
        status=new_user.status,
        last_login_at=new_user.last_login_at,
        created_at=new_user.created_at,
    )
