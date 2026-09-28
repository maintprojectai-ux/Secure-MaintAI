"""
Unit tests for database seeding scripts (scripts/seed_roles.py and scripts/seed_demo_data.py).
"""

import pytest
from sqlalchemy import select

from backend.models.user import UserAccount, UserRole
from backend.models.workstation import Workstation
from scripts.seed_demo_data import DEMO_USERS, DEMO_WORKSTATIONS, seed_demo_data
from scripts.seed_roles import ROLES, seed_roles
from tests.conftest import TestAsyncSession


@pytest.mark.asyncio
async def test_seed_roles_and_demo_data(monkeypatch):
    """Verify that seed_roles and seed_demo_data execute idempotently and populate records."""
    # Monkeypatch async_session_factory in both scripts to use TestAsyncSession
    monkeypatch.setattr("scripts.seed_roles.async_session_factory", TestAsyncSession)
    monkeypatch.setattr("scripts.seed_demo_data.async_session_factory", TestAsyncSession)

    # 1. Run seed_roles
    await seed_roles()

    async with TestAsyncSession() as session:
        roles_res = await session.execute(select(UserRole))
        roles = roles_res.scalars().all()
        role_names = {r.name for r in roles}
        for r_data in ROLES:
            assert r_data["name"] in role_names

    # 2. Run seed_demo_data
    await seed_demo_data()

    async with TestAsyncSession() as session:
        # Check users
        users_res = await session.execute(select(UserAccount))
        users = users_res.scalars().all()
        usernames = {u.username for u in users}
        for u_data in DEMO_USERS:
            assert u_data["username"] in usernames

        # Check workstations
        ws_res = await session.execute(select(Workstation))
        workstations = ws_res.scalars().all()
        hostnames = {w.hostname for w in workstations}
        for w_data in DEMO_WORKSTATIONS:
            assert w_data["hostname"] in hostnames

    # 3. Test idempotency (run again without error)
    await seed_roles()
    await seed_demo_data()
