"""
Secure-MaintAI — Department and Location Lookup Models.

Supports academic organizational hierarchy.
"""

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Department(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Academic/administrative department entity."""

    __tablename__ = "department"

    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)


class Location(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Physical campus location entity."""

    __tablename__ = "location"

    building: Mapped[str] = mapped_column(String(80), nullable=False)
    floor: Mapped[int | None] = mapped_column(Integer, nullable=True)
    room: Mapped[str | None] = mapped_column(String(40), nullable=True)
