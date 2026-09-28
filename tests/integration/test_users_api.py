"""
Integration Tests — Users API.

Tests user management endpoints:
- Authentication requirements on all /api/v1/users endpoints
- Request payload validation
"""

import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_users_me_requires_authentication(
    async_client: AsyncClient,
) -> None:
    """GET /api/v1/users/me should return 401 Unauthorized when no token provided."""
    response = await async_client.get("/api/v1/users/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_users_requires_authentication(
    async_client: AsyncClient,
) -> None:
    """GET /api/v1/users should return 401 Unauthorized when no token provided."""
    response = await async_client.get("/api/v1/users")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_user_requires_authentication(
    async_client: AsyncClient,
) -> None:
    """POST /api/v1/users should return 401 Unauthorized when no token provided."""
    response = await async_client.post(
        "/api/v1/users",
        json={
            "username": "new_admin_user",
            "email": "new_admin@example.com",
            "password": "SecurePassword123!",
            "role": "ADMIN",
        },
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_update_user_requires_authentication(
    async_client: AsyncClient,
) -> None:
    """PATCH /api/v1/users/{id} should return 401 Unauthorized when no token provided."""
    random_id = str(uuid.uuid4())
    response = await async_client.patch(
        f"/api/v1/users/{random_id}",
        json={"email": "updated@example.com"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_deactivate_user_requires_authentication(
    async_client: AsyncClient,
) -> None:
    """DELETE /api/v1/users/{id} should return 401 Unauthorized when no token provided."""
    random_id = str(uuid.uuid4())
    response = await async_client.delete(f"/api/v1/users/{random_id}")
    assert response.status_code == 401
