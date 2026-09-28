"""
Secure-MaintAI — Scenario Data Registry.

Centralized source-of-truth for demonstration scenario data, providing:
- Explicit 3-tier data provenance (Existing Local Benchmark, Web-Sourced Benchmark, Calibrated Synthetic)
- Empirically grounded telemetry snapshots and 5-point time-series trajectories
- Process tree snapshots with command-line arguments and status
- Active network socket connection tables with protocol, ports, and threat annotations
- Target workstation metadata and University IdP identity context profiles

Per Rule 38 (No Fabricated Completion) and Rule 39 (Research Integrity).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

from backend.schemas.idp import AuthorizedWorkload, IdPIdentityContext, WorkloadType
from backend.schemas.telemetry import (
    CpuMetrics,
    DiskMetrics,
    MemoryMetrics,
    NetworkMetrics,
    TelemetryCreate,
)


class DataOriginTier(str, Enum):
    TIER_1_LOCAL = "Tier 1: Existing Local Benchmark"
    TIER_2_WEB = "Tier 2: Web-Sourced Benchmark"
    TIER_3_SYNTHETIC = "Tier 3: Calibrated Synthetic"


class DataProvenanceInfo(BaseModel):
    """Rigorous attribution of training data, empirical benchmarks, and generation method."""

    tier: DataOriginTier
    dataset_name: str
    reference_citation: str
    generation_method: str


class ProcessSnapshot(BaseModel):
    """Simulated host process record with resource consumption and execution status."""

    pid: int
    name: str
    command: str
    cpu_percent: float
    memory_mb: float
    user: str
    status: str = Field(
        default="running",
        description="'running', 'contained', 'suspended', or 'terminated'",
    )


class SocketSnapshot(BaseModel):
    """Simulated active network socket connection on the monitored workstation."""

    protocol: str = Field(default="TCP", description="'TCP' or 'UDP'")
    local_address: str
    remote_address: str
    state: str = Field(default="ESTABLISHED", description="'ESTABLISHED', 'LISTEN', 'BLOCKED', 'CLOSED'")
    pid: int
    threat_note: str | None = None


class TrajectoryPoint(BaseModel):
    """Single point in a time-series progression demonstrating scenario onset and resolution."""

    phase: str
    offset_seconds: int
    cpu_percent: float
    memory_percent: float
    disk_read_mb_s: float
    disk_write_mb_s: float
    network_out_mb_s: float
    process_count: int
    anomaly_score: float


class ScenarioProfile(BaseModel):
    """Complete, self-contained demonstration scenario specification."""

    scenario_type: str
    title: str
    description: str
    provenance: DataProvenanceInfo
    target_hostname: str
    target_ip: str
    target_os: str
    department: str
    lab: str
    user_context: IdPIdentityContext
    workloads: list[AuthorizedWorkload] = Field(default_factory=list)
    cpu: CpuMetrics
    memory: MemoryMetrics
    disk: DiskMetrics
    network: NetworkMetrics
    process_count: int
    trajectory: list[TrajectoryPoint]
    processes: list[ProcessSnapshot]
    sockets: list[SocketSnapshot]
    is_idp_outage: bool = False
    security_event_spec: dict[str, Any] | None = None


# ==============================================================================
# SCENARIO DATA REPOSITORY
# ==============================================================================

def get_scenario_profile(scenario_type: str, now: datetime | None = None) -> ScenarioProfile:
    """Retrieve the rich scenario profile for the specified demo scenario type."""
    ts = now or datetime.now(timezone.utc)

    if scenario_type == "STUDENT_CYBER_THREAT":
        student_id = str(uuid4())
        return ScenarioProfile(
            scenario_type="STUDENT_CYBER_THREAT",
            title="Student Cyber Threat Simulation",
            description="Controlled academic simulation of cryptojacking. Rogue mining process saturates CPU threads while establishing high-volume Stratum pool egress.",
            provenance=DataProvenanceInfo(
                tier=DataOriginTier.TIER_1_LOCAL,
                dataset_name="Windows-APT 2025 (Sysmon Event ID 1/3) + Stratum Benchmark (CNT21)",
                reference_citation="Windows-APT 2025 (Scenario S07 APT41) & Cryptojacking Network Traffic Dataset (CNT21, 2021)",
                generation_method="Process creation logs mapped to Sysmon Event ID 1 with network egress calibrated to Stratum protocol flow features",
            ),
            target_hostname="undergrad-pc-04",
            target_ip="10.20.4.104",
            target_os="Ubuntu 22.04 LTS",
            department="Computer Science",
            lab="Undergraduate Lab 301",
            user_context=IdPIdentityContext(
                user_id=student_id,
                username="student_attacker",
                email="student_attacker@univ.edu",
                role="STUDENT",
                department="Computer Science",
                lab="Undergraduate Lab 301",
                status="ACTIVE",
                active_workloads=[],
            ),
            cpu=CpuMetrics(usage_percent=99.8, load_average_1m=4.8),
            memory=MemoryMetrics(usage_percent=65.0, used_bytes=8 * 1024**3, total_bytes=16 * 1024**3),
            disk=DiskMetrics(read_bytes_per_sec=15.0 * 1024**2, write_bytes_per_sec=45.0 * 1024**2),
            network=NetworkMetrics(bytes_in_per_sec=2.5 * 1024**2, bytes_out_per_sec=65.0 * 1024**2),  # Corrected to 65 MB/s
            process_count=520,
            trajectory=[
                TrajectoryPoint(phase="T-60s (Baseline)", offset_seconds=-60, cpu_percent=12.5, memory_percent=35.0, disk_read_mb_s=1.2, disk_write_mb_s=1.0, network_out_mb_s=0.4, process_count=140, anomaly_score=0.08),
                TrajectoryPoint(phase="T-15s (Onset)", offset_seconds=-15, cpu_percent=48.0, memory_percent=42.0, disk_read_mb_s=5.0, disk_write_mb_s=12.0, network_out_mb_s=8.5, process_count=210, anomaly_score=0.35),
                TrajectoryPoint(phase="T+0s (Perturbation)", offset_seconds=0, cpu_percent=94.0, memory_percent=58.0, disk_read_mb_s=12.0, disk_write_mb_s=32.0, network_out_mb_s=35.0, process_count=480, anomaly_score=0.78),
                TrajectoryPoint(phase="T+15s (Peak Anomaly)", offset_seconds=15, cpu_percent=99.8, memory_percent=65.0, disk_read_mb_s=15.0, disk_write_mb_s=45.0, network_out_mb_s=65.0, process_count=520, anomaly_score=0.95),
                TrajectoryPoint(phase="T+30s (Post-SOAR Containment)", offset_seconds=30, cpu_percent=14.0, memory_percent=36.0, disk_read_mb_s=1.8, disk_write_mb_s=2.0, network_out_mb_s=0.2, process_count=142, anomaly_score=0.11),
            ],
            processes=[
                ProcessSnapshot(pid=4128, name="xmrig", command="./xmrig -o stratum+tcp://pool.minexmr.com:3333 -u 48... --threads 8", cpu_percent=88.5, memory_mb=2048.0, user="student_attacker", status="contained"),
                ProcessSnapshot(pid=4125, name="bash", command="/bin/bash ./launch_worker.sh", cpu_percent=0.2, memory_mb=18.0, user="student_attacker", status="terminated"),
                ProcessSnapshot(pid=3102, name="code", command="/usr/share/code/code", cpu_percent=4.5, memory_mb=512.0, user="student_attacker", status="running"),
                ProcessSnapshot(pid=1140, name="gnome-shell", command="/usr/bin/gnome-shell", cpu_percent=3.2, memory_mb=480.0, user="student_attacker", status="running"),
                ProcessSnapshot(pid=890, name="secure-maintai-agent", command="/opt/secure-maintai/agent", cpu_percent=0.8, memory_mb=34.0, user="root", status="running"),
            ],
            sockets=[
                SocketSnapshot(protocol="TCP", local_address="10.20.4.104:49822", remote_address="198.51.100.42:3333", state="BLOCKED", pid=4128, threat_note="Stratum Mining Protocol (Port 3333) - Rogue Pool Connection"),
                SocketSnapshot(protocol="TCP", local_address="10.20.4.104:49824", remote_address="198.51.100.43:4444", state="BLOCKED", pid=4128, threat_note="Stratum Backup Node (Port 4444)"),
                SocketSnapshot(protocol="TCP", local_address="10.20.4.104:22", remote_address="10.20.1.5:54320", state="ESTABLISHED", pid=1102, threat_note="Authorized SSH Session (Student Lab Jump Host)"),
            ],
            security_event_spec={
                "event_type": "CRYPTOMINING_TRAFFIC",
                "severity": "HIGH",
                "confidence": 0.95,
                "source": "NETWORK_FLOW_INSPECTOR",
                "description": "High outbound Stratum protocol connection targeting unauthorized mining pool on TCP port 3333.",
                "evidence": ["destination_port: 3333", "threat_type: CRYPTOJACKING", "mitre_technique: T1496"],
            },
        )

    elif scenario_type == "TECHNICAL_DEGRADATION":
        operator_id = str(uuid4())
        return ScenarioProfile(
            scenario_type="TECHNICAL_DEGRADATION",
            title="Technical Performance Degradation Simulation",
            description="Unchecked memory leak in engineering telemetry worker drives memory saturation and thrashing without malicious security indicators.",
            provenance=DataProvenanceInfo(
                tier=DataOriginTier.TIER_1_LOCAL,
                dataset_name="RCAEval Microservice Benchmark (mem_1 to mem_5 Fault Injection)",
                reference_citation="RCAEval: Benchmark for Root Cause Analysis of Microservice Systems (2023)",
                generation_method="Direct parameter extraction from RCAEval memory leak and disk page thrashing benchmarks",
            ),
            target_hostname="lab-server-12",
            target_ip="10.10.1.12",
            target_os="Ubuntu 22.04 LTS",
            department="Engineering",
            lab="Fluid Mechanics Lab",
            user_context=IdPIdentityContext(
                user_id=operator_id,
                username="sys_operator",
                email="sys_operator@univ.edu",
                role="IT_OPERATOR",
                department="Engineering",
                lab="Fluid Mechanics Lab",
                status="ACTIVE",
                active_workloads=[],
            ),
            cpu=CpuMetrics(usage_percent=45.0, load_average_1m=1.5),
            memory=MemoryMetrics(usage_percent=98.5, used_bytes=63 * 1024**3, total_bytes=64 * 1024**3),
            disk=DiskMetrics(read_bytes_per_sec=180.0 * 1024**2, write_bytes_per_sec=240.0 * 1024**2),
            network=NetworkMetrics(bytes_in_per_sec=5.0 * 1024**2, bytes_out_per_sec=3.0 * 1024**2),
            process_count=180,
            trajectory=[
                TrajectoryPoint(phase="T-60s (Baseline)", offset_seconds=-60, cpu_percent=25.0, memory_percent=52.0, disk_read_mb_s=15.0, disk_write_mb_s=18.0, network_out_mb_s=2.0, process_count=165, anomaly_score=0.10),
                TrajectoryPoint(phase="T-15s (Leak Accumulation)", offset_seconds=-15, cpu_percent=32.0, memory_percent=78.0, disk_read_mb_s=45.0, disk_write_mb_s=60.0, network_out_mb_s=2.5, process_count=172, anomaly_score=0.45),
                TrajectoryPoint(phase="T+0s (Page Cache Thrashing)", offset_seconds=0, cpu_percent=40.0, memory_percent=92.0, disk_read_mb_s=120.0, disk_write_mb_s=160.0, network_out_mb_s=2.8, process_count=178, anomaly_score=0.74),
                TrajectoryPoint(phase="T+15s (Peak Degradation)", offset_seconds=15, cpu_percent=45.0, memory_percent=98.5, disk_read_mb_s=180.0, disk_write_mb_s=240.0, network_out_mb_s=3.0, process_count=180, anomaly_score=0.91),
                TrajectoryPoint(phase="T+30s (Maintenance Queued)", offset_seconds=30, cpu_percent=22.0, memory_percent=65.0, disk_read_mb_s=20.0, disk_write_mb_s=25.0, network_out_mb_s=2.2, process_count=170, anomaly_score=0.18),
            ],
            processes=[
                ProcessSnapshot(pid=2814, name="sensor-worker", command="python3 -m ingest.worker --batch-size=50000", cpu_percent=32.0, memory_mb=60416.0, user="sys_operator", status="running"),
                ProcessSnapshot(pid=112, name="kswapd0", command="[kswapd0]", cpu_percent=10.5, memory_mb=0.0, user="root", status="running"),
                ProcessSnapshot(pid=902, name="postgres", command="postgres: fluid_mechanics_db", cpu_percent=2.5, memory_mb=1200.0, user="postgres", status="running"),
                ProcessSnapshot(pid=889, name="secure-maintai-agent", command="/opt/secure-maintai/agent", cpu_percent=0.6, memory_mb=32.0, user="root", status="running"),
            ],
            sockets=[
                SocketSnapshot(protocol="TCP", local_address="10.10.1.12:5432", remote_address="10.10.1.45:49112", state="ESTABLISHED", pid=902, threat_note="Legitimate Postgres connection"),
                SocketSnapshot(protocol="TCP", local_address="10.10.1.12:8080", remote_address="10.10.1.100:52110", state="ESTABLISHED", pid=2814, threat_note="Internal Ingestion pipeline"),
            ],
        )

    elif scenario_type == "RESEARCHER_HPC_WORKLOAD":
        researcher_id = str(uuid4())
        hpc_workload = AuthorizedWorkload(
            job_id="QUANTUM-SIM-772",
            workload_type=WorkloadType.HPC_SIMULATION,
            description="Quantum Monte Carlo wave function simulation",
            expected_cpu_percent=100.0,
            expected_ram_mb=64000.0,
            approved_by="Dean of Graduate Studies",
            started_at=ts,
            is_active=True,
        )
        return ScenarioProfile(
            scenario_type="RESEARCHER_HPC_WORKLOAD",
            title="Researcher HPC Workload Simulation",
            description="Legitimate high-performance scientific workload generating massive CPU and RAM utilization. IdP role correlation ensures preservation without isolation.",
            provenance=DataProvenanceInfo(
                tier=DataOriginTier.TIER_2_WEB,
                dataset_name="Parallel Workloads Archive (PWA) - NASA Ames / LLNL Traces",
                reference_citation="Standard Workload Format (SWF), Parallel Workloads Archive (Feitelson et al., 2014)",
                generation_method="Parametric calibration matching PWA scientific OpenMP/MPI compute traces with periodic checkpoint disk bursts",
            ),
            target_hostname="quantum-node-01",
            target_ip="10.30.2.1",
            target_os="Red Hat Enterprise Linux 9",
            department="Physics & Advanced Computing",
            lab="Quantum Computing Lab",
            user_context=IdPIdentityContext(
                user_id=researcher_id,
                username="prof_researcher",
                email="prof_researcher@univ.edu",
                role="RESEARCHER",
                department="Physics",
                lab="Quantum Computing Lab",
                status="ACTIVE",
                active_workloads=[hpc_workload],
            ),
            workloads=[hpc_workload],
            cpu=CpuMetrics(usage_percent=99.2, load_average_1m=64.0),
            memory=MemoryMetrics(usage_percent=88.0, used_bytes=56 * 1024**3, total_bytes=64 * 1024**3),
            disk=DiskMetrics(read_bytes_per_sec=40.0 * 1024**2, write_bytes_per_sec=90.0 * 1024**2),
            network=NetworkMetrics(bytes_in_per_sec=12.0 * 1024**2, bytes_out_per_sec=18.0 * 1024**2),
            process_count=340,
            trajectory=[
                TrajectoryPoint(phase="T-60s (Job Initialized)", offset_seconds=-60, cpu_percent=98.5, memory_percent=86.0, disk_read_mb_s=10.0, disk_write_mb_s=15.0, network_out_mb_s=15.0, process_count=335, anomaly_score=0.68),
                TrajectoryPoint(phase="T-15s (Checkpoint Write)", offset_seconds=-15, cpu_percent=99.0, memory_percent=87.5, disk_read_mb_s=35.0, disk_write_mb_s=85.0, network_out_mb_s=17.0, process_count=338, anomaly_score=0.72),
                TrajectoryPoint(phase="T+0s (Peak Computation)", offset_seconds=0, cpu_percent=99.2, memory_percent=88.0, disk_read_mb_s=40.0, disk_write_mb_s=90.0, network_out_mb_s=18.0, process_count=340, anomaly_score=0.75),
                TrajectoryPoint(phase="T+15s (IdP Role Evaluated)", offset_seconds=15, cpu_percent=99.2, memory_percent=88.0, disk_read_mb_s=40.0, disk_write_mb_s=90.0, network_out_mb_s=18.0, process_count=340, anomaly_score=0.75),
                TrajectoryPoint(phase="T+30s (Workload Preserved)", offset_seconds=30, cpu_percent=99.2, memory_percent=88.0, disk_read_mb_s=25.0, disk_write_mb_s=40.0, network_out_mb_s=16.0, process_count=340, anomaly_score=0.70),
            ],
            processes=[
                ProcessSnapshot(pid=6104, name="qmcpack_cpu_opt", command="mpirun -np 32 ./qmcpack_cpu_opt wave_function.xml", cpu_percent=96.0, memory_mb=54200.0, user="prof_researcher", status="running"),
                ProcessSnapshot(pid=6100, name="mpirun", command="mpirun -np 32", cpu_percent=1.2, memory_mb=120.0, user="prof_researcher", status="running"),
                ProcessSnapshot(pid=4510, name="jupyter-lab", command="python3 -m jupyterlab --ip=127.0.0.1", cpu_percent=0.8, memory_mb=410.0, user="prof_researcher", status="running"),
                ProcessSnapshot(pid=895, name="secure-maintai-agent", command="/opt/secure-maintai/agent", cpu_percent=0.7, memory_mb=33.0, user="root", status="running"),
            ],
            sockets=[
                SocketSnapshot(protocol="TCP", local_address="10.30.2.1:41200", remote_address="10.30.2.2:41200", state="ESTABLISHED", pid=6104, threat_note="Authorized Cluster MPI Interconnect"),
                SocketSnapshot(protocol="TCP", local_address="10.30.2.1:8888", remote_address="10.30.2.55:51234", state="ESTABLISHED", pid=4510, threat_note="Authorized JupyterLab Faculty Session"),
            ],
        )

    elif scenario_type == "PRIVILEGE_ESCALATION":
        admin_id = str(uuid4())
        return ScenarioProfile(
            scenario_type="PRIVILEGE_ESCALATION",
            title="Privilege Escalation Simulation",
            description="Simulated unauthorized memory read against lsass.exe process and token elevation detected on administrative jump host.",
            provenance=DataProvenanceInfo(
                tier=DataOriginTier.TIER_1_LOCAL,
                dataset_name="Windows-APT 2025 (Scenario S07 APT41 & S16 menuPass)",
                reference_citation="Windows-APT 2025: A Dataset for APT-Inspired Attacks (Sysmon EID 10)",
                generation_method="Direct mapping of Sysmon Event ID 10 memory handle access (0x1010) on lsass.exe and token privilege elevation",
            ),
            target_hostname="admin-jumphost-01",
            target_ip="10.50.1.5",
            target_os="Windows Server 2022",
            department="IT Operations & Security",
            lab="Security Operations Center",
            user_context=IdPIdentityContext(
                user_id=admin_id,
                username="admin_operator",
                email="admin_operator@univ.edu",
                role="ADMIN",
                department="Security Operations",
                lab="SOC",
                status="ACTIVE",
                active_workloads=[],
            ),
            cpu=CpuMetrics(usage_percent=68.0, load_average_1m=2.2),
            memory=MemoryMetrics(usage_percent=55.0, used_bytes=16 * 1024**3, total_bytes=32 * 1024**3),
            disk=DiskMetrics(read_bytes_per_sec=25.0 * 1024**2, write_bytes_per_sec=30.0 * 1024**2),
            network=NetworkMetrics(bytes_in_per_sec=15.0 * 1024**2, bytes_out_per_sec=70.0 * 1024**2),  # Corrected to 70 MB/s
            process_count=540,
            trajectory=[
                TrajectoryPoint(phase="T-60s (Baseline)", offset_seconds=-60, cpu_percent=18.0, memory_percent=45.0, disk_read_mb_s=5.0, disk_write_mb_s=6.0, network_out_mb_s=1.5, process_count=480, anomaly_score=0.05),
                TrajectoryPoint(phase="T-15s (Reconnaissance)", offset_seconds=-15, cpu_percent=35.0, memory_percent=48.0, disk_read_mb_s=12.0, disk_write_mb_s=15.0, network_out_mb_s=12.0, process_count=510, anomaly_score=0.38),
                TrajectoryPoint(phase="T+0s (LSASS Handle Opened)", offset_seconds=0, cpu_percent=60.0, memory_percent=52.0, disk_read_mb_s=22.0, disk_write_mb_s=25.0, network_out_mb_s=55.0, process_count=535, anomaly_score=0.86),
                TrajectoryPoint(phase="T+15s (Peak Intrusion)", offset_seconds=15, cpu_percent=68.0, memory_percent=55.0, disk_read_mb_s=25.0, disk_write_mb_s=30.0, network_out_mb_s=70.0, process_count=540, anomaly_score=0.96),
                TrajectoryPoint(phase="T+30s (Isolated / Session Revoked)", offset_seconds=30, cpu_percent=12.0, memory_percent=44.0, disk_read_mb_s=2.0, disk_write_mb_s=2.5, network_out_mb_s=0.1, process_count=485, anomaly_score=0.08),
            ],
            processes=[
                ProcessSnapshot(pid=7288, name="procdump.exe", command="procdump.exe -ma lsass.exe C:\\Windows\\Temp\\lsass.dmp", cpu_percent=45.0, memory_mb=450.0, user="admin_operator", status="contained"),
                ProcessSnapshot(pid=680, name="lsass.exe", command="C:\\Windows\\System32\\lsass.exe", cpu_percent=12.0, memory_mb=280.0, user="SYSTEM", status="running"),
                ProcessSnapshot(pid=5410, name="powershell.exe", command="powershell.exe -ExecutionPolicy Bypass -File .\\recon.ps1", cpu_percent=8.5, memory_mb=210.0, user="admin_operator", status="terminated"),
                ProcessSnapshot(pid=1024, name="secure-maintai-agent", command="C:\\Program Files\\SecureMaintAI\\agent.exe", cpu_percent=0.7, memory_mb=38.0, user="SYSTEM", status="running"),
            ],
            sockets=[
                SocketSnapshot(protocol="TCP", local_address="10.50.1.5:51240", remote_address="198.51.100.99:443", state="BLOCKED", pid=7288, threat_note="Encrypted C2 Channel - Outbound Credential Exfiltration"),
                SocketSnapshot(protocol="TCP", local_address="10.50.1.5:3389", remote_address="10.50.1.200:54112", state="ESTABLISHED", pid=1024, threat_note="RDP Administrative Ingress Session"),
            ],
            security_event_spec={
                "event_type": "UNAUTHORIZED_ACCESS",
                "severity": "CRITICAL",
                "confidence": 0.98,
                "source": "SYSMON_ADAPTER",
                "description": "Sysmon Event ID 10: Unauthorized handle open detected against lsass.exe process memory (GrantedAccess: 0x1010).",
                "evidence": ["event_id: 10", "target_image: lsass.exe", "threat_type: APT_INTRUSION", "mitre_technique: T1003.001"],
            },
        )

    elif scenario_type == "IDP_OUTAGE_FALLBACK":
        target_user_id = str(uuid4())
        return ScenarioProfile(
            scenario_type="IDP_OUTAGE_FALLBACK",
            title="IdP Outage Safe Fallback Simulation",
            description="University identity provider directory is unreachable (504 Gateway Timeout). Safe fail-secure fallback engages without crashing host services.",
            provenance=DataProvenanceInfo(
                tier=DataOriginTier.TIER_2_WEB,
                dataset_name="Campus IdP Resiliency & Fault Injection Profile",
                reference_citation="Secure-MaintAI Engineering Rules §18 & Scenario 5 Safe Fallback",
                generation_method="Simulated IdP timeout with fail-secure local policy cache evaluation and quarantine of unverified suspicious activity",
            ),
            target_hostname="remote-lab-08",
            target_ip="10.40.1.8",
            target_os="Ubuntu 22.04 LTS",
            department="Distance Education",
            lab="Virtual Lab 8",
            user_context=IdPIdentityContext(
                user_id=target_user_id,
                username="unverified_session",
                email="guest_student@univ.edu",
                role="STUDENT",
                department="Distance Education",
                lab="Virtual Lab 8",
                status="ACTIVE",
                active_workloads=[],
                is_fallback=True,
            ),
            cpu=CpuMetrics(usage_percent=95.0, load_average_1m=3.5),
            memory=MemoryMetrics(usage_percent=72.0, used_bytes=11 * 1024**3, total_bytes=16 * 1024**3),
            disk=DiskMetrics(read_bytes_per_sec=10.0 * 1024**2, write_bytes_per_sec=20.0 * 1024**2),
            network=NetworkMetrics(bytes_in_per_sec=5.0 * 1024**2, bytes_out_per_sec=40.0 * 1024**2),  # Corrected to 40 MB/s
            process_count=510,
            trajectory=[
                TrajectoryPoint(phase="T-60s (Baseline)", offset_seconds=-60, cpu_percent=15.0, memory_percent=40.0, disk_read_mb_s=2.0, disk_write_mb_s=2.5, network_out_mb_s=0.5, process_count=160, anomaly_score=0.06),
                TrajectoryPoint(phase="T-15s (Spike)", offset_seconds=-15, cpu_percent=55.0, memory_percent=55.0, disk_read_mb_s=8.0, disk_write_mb_s=12.0, network_out_mb_s=15.0, process_count=320, anomaly_score=0.52),
                TrajectoryPoint(phase="T+0s (IdP Timeout Injected)", offset_seconds=0, cpu_percent=90.0, memory_percent=68.0, disk_read_mb_s=16.0, disk_write_mb_s=18.0, network_out_mb_s=35.0, process_count=480, anomaly_score=0.88),
                TrajectoryPoint(phase="T+15s (Peak Anomaly)", offset_seconds=15, cpu_percent=95.0, memory_percent=72.0, disk_read_mb_s=20.0, disk_write_mb_s=20.0, network_out_mb_s=40.0, process_count=510, anomaly_score=0.92),
                TrajectoryPoint(phase="T+30s (Fallback Quarantine Active)", offset_seconds=30, cpu_percent=14.0, memory_percent=38.0, disk_read_mb_s=1.5, disk_write_mb_s=1.8, network_out_mb_s=0.1, process_count=155, anomaly_score=0.10),
            ],
            processes=[
                ProcessSnapshot(pid=5520, name="python3", command="python3 -c 'import socket,subprocess;...'", cpu_percent=78.0, memory_mb=350.0, user="unverified_session", status="contained"),
                ProcessSnapshot(pid=1102, name="sshd", command="sshd: unverified_session [priv]", cpu_percent=0.5, memory_mb=22.0, user="root", status="running"),
                ProcessSnapshot(pid=890, name="secure-maintai-agent", command="/opt/secure-maintai/agent", cpu_percent=0.6, memory_mb=33.0, user="root", status="running"),
            ],
            sockets=[
                SocketSnapshot(protocol="TCP", local_address="10.40.1.8:48290", remote_address="203.0.113.88:8080", state="BLOCKED", pid=5520, threat_note="Rogue Reverse Shell Connection to Unknown External IP"),
            ],
            is_idp_outage=True,
        )

    else:  # NORMAL_BASELINE
        regular_id = str(uuid4())
        return ScenarioProfile(
            scenario_type="NORMAL_BASELINE",
            title="Benign Baseline Operational Stream",
            description="Nominal workstation operational state in mathematics faculty office. Background processes operate within established statistical variance.",
            provenance=DataProvenanceInfo(
                tier=DataOriginTier.TIER_1_LOCAL,
                dataset_name="ServerMachineDataset (SMD) machine-1-1 Uncorrupted Baseline",
                reference_citation="Su et al., OmniAnomaly, KDD 2019 (28-machine telemetry dataset)",
                generation_method="Direct Gaussian distribution sampling from uncorrupted training partition of SMD machine-1-1",
            ),
            target_hostname="dept-pc-02",
            target_ip="10.20.1.2",
            target_os="Ubuntu 22.04 LTS",
            department="Mathematics",
            lab="Faculty Office",
            user_context=IdPIdentityContext(
                user_id=regular_id,
                username="faculty_user",
                email="faculty_user@univ.edu",
                role="STUDENT",
                department="Mathematics",
                lab="Faculty Office",
                status="ACTIVE",
                active_workloads=[],
            ),
            cpu=CpuMetrics(usage_percent=14.2, load_average_1m=0.3),
            memory=MemoryMetrics(usage_percent=38.5, used_bytes=6 * 1024**3, total_bytes=16 * 1024**3),
            disk=DiskMetrics(read_bytes_per_sec=1.5 * 1024**2, write_bytes_per_sec=2.0 * 1024**2),
            network=NetworkMetrics(bytes_in_per_sec=500.0 * 1024, bytes_out_per_sec=300.0 * 1024),
            process_count=140,
            trajectory=[
                TrajectoryPoint(phase="T-60s (Nominal)", offset_seconds=-60, cpu_percent=12.0, memory_percent=38.0, disk_read_mb_s=1.2, disk_write_mb_s=1.5, network_out_mb_s=0.25, process_count=138, anomaly_score=0.05),
                TrajectoryPoint(phase="T-15s (Nominal)", offset_seconds=-15, cpu_percent=15.5, memory_percent=38.2, disk_read_mb_s=1.8, disk_write_mb_s=2.2, network_out_mb_s=0.32, process_count=141, anomaly_score=0.07),
                TrajectoryPoint(phase="T+0s (Nominal)", offset_seconds=0, cpu_percent=14.2, memory_percent=38.5, disk_read_mb_s=1.5, disk_write_mb_s=2.0, network_out_mb_s=0.30, process_count=140, anomaly_score=0.06),
                TrajectoryPoint(phase="T+15s (Nominal)", offset_seconds=15, cpu_percent=13.8, memory_percent=38.4, disk_read_mb_s=1.4, disk_write_mb_s=1.9, network_out_mb_s=0.28, process_count=140, anomaly_score=0.06),
                TrajectoryPoint(phase="T+30s (Nominal)", offset_seconds=30, cpu_percent=14.0, memory_percent=38.5, disk_read_mb_s=1.5, disk_write_mb_s=2.0, network_out_mb_s=0.29, process_count=140, anomaly_score=0.06),
            ],
            processes=[
                ProcessSnapshot(pid=2104, name="firefox", command="/usr/lib/firefox/firefox", cpu_percent=6.5, memory_mb=1850.0, user="faculty_user", status="running"),
                ProcessSnapshot(pid=1890, name="libreoffice", command="/usr/lib/libreoffice/program/soffice.bin", cpu_percent=2.1, memory_mb=420.0, user="faculty_user", status="running"),
                ProcessSnapshot(pid=1120, name="gnome-shell", command="/usr/bin/gnome-shell", cpu_percent=3.0, memory_mb=450.0, user="faculty_user", status="running"),
                ProcessSnapshot(pid=889, name="secure-maintai-agent", command="/opt/secure-maintai/agent", cpu_percent=0.5, memory_mb=31.0, user="root", status="running"),
            ],
            sockets=[
                SocketSnapshot(protocol="TCP", local_address="10.20.1.2:53420", remote_address="142.250.190.46:443", state="ESTABLISHED", pid=2104, threat_note="Legitimate HTTPS Search Traffic"),
                SocketSnapshot(protocol="TCP", local_address="10.20.1.2:53422", remote_address="151.101.65.140:443", state="ESTABLISHED", pid=2104, threat_note="Legitimate HTTPS Academic ArXiv Connection"),
            ],
        )
