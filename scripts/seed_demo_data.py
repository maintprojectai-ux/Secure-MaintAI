"""
Secure-MaintAI — Minimal Foundational Database Seeder.

Reseeds the database cleanly and deterministically with only foundational entities:
1. Purges all system-generated operational records (Alerts, Incidents, Anomalies,
   Security Events, Telemetry Metrics, and Audit Logs) so the platform starts clean.
2. Seeds the 3 canonical RBAC roles (ADMIN, RESEARCHER, STUDENT).
3. Seeds the essential University Departments and Campus Locations.
4. Seeds the 3 core RBAC login accounts (admin, researcher, student).
5. Seeds strictly 2 workstations:
   - 1 Student workstation (undergrad-pc-04, assigned to student)
   - 1 Researcher workstation (quantum-node-01, assigned to researcher)

No alerts, incidents, anomalies, security events, telemetry, or audit logs are pre-seeded;
all operational records are generated dynamically by the system at runtime.

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

DEMO_WORKSTATIONS = [
    # 1. Student Workstation
    {
        "hostname": "undergrad-pc-04",
        "asset_tag": "KKU-STD-001",
        "ip_address": "10.20.4.104",
        "operating_system": "Ubuntu 22.04 LTS",
        "department": "Computer Science",
        "department_code": "CS",
        "lab": "Undergraduate Lab 301",
        "assigned_username": "student",
        "status": "ONLINE",
        "agent_version": "1.0.0",
        "hardware_specs": {
            "cpu": "Intel Core i7-12700",
            "cores": 12,
            "ram_gb": 16,
            "storage_gb": 512,
            "disk_usage_pct": 42.0,
        },
    },
    # 2. Researcher Workstation
    {
        "hostname": "quantum-node-01",
        "asset_tag": "KKU-RES-001",
        "ip_address": "10.30.2.1",
        "operating_system": "Red Hat Enterprise Linux 9",
        "department": "Physics & Advanced Computing",
        "department_code": "PHYS",
        "lab": "Quantum Computing Lab",
        "assigned_username": "researcher",
        "status": "ONLINE",
        "agent_version": "1.0.0",
        "hardware_specs": {
            "cpu": "Dual AMD EPYC 7763",
            "cores": 128,
            "ram_gb": 64,
            "storage_gb": 2000,
            "gpu": "4x NVIDIA A100 80GB",
            "disk_usage_pct": 38.0,
        },
    },
]


async def seed_demo_data() -> None:
    """Cleanly reseed roles, lookup tables, 4 core RBAC users, and 2 workstations (Student & Researcher)."""
    await seed_roles()

    async with async_session_factory() as session:
        # 0. Clean all system-generated operational records and orphan workstations
        print("\n--- Purging System-Generated Operational Records ---")
        for model in [Alert, Incident, SecurityEvent, AnomalyDetection, TelemetryMetric, AuditLog]:
            await session.execute(delete(model))

        canonical_hostnames = {w["hostname"] for w in DEMO_WORKSTATIONS}
        all_ws = (await session.execute(select(Workstation))).scalars().all()
        for ws in all_ws:
            if ws.hostname not in canonical_hostnames:
                print(f"  [-] Removing orphan workstation: {ws.hostname} ({ws.ip_address})")
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

        # 5. Seed the 2 Workstations (1 Student, 1 Researcher)
        print("\n--- Seeding Student & Researcher Workstations (2 Devices) ---")
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
                print(
                    f"  [*] Reset workstation:   {wdata['hostname']:<18} [{wdata['asset_tag']}] "
                    f"-> Assigned to: {wdata['assigned_username']}"
                )
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
                print(
                    f"  [+] Created workstation: {wdata['hostname']:<18} [{wdata['asset_tag']}] "
                    f"-> Assigned to: {wdata['assigned_username']}"
                )

        await session.commit()

    print("\nDatabase Reseeding Complete (2 Workstations • 0 Pre-Seeded Alerts/Incidents/Telemetry)!\n")
    print("=" * 65)
    print("CORE RBAC CREDENTIALS (Password: <Username>Secure2026!):")
    print("=" * 65)
    for u in DEMO_USERS:
        print(f"Role: {u['role_name']:<12} | Username: {u['username']:<11} | Password: {u['password']}")
    print("=" * 65)


if __name__ == "__main__":
    print("Secure-MaintAI — Seeding Roles, Core Users & 2 Workstations (Student + Researcher)...")
    asyncio.run(seed_demo_data())
