"""
Secure-MaintAI — Database Demo Data Seeder (Phase 1).

Seeds canonical university demo accounts and lab workstations into the database:
- Demo Users: ADMIN, IT_OPERATOR, RESEARCHER, STUDENT
- Workstations: CS Lab PCs, AI HPC Nodes, Admin Desks, Engineering CAD PCs

Usage:
    python scripts/seed_demo_data.py
"""

import asyncio
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

# Ensure project root is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from backend.core.database import async_session_factory
from backend.core.security import hash_password
from backend.models.lookup import Department, Location
from backend.models.user import UserAccount, UserRole
from backend.models.workstation import Workstation
from backend.schemas.user import RoleEnum

DEMO_DEPARTMENTS = [
    {"name": "Computer Science", "code": "CS"},
    {"name": "Artificial Intelligence", "code": "AI"},
    {"name": "IT Services", "code": "IT"},
    {"name": "Mechanical Engineering", "code": "ME"},
]

DEMO_LOCATIONS = [
    {"building": "Computer Science Building", "floor": 1, "room": "Lab 101"},
    {"building": "Computer Science Building", "floor": 1, "room": "Lab 102"},
    {"building": "Science & AI Research Complex", "floor": 2, "room": "HPC Center"},
    {"building": "Administration Building", "floor": 3, "room": "Room 305"},
    {"building": "Engineering Hall", "floor": 1, "room": "CAD Lab"},
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
        "username": "operator",
        "email": "operator@kku.edu.sa",
        "password": "OperatorSecure2026!",
        "role_name": RoleEnum.IT_OPERATOR.value,
        "external_id": "idp:kku:op01",
        "university_id": "KKU-STAFF-1002",
        "full_name": "Eng. Khalid Al-Ghamdi",
        "department_code": "IT",
    },
    {
        "username": "researcher",
        "email": "researcher@kku.edu.sa",
        "password": "ResearcherSecure2026!",
        "role_name": RoleEnum.RESEARCHER.value,
        "external_id": "idp:kku:res01",
        "university_id": "KKU-STAFF-2005",
        "full_name": "Dr. Sarah Al-Shehri",
        "department_code": "AI",
    },
    {
        "username": "student",
        "email": "student@kku.edu.sa",
        "password": "StudentSecure2026!",
        "role_name": RoleEnum.STUDENT.value,
        "external_id": "idp:kku:stu01",
        "university_id": "KKU-STU-4410982",
        "full_name": "Fahad Al-Otaibi",
        "department_code": "CS",
    },
]

DEMO_WORKSTATIONS = [
    {
        "hostname": "cs-lab-pc-01",
        "asset_tag": "KKU-CS-001",
        "ip_address": "10.10.1.11",
        "operating_system": "Ubuntu 22.04 LTS",
        "department": "Computer Science",
        "lab": "CS Lab 101",
        "status": "ONLINE",
        "agent_version": "1.0.0",
        "hardware_specs": {"cpu": "Intel Core i7-12700", "ram_gb": 32, "storage": "512GB NVMe"},
    },
    {
        "hostname": "cs-lab-pc-02",
        "asset_tag": "KKU-CS-002",
        "ip_address": "10.10.1.12",
        "operating_system": "Windows 11 Enterprise",
        "department": "Computer Science",
        "lab": "CS Lab 101",
        "status": "ONLINE",
        "agent_version": "1.0.0",
        "hardware_specs": {"cpu": "Intel Core i7-12700", "ram_gb": 32, "storage": "512GB NVMe"},
    },
    {
        "hostname": "cs-lab-pc-03",
        "asset_tag": "KKU-CS-003",
        "ip_address": "10.10.1.13",
        "operating_system": "Ubuntu 22.04 LTS",
        "department": "Computer Science",
        "lab": "CS Lab 102",
        "status": "ONLINE",
        "agent_version": "1.0.0",
        "hardware_specs": {"cpu": "Intel Core i5-12400", "ram_gb": 16, "storage": "512GB NVMe"},
    },
    {
        "hostname": "cs-lab-pc-04",
        "asset_tag": "KKU-CS-004",
        "ip_address": "10.10.1.14",
        "operating_system": "Windows 11 Enterprise",
        "department": "Computer Science",
        "lab": "CS Lab 102",
        "status": "ONLINE",
        "agent_version": "1.0.0",
        "hardware_specs": {"cpu": "Intel Core i5-12400", "ram_gb": 16, "storage": "512GB NVMe"},
    },
    {
        "hostname": "hpc-node-01",
        "asset_tag": "KKU-HPC-001",
        "ip_address": "10.20.1.50",
        "operating_system": "Ubuntu 22.04 LTS",
        "department": "Artificial Intelligence",
        "lab": "AI Research Lab",
        "status": "ONLINE",
        "agent_version": "1.0.0",
        "hardware_specs": {"cpu": "AMD EPYC 7763 64-Core", "ram_gb": 256, "gpu": "4x NVIDIA A100 80GB"},
    },
    {
        "hostname": "hpc-node-02",
        "asset_tag": "KKU-HPC-002",
        "ip_address": "10.20.1.51",
        "operating_system": "Ubuntu 22.04 LTS",
        "department": "Artificial Intelligence",
        "lab": "AI Research Lab",
        "status": "ONLINE",
        "agent_version": "1.0.0",
        "hardware_specs": {"cpu": "AMD EPYC 7763 64-Core", "ram_gb": 256, "gpu": "4x NVIDIA A100 80GB"},
    },
    {
        "hostname": "admin-desk-01",
        "asset_tag": "KKU-ADM-001",
        "ip_address": "10.30.1.5",
        "operating_system": "Windows 11 Enterprise",
        "department": "IT Services",
        "lab": "Main Campus Admin",
        "status": "ONLINE",
        "agent_version": "1.0.0",
        "hardware_specs": {"cpu": "Intel Core i5-13400", "ram_gb": 16, "storage": "256GB SSD"},
    },
    {
        "hostname": "eng-cad-01",
        "asset_tag": "KKU-ENG-001",
        "ip_address": "10.40.1.21",
        "operating_system": "Windows 11 Enterprise",
        "department": "Mechanical Engineering",
        "lab": "CAD Simulation Lab",
        "status": "ONLINE",
        "agent_version": "1.0.0",
        "hardware_specs": {"cpu": "Intel Core i9-13900K", "ram_gb": 64, "gpu": "NVIDIA RTX 4080"},
    },
]


async def seed_demo_data() -> None:
    """Seed demo accounts, lookup entities, and workstations idempotently."""
    async with async_session_factory() as session:
        # 1. Fetch available roles
        role_result = await session.execute(select(UserRole))
        roles_by_name = {role.name: role for role in role_result.scalars().all()}

        if not roles_by_name:
            print("[!] No roles found in database. Run `python scripts/seed_roles.py` first.")
            return

        # 2. Seed Departments
        print("\n--- Seeding Departments ---")
        depts_by_code: dict[str, Department] = {}
        for ddata in DEMO_DEPARTMENTS:
            d_res = await session.execute(
                select(Department).where(Department.code == ddata["code"])
            )
            dept = d_res.scalar_one_or_none()
            if not dept:
                dept = Department(
                    id=uuid.uuid4(),
                    name=ddata["name"],
                    code=ddata["code"],
                )
                session.add(dept)
                print(f"  [+] Created department: {ddata['name']} ({ddata['code']})")
            else:
                dept.name = ddata["name"]
                print(f"  [*] Updated department: {ddata['name']} ({ddata['code']})")
            depts_by_code[ddata["code"]] = dept

        # 3. Seed Locations
        print("\n--- Seeding Locations ---")
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
                print(f"  [+] Created location: {ldata['building']} Fl {ldata['floor']} {ldata['room']}")

        # 4. Seed Users
        print("\n--- Seeding Demo Users ---")
        for udata in DEMO_USERS:
            role = roles_by_name.get(udata["role_name"])
            if not role:
                print(f"  [!] Role {udata['role_name']} not found for {udata['username']}. Skipping.")
                continue

            dept = depts_by_code.get(udata.get("department_code", ""))

            user_res = await session.execute(
                select(UserAccount).where(
                    (UserAccount.username == udata["username"])
                    | (UserAccount.email == udata["email"])
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
                if dept:
                    existing_user.department_id = dept.id
                print(f"  [*] Updated demo user: {udata['username']} ({udata['email']}) [{udata['role_name']}]")
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
                print(f"  [+] Created demo user: {udata['username']} ({udata['email']}) [{udata['role_name']}]")

        # 5. Seed Workstations
        print("\n--- Seeding Demo Workstations ---")
        now = datetime.now(timezone.utc)
        for wdata in DEMO_WORKSTATIONS:
            ws_res = await session.execute(
                select(Workstation).where(Workstation.hostname == wdata["hostname"])
            )
            existing_ws = ws_res.scalar_one_or_none()

            if existing_ws:
                existing_ws.asset_tag = wdata.get("asset_tag")
                existing_ws.ip_address = wdata["ip_address"]
                existing_ws.operating_system = wdata["operating_system"]
                existing_ws.department = wdata["department"]
                existing_ws.lab = wdata["lab"]
                existing_ws.status = wdata["status"]
                existing_ws.agent_version = wdata["agent_version"]
                existing_ws.hardware_specs = wdata.get("hardware_specs")
                existing_ws.last_seen_at = now
                print(f"  [*] Updated workstation: {wdata['hostname']} [{wdata.get('asset_tag')}]")
            else:
                new_ws = Workstation(
                    id=uuid.uuid4(),
                    agent_id=uuid.uuid4(),
                    hostname=wdata["hostname"],
                    asset_tag=wdata.get("asset_tag"),
                    ip_address=wdata["ip_address"],
                    operating_system=wdata["operating_system"],
                    department=wdata["department"],
                    lab=wdata["lab"],
                    status=wdata["status"],
                    agent_version=wdata["agent_version"],
                    hardware_specs=wdata.get("hardware_specs"),
                    last_seen_at=now,
                )
                session.add(new_ws)
                print(f"  [+] Created workstation: {wdata['hostname']} [{wdata.get('asset_tag')}]")

        await session.commit()

    print("\nPhase 1 Seeding Complete!\n")
    print("=" * 65)
    print("DEMO CREDENTIALS REFERENCE (Password: <Username>Secure2026!):")
    print("=" * 65)
    for u in DEMO_USERS:
        print(f"Role: {u['role_name']:<12} | Username: {u['username']:<11} | Password: {u['password']}")
    print("=" * 65)


if __name__ == "__main__":
    print("Secure-MaintAI — Seeding Demo Users and Campus Workstations...")
    asyncio.run(seed_demo_data())
