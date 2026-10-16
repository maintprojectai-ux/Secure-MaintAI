"""
Secure-MaintAI — Comprehensive Database Demo Data Seeder.

Reseeds the database cleanly and deterministically:
1. Purges stale operational records (Alerts, Incidents, Anomalies, Security Events, Telemetry, Audit Logs)
   and removes orphan/untagged workstations from previous test runs.
2. Seeds the 4 canonical RBAC roles (ADMIN, IT_OPERATOR, RESEARCHER, STUDENT).
3. Seeds all University Departments and Campus Locations.
4. Seeds the 4 primary operator login accounts plus the scenario identity accounts.
5. Seeds the complete 12-workstation campus fleet (including all 6 scenario target hosts with full
   asset tags and hardware specifications).
6. Generates authentic baseline telemetry across the fleet and executes initial representative
   scenarios through the real ML -> IdP -> Correlation -> Policy -> SOAR -> SHA-256 Audit pipeline
   so all Dashboard, Devices, Alerts, Cybersecurity, AI Predictions, Maintenance, and Activity Logs
   views are populated with genuine runtime outputs.

Usage:
    python scripts/seed_demo_data.py
"""

import asyncio
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Ensure project root is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import delete, select

from backend.core.database import async_session_factory
from backend.core.security import hash_password
from backend.data.scenario_registry import get_scenario_profile
from backend.models.alert import Alert
from backend.models.anomaly import AnomalyDetection
from backend.models.audit import AuditLog
from backend.models.incident import Incident
from backend.models.lookup import Department, Location
from backend.models.security_event import SecurityEvent
from backend.models.telemetry import TelemetryMetric
from backend.models.user import UserAccount, UserRole
from backend.models.workstation import Workstation
from backend.schemas.telemetry import TelemetryCreate
from backend.schemas.user import RoleEnum
from backend.services import ml_pipeline_service
from backend.services.idp_service import idp_service
from backend.services.soar_service import SOARService
from scripts.seed_roles import seed_roles

DEMO_DEPARTMENTS = [
    {"name": "Computer Science", "code": "CS"},
    {"name": "Artificial Intelligence", "code": "AI"},
    {"name": "IT Services", "code": "IT"},
    {"name": "Mechanical Engineering", "code": "ME"},
    {"name": "Engineering", "code": "ENG"},
    {"name": "Physics & Advanced Computing", "code": "PHYS"},
    {"name": "Mathematics", "code": "MATH"},
    {"name": "IT Operations & Security", "code": "SEC"},
    {"name": "Distance Education", "code": "DE"},
]

DEMO_LOCATIONS = [
    {"building": "Computer Science Building", "floor": 1, "room": "CS Lab 101"},
    {"building": "Computer Science Building", "floor": 1, "room": "CS Lab 102"},
    {"building": "Computer Science Building", "floor": 3, "room": "Undergraduate Lab 301"},
    {"building": "Science & AI Research Complex", "floor": 2, "room": "AI Research Lab"},
    {"building": "Science & AI Research Complex", "floor": 3, "room": "Quantum Computing Lab"},
    {"building": "Administration Building", "floor": 3, "room": "Main Campus Admin"},
    {"building": "Administration Building", "floor": 4, "room": "Security Operations Center"},
    {"building": "Engineering Hall", "floor": 1, "room": "CAD Simulation Lab"},
    {"building": "Engineering Hall", "floor": 2, "room": "Fluid Mechanics Lab"},
    {"building": "Faculty Building", "floor": 2, "room": "Faculty Office"},
    {"building": "Distance Learning Center", "floor": 1, "room": "Virtual Lab 8"},
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
    # Scenario persona accounts
    {
        "username": "student_attacker",
        "email": "student_attacker@univ.edu",
        "password": "StudentSecure2026!",
        "role_name": RoleEnum.STUDENT.value,
        "external_id": "idp:kku:stu02",
        "university_id": "KKU-STU-4411024",
        "full_name": "Tariq Al-Zahrani",
        "department_code": "CS",
    },
    {
        "username": "sys_operator",
        "email": "sys_operator@univ.edu",
        "password": "OperatorSecure2026!",
        "role_name": RoleEnum.IT_OPERATOR.value,
        "external_id": "idp:kku:op02",
        "university_id": "KKU-STAFF-1044",
        "full_name": "Eng. Nasser Al-Dosari",
        "department_code": "ENG",
    },
    {
        "username": "prof_researcher",
        "email": "prof_researcher@univ.edu",
        "password": "ResearcherSecure2026!",
        "role_name": RoleEnum.RESEARCHER.value,
        "external_id": "idp:kku:res02",
        "university_id": "KKU-STAFF-2019",
        "full_name": "Prof. Mansour Al-Harbi",
        "department_code": "PHYS",
    },
    {
        "username": "admin_operator",
        "email": "admin_operator@univ.edu",
        "password": "AdminSecure2026!",
        "role_name": RoleEnum.ADMIN.value,
        "external_id": "idp:kku:admin02",
        "university_id": "KKU-STAFF-1009",
        "full_name": "Eng. Sultan Al-Maliki",
        "department_code": "SEC",
    },
]

DEMO_WORKSTATIONS = [
    # Standard Campus Workstations
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
        "ip_address": "10.10.1.15",
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
    # Scenario Target Workstations (aligned with backend/data/scenario_registry.py)
    {
        "hostname": "undergrad-pc-04",
        "asset_tag": "KKU-CS-304",
        "ip_address": "10.20.4.104",
        "operating_system": "Ubuntu 22.04 LTS",
        "department": "Computer Science",
        "lab": "Undergraduate Lab 301",
        "status": "ONLINE",
        "agent_version": "1.0.0",
        "hardware_specs": {"cpu": "Intel Core i7-12700", "ram_gb": 16, "storage": "512GB NVMe"},
    },
    {
        "hostname": "lab-server-12",
        "asset_tag": "KKU-ENG-012",
        "ip_address": "10.10.1.12",
        "operating_system": "Ubuntu 22.04 LTS",
        "department": "Engineering",
        "lab": "Fluid Mechanics Lab",
        "status": "ONLINE",
        "agent_version": "1.0.0",
        "hardware_specs": {"cpu": "Intel Xeon Silver 4314", "ram_gb": 64, "storage": "2TB NVMe RAID"},
    },
    {
        "hostname": "quantum-node-01",
        "asset_tag": "KKU-QNT-001",
        "ip_address": "10.30.2.1",
        "operating_system": "Red Hat Enterprise Linux 9",
        "department": "Physics & Advanced Computing",
        "lab": "Quantum Computing Lab",
        "status": "ONLINE",
        "agent_version": "1.0.0",
        "hardware_specs": {"cpu": "AMD EPYC 9554 64-Core", "ram_gb": 128, "storage": "4TB NVMe"},
    },
    {
        "hostname": "dept-pc-02",
        "asset_tag": "KKU-MTH-002",
        "ip_address": "10.20.1.2",
        "operating_system": "Ubuntu 22.04 LTS",
        "department": "Mathematics",
        "lab": "Faculty Office",
        "status": "ONLINE",
        "agent_version": "1.0.0",
        "hardware_specs": {"cpu": "Intel Core i7-13700", "ram_gb": 32, "storage": "1TB NVMe"},
    },
    {
        "hostname": "admin-jumphost-01",
        "asset_tag": "KKU-SOC-001",
        "ip_address": "10.50.1.5",
        "operating_system": "Windows Server 2022",
        "department": "IT Operations & Security",
        "lab": "Security Operations Center",
        "status": "ONLINE",
        "agent_version": "1.0.0",
        "hardware_specs": {"cpu": "Intel Xeon Gold 6330", "ram_gb": 32, "storage": "1TB SSD"},
    },
    {
        "hostname": "remote-lab-08",
        "asset_tag": "KKU-VDI-008",
        "ip_address": "10.40.1.8",
        "operating_system": "Ubuntu 22.04 LTS",
        "department": "Distance Education",
        "lab": "Virtual Lab 8",
        "status": "ONLINE",
        "agent_version": "1.0.0",
        "hardware_specs": {"cpu": "AMD EPYC vCPU 8-Core", "ram_gb": 16, "storage": "256GB VirtIO"},
    },
]


async def _seed_scenario_through_pipeline(
    session,
    scenario_name: str,
    ws_by_hostname: dict[str, Workstation],
    offset_minutes: int,
    preserve_online_status: bool = False,
) -> None:
    """Run a canonical scenario through the genuine ML + Policy + SOAR pipeline to populate DB tables."""
    now = datetime.now(timezone.utc) - timedelta(minutes=offset_minutes)
    profile = get_scenario_profile(scenario_name, now=now)
    ws = ws_by_hostname[profile.target_hostname]

    ml_pipeline_service.reset_state(str(ws.id))
    idp_service.clear_workloads(ws.id)
    idp_service.register_mock_user(profile.user_context)
    for wl in profile.workloads:
        idp_service.register_workload(wl.model_copy(update={"workstation_id": ws.id}))

    raw_telemetry = TelemetryCreate(
        agent_id=ws.agent_id or uuid.uuid4(),
        workstation_id=ws.id,
        timestamp=now,
        cpu=profile.cpu,
        memory=profile.memory,
        disk=profile.disk,
        network=profile.network,
        process_count=profile.process_count,
    )
    ml_eval = ml_pipeline_service.evaluate_telemetry_snapshot(raw_telemetry, workstation_name=ws.hostname)

    t_rec = TelemetryMetric(
        workstation_id=ws.id,
        timestamp=now,
        schema_version="1.0.0",
        cpu_usage=profile.cpu.usage_percent,
        memory_usage=profile.memory.usage_percent,
        disk_read=profile.disk.read_bytes_per_sec,
        disk_write=profile.disk.write_bytes_per_sec,
        network_in=profile.network.bytes_in_per_sec,
        network_out=profile.network.bytes_out_per_sec,
        process_count=profile.process_count,
    )
    session.add(t_rec)

    anom_rec = None
    if ml_eval.is_anomaly:
        anom_rec = AnomalyDetection(
            workstation_id=ws.id,
            timestamp=now,
            anomaly_type=ml_eval.anomaly_type.value,
            score=ml_eval.score,
            confidence=ml_eval.confidence,
            model_name=ml_eval.model_name,
            model_version=ml_eval.model_version,
            features_snapshot=ml_eval.features_snapshot,
            evidence=ml_eval.evidence,
            status="DETECTED",
        )
        session.add(anom_rec)

    sec_rec = None
    if profile.security_event_spec:
        sec_rec = SecurityEvent(
            workstation_id=ws.id,
            timestamp=now,
            event_type=profile.security_event_spec["event_type"],
            severity=profile.security_event_spec["severity"],
            confidence=profile.security_event_spec["confidence"],
            source=profile.security_event_spec["source"],
            description=profile.security_event_spec["description"],
            evidence=profile.security_event_spec["evidence"],
        )
        session.add(sec_rec)

    await session.flush()

    soar = SOARService(session)
    _, _, _, policy_result, _ = await soar.evaluate_and_execute(
        workstation_id=ws.id,
        anomalies=[anom_rec] if anom_rec else [],
        security_events=[sec_rec] if sec_rec else [],
        target_user_id=profile.user_context.user_id,
        workstation_name=ws.hostname,
        auto_execute=False,
        operator="system:seed-pipeline",
    )
    receipt = await soar.execute_policy_decision(
        evaluation=policy_result,
        operator="system:seed-pipeline",
    )
    if preserve_online_status:
        ws.status = "ONLINE"
    print(
        f"  [+] Seeded scenario {scenario_name:<25} -> ML={ml_eval.anomaly_type.value} "
        f"(fault={ml_eval.predicted_fault}, conf={ml_eval.confidence:.2%}) "
        f"Playbook={receipt.playbook_name}"
    )


async def seed_demo_data() -> None:
    """Cleanly reseed roles, lookup tables, users, workstations, telemetry, and pipeline records."""
    await seed_roles()
    ml_pipeline_service.initialise()

    async with async_session_factory() as session:
        # 0. Clean stale operational records and orphan workstations
        print("\n--- Purging Stale Operational Records ---")
        for model in [Alert, Incident, SecurityEvent, AnomalyDetection, TelemetryMetric, AuditLog]:
            await session.execute(delete(model))

        canonical_hostnames = {w["hostname"] for w in DEMO_WORKSTATIONS}
        all_ws = (await session.execute(select(Workstation))).scalars().all()
        for ws in all_ws:
            if ws.hostname not in canonical_hostnames:
                print(f"  [-] Removing orphan workstation: {ws.hostname} ({ws.ip_address})")
                await session.delete(ws)
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

        # 4. Seed Users
        print("\n--- Seeding Demo & Scenario Users ---")
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
                if dept:
                    existing_user.department_id = dept.id
                print(f"  [*] Updated user: {udata['username']:<18} [{udata['role_name']}]")
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
                print(f"  [+] Created user: {udata['username']:<18} [{udata['role_name']}]")

        # 5. Seed Workstations
        print("\n--- Seeding Campus & Scenario Workstations ---")
        now = datetime.now(timezone.utc)
        ws_by_hostname: dict[str, Workstation] = {}
        for wdata in DEMO_WORKSTATIONS:
            ws_res = await session.execute(select(Workstation).where(Workstation.hostname == wdata["hostname"]))
            existing_ws = ws_res.scalar_one_or_none()
            if existing_ws:
                existing_ws.asset_tag = wdata["asset_tag"]
                existing_ws.ip_address = wdata["ip_address"]
                existing_ws.operating_system = wdata["operating_system"]
                existing_ws.department = wdata["department"]
                existing_ws.lab = wdata["lab"]
                existing_ws.status = "ONLINE"
                existing_ws.agent_version = wdata["agent_version"]
                existing_ws.hardware_specs = wdata["hardware_specs"]
                existing_ws.last_seen_at = now
                ws_by_hostname[wdata["hostname"]] = existing_ws
                print(f"  [*] Reset workstation:   {wdata['hostname']:<20} [{wdata['asset_tag']}] ({wdata['ip_address']})")
            else:
                new_ws = Workstation(
                    id=uuid.uuid4(),
                    agent_id=uuid.uuid4(),
                    hostname=wdata["hostname"],
                    asset_tag=wdata["asset_tag"],
                    ip_address=wdata["ip_address"],
                    operating_system=wdata["operating_system"],
                    department=wdata["department"],
                    lab=wdata["lab"],
                    status="ONLINE",
                    agent_version=wdata["agent_version"],
                    hardware_specs=wdata["hardware_specs"],
                    last_seen_at=now,
                )
                session.add(new_ws)
                ws_by_hostname[wdata["hostname"]] = new_ws
                print(f"  [+] Created workstation: {wdata['hostname']:<20} [{wdata['asset_tag']}] ({wdata['ip_address']})")

        await session.flush()

        # 6. Seed Baseline Telemetry Stream Across All Workstations
        print("\n--- Seeding Baseline Telemetry Metrics ---")
        for idx, (_hostname, ws) in enumerate(ws_by_hostname.items()):
            for step in range(3):
                ts = now - timedelta(minutes=(15 - step * 4))
                cpu_u = round(14.0 + (idx * 2.3) % 18.0 + step * 1.1, 1)
                mem_u = round(36.0 + (idx * 3.1) % 24.0 + step * 0.8, 1)
                session.add(
                    TelemetryMetric(
                        workstation_id=ws.id,
                        timestamp=ts,
                        schema_version="1.0.0",
                        cpu_usage=cpu_u,
                        memory_usage=mem_u,
                        disk_read=float((1.2 + step * 0.3) * 1024**2),
                        disk_write=float((1.8 + step * 0.4) * 1024**2),
                        network_in=float(450 * 1024),
                        network_out=float(320 * 1024),
                        process_count=135 + idx * 3 + step,
                    )
                )

        # 7. Seed Authentic Scenarios Through ML -> Policy -> SOAR Pipeline
        print("\n--- Seeding Authentic Pipeline Events (ML + Policy + SOAR + Audit) ---")
        await _seed_scenario_through_pipeline(session, "TECHNICAL_DEGRADATION", ws_by_hostname, offset_minutes=12)
        await _seed_scenario_through_pipeline(session, "RESEARCHER_HPC_WORKLOAD", ws_by_hostname, offset_minutes=8)
        await _seed_scenario_through_pipeline(session, "STUDENT_CYBER_THREAT", ws_by_hostname, offset_minutes=4)

        await session.commit()

    print("\nDatabase Reseeding Complete!\n")
    print("=" * 65)
    print("DEMO CREDENTIALS REFERENCE (Password: <Username>Secure2026!):")
    print("=" * 65)
    for u in DEMO_USERS[:4]:
        print(f"Role: {u['role_name']:<12} | Username: {u['username']:<11} | Password: {u['password']}")
    print("=" * 65)


if __name__ == "__main__":
    print("Secure-MaintAI — Reseeding Roles, Campus Fleet, Telemetry & Authentic Pipeline Records...")
    asyncio.run(seed_demo_data())
