"""
Integration Tests — Users API.

Tests user profile endpoints:
- Authentication requirements on /api/v1/users/me
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_users_me_requires_authentication(
    async_client: AsyncClient,
) -> None:
    """GET /api/v1/users/me should return 401 Unauthorized when no token provided."""
    response = await async_client.get("/api/v1/users/me")
    assert response.status_code == 401

