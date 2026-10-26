"""
Secure-MaintAI — User and Authentication Schemas.

Defines the canonical user, role, and authentication contracts.
Per engineering rules Section 8: RBAC with ADMIN, RESEARCHER, STUDENT.
"""

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


class RoleEnum(str, Enum):
    """Canonical user roles per the project report."""

    ADMIN = "ADMIN"
    RESEARCHER = "RESEARCHER"
    STUDENT = "STUDENT"


class UserStatusEnum(str, Enum):
    """User account lifecycle status."""

    ACTIVE = "active"
    LOCKED = "locked"
    SUSPENDED = "suspended"
    INACTIVE = "inactive"


class UserCreate(BaseModel):
    """Schema for public user registration (defaults to STUDENT role)."""

    username: str = Field(..., min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9_-]+$")
    email: EmailStr
    password: str = Field(..., min_length=12, max_length=128)
    role: RoleEnum = RoleEnum.STUDENT


class PasswordChangeRequest(BaseModel):
    """Schema for authenticated user password change."""

    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=12, max_length=128)


class UserLogin(BaseModel):
    """Schema for user login."""

    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class RefreshTokenRequest(BaseModel):
    """Schema for requesting a new access token via refresh token."""

    refresh_token: str = Field(..., min_length=1)


class UserResponse(BaseModel):
    """Schema for user data in API responses. Never exposes password hash."""

    id: UUID
    username: str
    email: str
    full_name: str | None = None
    role: RoleEnum
    status: str
    last_login_at: datetime | None = None
    created_at: datetime

    @field_validator("role", mode="before")
    @classmethod
    def _extract_role_name(cls, v: Any) -> Any:
        if hasattr(v, "name") and not isinstance(v, (str, Enum)):
            return v.name
        return v

    model_config = {"from_attributes": True}


class UserProfileResponse(BaseModel):
    """Schema for current authenticated user profile with active permissions."""

    id: UUID
    username: str
    email: str
    role: RoleEnum
    status: str
    permissions: dict[str, bool] = Field(default_factory=dict)
    last_login_at: datetime | None = None
    created_at: datetime

    @field_validator("role", mode="before")
    @classmethod
    def _extract_role_name(cls, v: Any) -> Any:
        if hasattr(v, "name") and not isinstance(v, (str, Enum)):
            return v.name
        return v

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    """Schema for authentication token response with access and refresh tokens."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="Access token expiration in seconds.")
    role: str


class TokenPayload(BaseModel):
    """Schema for decoded JWT token payload."""

    sub: str
    role: str
    type: str = "access"
