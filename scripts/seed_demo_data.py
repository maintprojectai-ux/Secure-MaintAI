"""
Secure-MaintAI — Minimal Foundational Database Seeder.

Reseeds the database cleanly and deterministically with only foundational entities:
1. Purges all system-generated operational records (Alerts, Incidents, Anomalies,
   Security Events, Telemetry Metrics, Audit Logs, and Workstations) so the platform starts clean.
2. Seeds the 3 canonical RBAC roles (ADMIN, RESEARCHER, STUDENT).
3. Seeds the essential University Departments and Campus Locations.
4. Seeds the 3 core RBAC login accounts (admin, researcher, student).
5. Workstations: 0 pre-seeded devices; workstations enroll dynamically at runtime via agent.

No alerts, incidents, anomalies, security events, telemetry, or workstations are pre-seeded;
all operational and fleet records are generated dynamically by the system at runtime.

Usage:
    python -m scripts.seed_demo_data
"""

import asyncio
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

# Ensure project root is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import delete, select

from backend.core.database import async_session_factory
from backend.core.security import hash_password
from backend.models.alert import Alert
from backend.models.anomaly import AnomalyDetection
from backend.models.audit import AuditLog
from backend.models.incident import Incident
from backend.models.lookup import Department, Location
from backend.models.security_event import SecurityEvent
from backend.models.telemetry import TelemetryMetric
from backend.models.user import UserAccount, UserRole
from backend.models.workstation import Workstation
from backend.schemas.user import RoleEnum
from scripts.seed_roles import seed_roles

DEMO_DEPARTMENTS = [
    {"name": "Computer Science", "code": "CS"},
    {"name": "Physics & Advanced Computing", "code": "PHYS"},
    {"name": "IT Services", "code": "IT"},
]

DEMO_LOCATIONS = [
    {"building": "Computer Science Building", "floor": 3, "room": "Undergraduate Lab 301"},
    {"building": "Science & AI Research Complex", "floor": 3, "room": "Quantum Computing Lab"},
    {"building": "Administration Building", "floor": 4, "room": "Security Operations Center"},
]

DEMO_USERS = [
    {
        "username": "admin",
        "email": "admin@kku.edu.sa",
        "password": "AdminSecure2026!",
        "role_name": RoleEnum.ADMIN.value,
        "external_id": "idp:kku:admin01",
        "university_id": "KKU-STAFF-1001",
        "full_name": "Dr. Abdullah Al-Qahtani",
        "department_code": "IT",
    },
    {
        "username": "researcher",
        "email": "researcher@kku.edu.sa",
        "password": "ResearcherSecure2026!",
        "role_name": RoleEnum.RESEARCHER.value,
        "external_id": "idp:kku:res01",
        "university_id": "KKU-FAC-2041",
        "full_name": "Dr. Sara Al-Zahrani",
        "department_code": "PHYS",
    },
    {
        "username": "student",
        "email": "student@kku.edu.sa",
        "password": "StudentSecure2026!",
        "role_name": RoleEnum.STUDENT.value,
        "external_id": "idp:kku:stu01",
        "university_id": "KKU-STU-441092",
        "full_name": "Tariq Al-Shahrani",
        "department_code": "CS",
    },
]

DEMO_WORKSTATIONS: list[dict] = []


async def seed_demo_data() -> None:
    """Cleanly reseed roles, lookup tables, and core RBAC users (0 pre-seeded workstations)."""
    await seed_roles()

    async with async_session_factory() as session:
        # 0. Clean all system-generated operational records and orphan workstations
        print("\n--- Purging System-Generated Operational Records & Existing Workstations ---")
        for model in [Alert, Incident, SecurityEvent, AnomalyDetection, TelemetryMetric, AuditLog]:
            await session.execute(delete(model))

        canonical_hostnames = {w["hostname"] for w in DEMO_WORKSTATIONS}
        all_ws = (await session.execute(select(Workstation))).scalars().all()
        for ws in all_ws:
            if ws.hostname not in canonical_hostnames:
                print(f"  [-] Removing workstation: {ws.hostname} ({ws.ip_address})")
                await session.delete(ws)
        await session.flush()

        # Remove extra non-canonical user accounts after workstations are unlinked
        canonical_usernames = {u["username"] for u in DEMO_USERS}
        all_users = (await session.execute(select(UserAccount))).scalars().all()
        for usr in all_users:
            if usr.username not in canonical_usernames:
                print(f"  [-] Removing extra user account: {usr.username}")
                await session.delete(usr)
        await session.flush()

        # Remove non-canonical roles
        canonical_role_names = {u["role_name"] for u in DEMO_USERS}
        all_roles = (await session.execute(select(UserRole))).scalars().all()
        for r in all_roles:
            if r.name not in canonical_role_names:
                print(f"  [-] Removing deprecated role: {r.name}")
                await session.delete(r)
        await session.flush()

        # 1. Fetch available roles
        role_result = await session.execute(select(UserRole))
        roles_by_name = {role.name: role for role in role_result.scalars().all()}

        # 2. Seed Departments
        print("\n--- Seeding Departments ---")
        depts_by_code: dict[str, Department] = {}
        for ddata in DEMO_DEPARTMENTS:
            d_res = await session.execute(select(Department).where(Department.code == ddata["code"]))
            dept = d_res.scalar_one_or_none()
            if not dept:
                dept = Department(id=uuid.uuid4(), name=ddata["name"], code=ddata["code"])
                session.add(dept)
                print(f"  [+] Created department: {ddata['name']} ({ddata['code']})")
            else:
                dept.name = ddata["name"]
            depts_by_code[ddata["code"]] = dept

        # 3. Seed Locations
        print("\n--- Seeding Locations ---")
        locs_by_room: dict[str, Location] = {}
        for ldata in DEMO_LOCATIONS:
            l_res = await session.execute(
                select(Location).where(
                    (Location.building == ldata["building"])
                    & (Location.floor == ldata["floor"])
                    & (Location.room == ldata["room"])
                )
            )
            loc = l_res.scalar_one_or_none()
            if not loc:
                loc = Location(
                    id=uuid.uuid4(),
                    building=ldata["building"],
                    floor=ldata["floor"],
                    room=ldata["room"],
                )
                session.add(loc)
            locs_by_room[ldata["room"]] = loc

        await session.flush()

        # 4. Seed Users
        print("\n--- Seeding Core RBAC Users ---")
        users_by_username: dict[str, UserAccount] = {}
        for udata in DEMO_USERS:
            role = roles_by_name.get(udata["role_name"])
            if not role:
                continue
            dept = depts_by_code.get(udata.get("department_code", ""))
            user_res = await session.execute(
                select(UserAccount).where(
                    (UserAccount.username == udata["username"]) | (UserAccount.email == udata["email"])
                )
            )
            existing_user = user_res.scalar_one_or_none()
            if existing_user:
                existing_user.password_hash = hash_password(udata["password"])
                existing_user.role_id = role.id
                existing_user.status = "active"
                existing_user.external_id = udata["external_id"]
                existing_user.university_id = udata.get("university_id")
                existing_user.full_name = udata.get("full_name")
                existing_user.department_id = dept.id if dept else None
                users_by_username[udata["username"]] = existing_user
                print(f"  [*] Updated user: {udata['username']:<14} [{udata['role_name']}]")
            else:
                new_user = UserAccount(
                    id=uuid.uuid4(),
                    username=udata["username"],
                    email=udata["email"],
                    password_hash=hash_password(udata["password"]),
                    role_id=role.id,
                    external_id=udata["external_id"],
                    university_id=udata.get("university_id"),
                    full_name=udata.get("full_name"),
                    department_id=dept.id if dept else None,
                    status="active",
                )
                session.add(new_user)
                users_by_username[udata["username"]] = new_user
                print(f"  [+] Created user: {udata['username']:<14} [{udata['role_name']}]")

        await session.flush()

        # 5. Workstations seeding (0 pre-seeded; endpoints enroll dynamically via agent)
        if DEMO_WORKSTATIONS:
            print("\n--- Seeding Workstations ---")
            now = datetime.now(timezone.utc)
            for wdata in DEMO_WORKSTATIONS:
                ws_res = await session.execute(select(Workstation).where(Workstation.hostname == wdata["hostname"]))
                existing_ws = ws_res.scalar_one_or_none()
                assigned_user = users_by_username.get(wdata["assigned_username"])
                dept = depts_by_code.get(wdata["department_code"])
                loc = locs_by_room.get(wdata["lab"])

                if existing_ws:
                    existing_ws.asset_tag = wdata["asset_tag"]
                    existing_ws.ip_address = wdata["ip_address"]
                    existing_ws.operating_system = wdata["operating_system"]
                    existing_ws.department = wdata["department"]
                    existing_ws.department_id = dept.id if dept else None
                    existing_ws.location_id = loc.id if loc else None
                    existing_ws.assigned_user_id = assigned_user.id if assigned_user else None
                    existing_ws.lab = wdata["lab"]
                    existing_ws.status = "ONLINE"
                    existing_ws.agent_version = wdata["agent_version"]
                    existing_ws.hardware_specs = wdata["hardware_specs"]
                    existing_ws.last_seen_at = now
                else:
                    new_ws = Workstation(
                        id=uuid.uuid4(),
                        agent_id=uuid.uuid4(),
                        hostname=wdata["hostname"],
                        asset_tag=wdata["asset_tag"],
                        ip_address=wdata["ip_address"],
                        operating_system=wdata["operating_system"],
                        department=wdata["department"],
                        department_id=dept.id if dept else None,
                        location_id=loc.id if loc else None,
                        assigned_user_id=assigned_user.id if assigned_user else None,
                        lab=wdata["lab"],
                        status="ONLINE",
                        agent_version=wdata["agent_version"],
                        hardware_specs=wdata["hardware_specs"],
                        last_seen_at=now,
                    )
                    session.add(new_ws)
        else:
            print("\n--- Workstations: 0 pre-seeded (fleet starts clean; endpoints enroll dynamically) ---")

        await session.commit()

    print("\nDatabase Reseeding Complete (0 Pre-Seeded Workstations • 0 Alerts • 0 Incidents)!\n")
    print("=" * 65)
    print("CORE RBAC CREDENTIALS (Password: <Username>Secure2026!):")
    print("=" * 65)
    for u in DEMO_USERS:
        print(f"Role: {u['role_name']:<12} | Username: {u['username']:<11} | Password: {u['password']}")
    print("=" * 65)


if __name__ == "__main__":
    print("Secure-MaintAI — Seeding Roles, Core Users & Foundational Entities (0 Workstations)...")
    asyncio.run(seed_demo_data())
