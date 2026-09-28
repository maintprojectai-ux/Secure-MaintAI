"""
Security Tests — Role-Based Access Control (RBAC) and Token Verification.

Tests that RBAC policies, token validation rules, and privilege boundaries
are strictly enforced by the backend API.
Per engineering rules Section 8: backend authorization is mandatory.
"""

from datetime import timedelta

import pytest
from httpx import AsyncClient

from backend.core.security import create_access_token


@pytest.mark.asyncio
async def test_access_with_expired_token_is_rejected(
    async_client: AsyncClient,
) -> None:
    """Requests with expired access tokens must be rejected with 401."""
    expired_token = create_access_token(
        subject="user-123",
        role="ADMIN",
        expires_delta=timedelta(seconds=-60),
    )
    response = await async_client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_access_with_malformed_auth_header_is_rejected(
    async_client: AsyncClient,
) -> None:
    """Malformed Authorization headers must be rejected with 401."""
    response = await async_client.get(
        "/api/v1/users/me",
        headers={"Authorization": "InvalidScheme token-value"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_access_with_fake_signature_token_is_rejected(
    async_client: AsyncClient,
) -> None:
    """Tokens signed with a different key must be rejected with 401."""
    fake_token = (
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
        "eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ."
        "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
    )
    response = await async_client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {fake_token}"},
    )
    assert response.status_code == 401
