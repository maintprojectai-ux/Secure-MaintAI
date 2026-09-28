"""
Secure-MaintAI — User and Role Models.

Per implementation plan Section 5: user_role and user_account tables.
Per engineering rules Section 8: RBAC with ADMIN, IT_OPERATOR, RESEARCHER, STUDENT.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from backend.models.lookup import Department


class UserRole(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Role definition for RBAC."""

    __tablename__ = "user_role"

    name: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    permissions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    permission_level: Mapped[int] = mapped_column(Integer, server_default="1", default=1)

    # Relationships
    users: Mapped[list["UserAccount"]] = relationship("UserAccount", back_populates="role", lazy="selectin")

    @property
    def role_name(self) -> str:
        """Alias for role name."""
        return self.name

    def __repr__(self) -> str:
        return f"<UserRole(name='{self.name}')>"


class UserAccount(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """User account for authentication and authorization."""

    __tablename__ = "user_account"

    external_id: Mapped[str | None] = mapped_column(
        String(256), unique=True, nullable=True, comment="IdP external user identifier"
    )
    university_id: Mapped[str | None] = mapped_column(
        String(30), unique=True, nullable=True, comment="University ID or staff/student number"
    )
    full_name: Mapped[str | None] = mapped_column(String(150), nullable=True, comment="User full name")
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(256), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    role_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("user_role.id"),
        nullable=False,
    )
    department_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("department.id"),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="active",
        comment="Account status: active, inactive, locked, suspended",
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failed_login_attempts: Mapped[int] = mapped_column(default=0)

    # Relationships
    role: Mapped["UserRole"] = relationship("UserRole", back_populates="users", lazy="selectin")
    department: Mapped["Department | None"] = relationship("Department", lazy="selectin")

    def __repr__(self) -> str:
        return f"<UserAccount(username='{self.username}')>"
