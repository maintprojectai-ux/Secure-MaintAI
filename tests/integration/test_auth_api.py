"""
Integration Tests — Authentication API.

Tests authentication workflows:
- Token refresh with valid & invalid refresh tokens
- Login request validation
- Password change request validation
- Registration request validation
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_refresh_token_endpoint_rejects_invalid_token(
    async_client: AsyncClient,
) -> None:
    """POST /api/v1/auth/refresh should reject malformed or fake refresh tokens."""
    response = await async_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": "invalid.jwt.token"},
    )
    assert response.status_code == 401
    assert "detail" in response.json()


@pytest.mark.asyncio
async def test_refresh_token_endpoint_rejects_access_token(
    async_client: AsyncClient,
    admin_token: str,
) -> None:
    """POST /api/v1/auth/refresh should reject access token passed as refresh token."""
    response = await async_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": admin_token},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_login_validation_rejects_empty_credentials(
    async_client: AsyncClient,
) -> None:
    """POST /api/v1/auth/login should reject empty username or password."""
    response = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "", "password": ""},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_registration_validation_enforces_password_length(
    async_client: AsyncClient,
) -> None:
    """POST /api/v1/auth/register should reject passwords under 12 characters."""
    response = await async_client.post(
        "/api/v1/auth/register",
        json={
            "username": "valid_user",
            "email": "valid@example.com",
            "password": "short",  # < 12 chars
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_logout_requires_authentication(
    async_client: AsyncClient,
) -> None:
    """POST /api/v1/auth/logout should return 401 if unauthenticated."""
    response = await async_client.post("/api/v1/auth/logout")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_change_password_requires_authentication(
    async_client: AsyncClient,
) -> None:
    """POST /api/v1/auth/change-password should return 401 if unauthenticated."""
    response = await async_client.post(
        "/api/v1/auth/change-password",
        json={
            "current_password": "OldPassword123!",
            "new_password": "NewSecurePassword123!",
        },
    )
    assert response.status_code == 401
