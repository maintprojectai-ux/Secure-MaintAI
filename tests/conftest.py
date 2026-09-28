"""
Secure-MaintAI — Test Configuration and Fixtures.

Provides shared fixtures for all test types:
- In-memory settings overrides
- In-memory SQLite async database engine and session
- Fast AsyncClient for integration testing
- Pre-seeded roles and role-specific JWT headers
"""

import os
import sys
from pathlib import Path

# Ensure the project root is on sys.path so both 'backend' and 'ml' packages
# are importable without an editable install.
_PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Set test environment before any app imports
os.environ["APP_ENV"] = "test"
os.environ["APP_SECRET_KEY"] = "test-secret-key-for-testing-only-32chars"
os.environ["AUTH_JWT_SECRET_KEY"] = "test-jwt-secret-key-for-testing-only"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"

import uuid

from backend.core.config import Settings, get_settings
from backend.core.database import get_async_session
from backend.core.security import create_access_token
from backend.models.base import Base
from backend.models.user import UserAccount, UserRole
from backend.schemas.user import RoleEnum

# Test in-memory async SQLite engine and session factory
test_engine = create_async_engine(
    "sqlite+aiosqlite:///:memory:",
    echo=False,
)
TestAsyncSession = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@pytest.fixture
def settings() -> Settings:
    """Provide test settings."""
    return get_settings()


@pytest_asyncio.fixture(autouse=True)
async def setup_test_database() -> AsyncGenerator[None, None]:
    """Create schema in in-memory SQLite and seed basic roles and test users for each test run."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed roles and users into in-memory SQLite
    role_user_map = {
        RoleEnum.ADMIN: ("00000000-0000-0000-0000-000000000001", "admin", "admin@kku.edu.sa"),
        RoleEnum.STUDENT: ("00000000-0000-0000-0000-000000000002", "student", "student@kku.edu.sa"),
        RoleEnum.RESEARCHER: ("00000000-0000-0000-0000-000000000003", "researcher", "researcher@kku.edu.sa"),
        RoleEnum.IT_OPERATOR: ("00000000-0000-0000-0000-000000000004", "operator", "operator@kku.edu.sa"),
    }

    async with TestAsyncSession() as session:
        for role_name in RoleEnum:
            role = UserRole(
                name=role_name.value,
                description=f"{role_name.value} role",
                permissions=[],
            )
            session.add(role)
            await session.flush()

            if role_name in role_user_map:
                u_id, username, email = role_user_map[role_name]
                user = UserAccount(
                    id=uuid.UUID(u_id),
                    username=username,
                    email=email,
                    password_hash="$2b$12$dummyhashfortestingonlyabcdefghijklmnopqrstuv",
                    role_id=role.id,
                    status="active",
                )
                session.add(user)

        await session.commit()

    yield

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


async def override_get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide test async database session."""
    async with TestAsyncSession() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


@pytest_asyncio.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    """
    Provide an async HTTP test client for the FastAPI app.
    Uses ASGI transport with database session override.
    """
    from backend.main import app

    app.dependency_overrides[get_async_session] = override_get_async_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture
def admin_token() -> str:
    """Generate a valid JWT token for an ADMIN user."""
    return create_access_token(
        subject="00000000-0000-0000-0000-000000000001",
        role="ADMIN",
    )


@pytest.fixture
def admin_headers(admin_token: str) -> dict[str, str]:
    """Provide HTTP Authorization headers for ADMIN."""
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def student_token() -> str:
    """Generate a valid JWT token for a STUDENT user."""
    return create_access_token(
        subject="00000000-0000-0000-0000-000000000002",
        role="STUDENT",
    )


@pytest.fixture
def student_headers(student_token: str) -> dict[str, str]:
    """Provide HTTP Authorization headers for STUDENT."""
    return {"Authorization": f"Bearer {student_token}"}


@pytest.fixture
def researcher_token() -> str:
    """Generate a valid JWT token for a RESEARCHER user."""
    return create_access_token(
        subject="00000000-0000-0000-0000-000000000003",
        role="RESEARCHER",
    )


@pytest.fixture
def researcher_headers(researcher_token: str) -> dict[str, str]:
    """Provide HTTP Authorization headers for RESEARCHER."""
    return {"Authorization": f"Bearer {researcher_token}"}


@pytest.fixture
def operator_token() -> str:
    """Generate a valid JWT token for an IT_OPERATOR user."""
    return create_access_token(
        subject="00000000-0000-0000-0000-000000000004",
        role="IT_OPERATOR",
    )


@pytest.fixture
def operator_headers(operator_token: str) -> dict[str, str]:
    """Provide HTTP Authorization headers for IT_OPERATOR."""
    return {"Authorization": f"Bearer {operator_token}"}
