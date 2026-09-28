"""
Secure-MaintAI — User Management API.

Endpoints for managing users, role assignments, and inspecting active profile.
Per engineering rules Section 8: backend authorization is mandatory.
Every privileged endpoint must explicitly verify permissions via RBAC dependencies.
Per engineering rules Section 23: all user management actions must generate audit events.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.core.database import get_async_session
from backend.core.dependencies import get_current_active_user, require_permission
from backend.core.security import hash_password
from backend.models.user import UserAccount, UserRole
from backend.schemas.user import (
    RoleEnum,
    UserAdminCreate,
    UserPaginatedResponse,
    UserProfileResponse,
    UserResponse,
    UserUpdate,
)
from backend.services.audit import AuditService

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


@router.get(
    "",
    response_model=UserPaginatedResponse,
    summary="List all users (paginated)",
    dependencies=[Depends(require_permission("users.manage"))],
)
async def list_users(
    session: Annotated[AsyncSession, Depends(get_async_session)],
    page: Annotated[int, Query(ge=1, description="Page number")] = 1,
    page_size: Annotated[int, Query(ge=1, le=100, description="Items per page")] = 20,
    search: Annotated[str | None, Query(description="Search by username or email")] = None,
    role: Annotated[RoleEnum | None, Query(description="Filter by role")] = None,
) -> UserPaginatedResponse:
    """
    List user accounts with pagination and filtering.
    Requires 'users.manage' permission (ADMIN).
    """
    query = select(UserAccount).options(selectinload(UserAccount.role))
    count_query = select(func.count(UserAccount.id))

    if search:
        search_filter = (UserAccount.username.ilike(f"%{search}%")) | (UserAccount.email.ilike(f"%{search}%"))
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    if role:
        role_result = await session.execute(select(UserRole.id).where(UserRole.name == role.value))
        role_id = role_result.scalar_one_or_none()
        if role_id:
            query = query.where(UserAccount.role_id == role_id)
            count_query = count_query.where(UserAccount.role_id == role_id)
        else:
            return UserPaginatedResponse(items=[], total=0, page=page, page_size=page_size, total_pages=0)

    # Total count
    total_result = await session.execute(count_query)
    total = total_result.scalar_one() or 0

    # Paginated results
    offset = (page - 1) * page_size
    query = query.order_by(UserAccount.created_at.desc()).offset(offset).limit(page_size)
    result = await session.execute(query)
    users = result.scalars().all()

    items = [
        UserResponse(
            id=u.id,
            username=u.username,
            email=u.email,
            role=RoleEnum(u.role.name) if u.role else RoleEnum.STUDENT,
            status=u.status,
            last_login_at=u.last_login_at,
            created_at=u.created_at,
        )
        for u in users
    ]

    total_pages = (total + page_size - 1) // page_size if total > 0 else 0

    return UserPaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user with specific role (admin)",
    dependencies=[Depends(require_permission("users.manage"))],
)
async def create_user_admin(
    user_data: UserAdminCreate,
    request: Request,
    current_user: Annotated[UserAccount, Depends(get_current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> UserResponse:
    """
    Administrative creation of user accounts.
    Allows assigning any role and initial status.
    Requires 'users.manage' permission.
    """
    audit = AuditService(session)

    # Check username uniqueness
    existing_username = await session.execute(select(UserAccount).where(UserAccount.username == user_data.username))
    if existing_username.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Username '{user_data.username}' is already in use.",
        )

    # Check email uniqueness
    existing_email = await session.execute(select(UserAccount).where(UserAccount.email == user_data.email))
    if existing_email.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Email '{user_data.email}' is already in use.",
        )

    # Resolve specified role
    role_result = await session.execute(select(UserRole).where(UserRole.name == user_data.role.value))
    role = role_result.scalar_one_or_none()
    if role is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role '{user_data.role.value}' does not exist.",
        )

    # Create account
    new_user = UserAccount(
        username=user_data.username,
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        role_id=role.id,
        status=user_data.status.value,
    )
    session.add(new_user)
    await session.flush()

    await audit.log(
        actor=str(current_user.id),
        action="user.admin_create",
        resource=f"user:{new_user.id}",
        source_ip=request.client.host if request.client else None,
        result="success",
        metadata_={"role": user_data.role.value, "status": user_data.status.value},
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


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    summary="Get user details by ID",
)
async def get_user_by_id(
    user_id: UUID,
    current_user: Annotated[UserAccount, Depends(get_current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> UserResponse:
    """
    Get user by ID.
    Users may view their own record, but viewing others requires 'users.manage' permission.
    """
    # Permission check: own profile OR admin with users.manage
    has_manage_perm = False
    if current_user.role and (
        current_user.role.name == RoleEnum.ADMIN.value
        or (current_user.role.permissions or {}).get("users.manage", False)
    ):
        has_manage_perm = True

    if current_user.id != user_id and not has_manage_perm:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this user account.",
        )

    result = await session.execute(
        select(UserAccount).options(selectinload(UserAccount.role)).where(UserAccount.id == user_id)
    )
    target_user = result.scalar_one_or_none()

    if target_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    return UserResponse(
        id=target_user.id,
        username=target_user.username,
        email=target_user.email,
        role=RoleEnum(target_user.role.name) if target_user.role else RoleEnum.STUDENT,
        status=target_user.status,
        last_login_at=target_user.last_login_at,
        created_at=target_user.created_at,
    )


@router.patch(
    "/{user_id}",
    response_model=UserResponse,
    summary="Update user details, role, or status (admin)",
    dependencies=[Depends(require_permission("users.manage"))],
)
async def update_user(
    user_id: UUID,
    update_data: UserUpdate,
    request: Request,
    current_user: Annotated[UserAccount, Depends(get_current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> UserResponse:
    """
    Update user role, account status, or email.
    Requires 'users.manage' permission.
    """
    audit = AuditService(session)

    result = await session.execute(
        select(UserAccount).options(selectinload(UserAccount.role)).where(UserAccount.id == user_id)
    )
    target_user = result.scalar_one_or_none()

    if target_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    changes: dict[str, str] = {}

    if update_data.email and update_data.email != target_user.email:
        # Check email uniqueness
        existing_email = await session.execute(
            select(UserAccount).where(UserAccount.email == update_data.email, UserAccount.id != user_id)
        )
        if existing_email.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email is already in use by another account.",
            )
        changes["email"] = f"{target_user.email} -> {update_data.email}"
        target_user.email = update_data.email

    if update_data.role:
        role_result = await session.execute(select(UserRole).where(UserRole.name == update_data.role.value))
        new_role = role_result.scalar_one_or_none()
        if new_role is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Role '{update_data.role.value}' does not exist.",
            )
        old_role = target_user.role.name if target_user.role else "NONE"
        changes["role"] = f"{old_role} -> {update_data.role.value}"
        target_user.role_id = new_role.id
        target_user.role = new_role

    if update_data.status:
        changes["status"] = f"{target_user.status} -> {update_data.status.value}"
        target_user.status = update_data.status.value

    await audit.log(
        actor=str(current_user.id),
        action="user.update",
        resource=f"user:{target_user.id}",
        source_ip=request.client.host if request.client else None,
        result="success",
        metadata_={"changes": changes},
    )
    await session.commit()

    return UserResponse(
        id=target_user.id,
        username=target_user.username,
        email=target_user.email,
        role=RoleEnum(target_user.role.name) if target_user.role else RoleEnum.STUDENT,
        status=target_user.status,
        last_login_at=target_user.last_login_at,
        created_at=target_user.created_at,
    )


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_200_OK,
    summary="Deactivate a user account (admin)",
    dependencies=[Depends(require_permission("users.manage"))],
)
async def deactivate_user(
    user_id: UUID,
    request: Request,
    current_user: Annotated[UserAccount, Depends(get_current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> dict[str, str]:
    """
    Deactivate a user account (sets status='inactive').
    Prevents self-deactivation. Requires 'users.manage' permission.
    """
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own user account.",
        )

    audit = AuditService(session)

    result = await session.execute(select(UserAccount).where(UserAccount.id == user_id))
    target_user = result.scalar_one_or_none()

    if target_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    target_user.status = "inactive"

    await audit.log(
        actor=str(current_user.id),
        action="user.deactivate",
        resource=f"user:{target_user.id}",
        source_ip=request.client.host if request.client else None,
        result="success",
    )
    await session.commit()

    return {"message": f"User '{target_user.username}' has been deactivated."}
