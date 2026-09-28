"""
Secure-MaintAI — Database Role Seeder.

Creates the four canonical roles defined in the project report:
ADMIN, IT_OPERATOR, RESEARCHER, STUDENT.

Usage:
    python scripts/seed_roles.py
"""

import asyncio
import sys
import uuid
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from backend.core.database import async_session_factory
from backend.models.user import UserRole

ROLES = [
    {
        "name": "ADMIN",
        "description": "Full system access: user management, system configuration, security response, reports.",
        "permissions": {
            "users.manage": True,
            "system.configure": True,
            "incidents.manage": True,
            "security.respond": True,
            "reports.read": True,
            "devices.read": True,
            "telemetry.read": True,
            "alerts.manage": True,
            "maintenance.manage": True,
        },
    },
    {
        "name": "IT_OPERATOR",
        "description": "Operational access: device monitoring, telemetry, alerts, incidents, maintenance.",
        "permissions": {
            "devices.read": True,
            "telemetry.read": True,
            "alerts.manage": True,
            "incidents.manage": True,
            "maintenance.manage": True,
        },
    },
    {
        "name": "RESEARCHER",
        "description": "Limited access: own resource read, limited alert visibility.",
        "permissions": {
            "own-resource.read": True,
            "limited-alert.read": True,
        },
    },
    {
        "name": "STUDENT",
        "description": "Minimal access: limited resource read only.",
        "permissions": {
            "limited-resource.read": True,
        },
    },
]


async def seed_roles() -> None:
    """Create the canonical roles if they don't already exist."""
    async with async_session_factory() as session:
        for role_data in ROLES:
            result = await session.execute(
                select(UserRole).where(UserRole.name == role_data["name"])
            )
            existing = result.scalar_one_or_none()

            if existing:
                print(f"  Role '{role_data['name']}' already exists — skipping.")
            else:
                role = UserRole(
                    id=uuid.uuid4(),
                    name=role_data["name"],
                    description=role_data["description"],
                    permissions=role_data["permissions"],
                )
                session.add(role)
                print(f"  Created role: {role_data['name']}")

        await session.commit()
    print("\nRole seeding complete.")


if __name__ == "__main__":
    print("Secure-MaintAI — Seeding roles...")
    asyncio.run(seed_roles())
