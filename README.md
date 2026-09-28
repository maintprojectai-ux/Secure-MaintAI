# Secure-MaintAI

**AI-Driven University Infrastructure Resilience Platform**

[![Tests](https://img.shields.io/badge/Tests-144%20Passed-success?style=flat-square&logo=pytest)](file:///d:/workspace/2026_2027/FirstSemester/KKU/secure-maintai/tests)
[![Python](https://img.shields.io/badge/Python-3.11%20%7C%20FastAPI-blue?style=flat-square&logo=python)](file:///d:/workspace/2026_2027/FirstSemester/KKU/secure-maintai/backend)
[![Next.js](https://img.shields.io/badge/Next.js-16.3.4%20(Turbopack)-black?style=flat-square&logo=next.js)](file:///d:/workspace/2026_2027/FirstSemester/KKU/secure-maintai/frontend)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4.3.3%20(CSS--first)-38bdf8?style=flat-square&logo=tailwindcss)](file:///d:/workspace/2026_2027/FirstSemester/KKU/secure-maintai/frontend)
[![University](https://img.shields.io/badge/Institution-King%20Khalid%20University-006C35?style=flat-square)](https://www.kku.edu.sa)

Secure-MaintAI is an AI-driven infrastructure resilience and automated response platform designed for university workstation and server environments. The system continuously ingests machine telemetry, detects operational deviations using machine learning, distinguishes between technical faults and cyber attacks, correlates events with SIEM/XDR adapters, enriches threat detections with university Identity Provider (IdP) context, and executes role-sensitive SOAR responses (such as non-destructive research state preservation or surgical network isolation without rebooting the host OS).

---

## 1. System Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                            University Endpoints                             │
│     Workstations / CS Lab PCs / HPC Nodes / Administration Servers           │
│                                     │                                       │
│                                     ▼                                       │
│                      Lightweight Monitoring Agent                           │
│        Non-intrusive CPU / RAM / Disk / Network / Process Metadata          │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │ HTTPS / Authenticated Bearer Token
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Telemetry Ingestion API                            │
│           Validation → Rate Limiting → Schema Versioning → Buffer           │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Data Processing Pipeline                            │
│     Cleaning → Normalization → 83-Channel Feature Extraction → EWMA         │
└──────────────────┬───────────────────────────────────────┬──────────────────┘
                   │                                       │
                   ▼                                       ▼
┌──────────────────────────────────────┐ ┌────────────────────────────────────┐
│         Operational Storage          │ │       Security Event Storage       │
│      Time-series Telemetry DB        │ │    Sysmon / Wazuh Normalized DB    │
└──────────────────┬───────────────────┘ └─────────────────┬──────────────────┘
                   │                                       │
                   └───────────────────┬───────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Machine Learning Engine                           │
│  Stage 1: Model 01 — SMD Isolation Forest (Telemetry Anomaly Screening)     │
│  Stage 2-A: Model 02-A — RCAEval Random Forest (Technical Root Cause Faults)│
│  Stage 2-B: Model 02-B — Windows-APT Random Forest (Cyber Threat Classifier)│
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SIEM / XDR Correlation Layer                           │
│   Wazuh Adapter │ Network Flow Adapter (Mining Pools) │ Threat Correlation │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     University IdP Context Broker                           │
│    LDAP/OIDC Context (Student vs. Researcher vs. IT Operator) │ Resilient TTL│
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Role-Sensitive Policy Engine                            │
│  Confidence Cutoffs │ State Preservation for Research │ Emergency Kill Switch│
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SOAR Automated Response                              │
│   Playbook 01: Alert Only                                                   │
│   Playbook 02: Surgical Process Containment (Target Rogue PID)              │
│   Playbook 03: Surgical Network Isolation (Packet Filter, No OS Reboot)     │
│   Playbook 04: Predictive Maintenance Advisory Ticket                       │
│   Playbook 05: Account Lockout & Credential Revocation                      │
└──────────────────┬───────────────────────────────────────┬──────────────────┘
                   ▼                                       ▼
┌──────────────────────────────────────┐ ┌────────────────────────────────────┐
│      Incident & Alert Management     │ │      Immutable Audit Logging       │
│    Lifecycle: NEW → ACK → RESOLVED   │ │   Cryptographic SHA-256 Trails     │
└──────────────────┬───────────────────┘ └─────────────────┬──────────────────┘
                   │                                       │
                   └───────────────────┬───────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│            Administrative Dashboard UI (Next.js 16 + Tailwind v4)           │
│    Dashboard │ Devices │ Alerts │ Cybersecurity │ AI Predictions │ Reports  │
│       Maintenance │ Users Management │ Activity Logs │ Settings │ Help      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Capabilities

- **Continuous Non-Intrusive Telemetry**: Monitors CPU, RAM, disk, network, and process metadata without inspecting private file contents or student communications (Rule 9).
- **Multi-Model Machine Learning Intelligence**:
  - **Model 01**: 28 per-machine Isolation Forest models trained on the Server Machine Dataset (SMD) for baseline anomaly screening.
  - **Model 02-A**: 33-feature Random Forest classifier trained on RCAEval for technical root-cause diagnosis (`cpu`, `mem`, `disk`, `delay`, `loss`).
  - **Model 02-B**: 30-feature Random Forest classifier trained on Windows-APT 2025 for cyber attack detection (Cryptojacking, privilege escalation, lateral movement).
- **SIEM / XDR Ingestion**: Vendor-agnostic security adapter layer normalizing Sysmon, Wazuh, and network socket telemetry (detecting Stratum mining pool beaconing on ports 3333, 4444).
- **University IdP Context & RBAC**: Synchronizes identity profiles (`ADMIN`, `IT_OPERATOR`, `RESEARCHER`, `STUDENT`) with cached fallback protection against IdP service outages (Rule 18).
- **Role-Aware Surgical Response**:
  - Legitimate compute workloads run by verified **Researchers** (e.g. PyTorch HPC simulations) are preserved without host disruption.
  - Rogue cryptomining executed under a **Student** profile triggers host network containment or targeted PID termination.
  - Network isolation is executed purely via packet-filtering rules without rebooting the host OS (Rule 19).
- **Interactive 10-Stage Demonstration Controller**: Built into the Device Details page with live execution across 6 empirical resilience scenarios, supporting direct targeting of any active workstation.
- **3-Tier Data Provenance System**: Strict mathematical and empirical attribution separating local training datasets (`TIER_1_LOCAL`), peer-reviewed benchmarks (`TIER_2_WEB`), and calibrated synthetic telemetry (`TIER_3_SYNTHETIC`).
- **Comprehensive Next.js 16 Dashboard**: 15 dark-themed routes built with Turbopack matching approved UI specifications, live SVG dials, interactive radar simulators, and audit inspection.

---

## 3. Project Directory Structure

```text
secure-maintai/
├── agent/                   # Lightweight endpoint telemetry collection agent
│   ├── collectors/          # OS metrics, process, and network collectors
│   ├── buffer.py            # Offline buffering with exponential backoff retry
│   ├── client.py            # Authenticated HTTPS transport client
│   └── config.py            # Agent hardware identifier and enrollment
├── backend/                 # FastAPI modular monolith core
│   ├── api/v1/              # Versioned REST APIs (telemetry, security, demo, soar, etc.)
│   ├── core/                # Configuration, database session, security, dependencies
│   ├── data/                # Scenario data registry and 3-tier provenance definitions
│   ├── models/              # SQLAlchemy ORM database models
│   ├── schemas/             # Strict Pydantic v2 DTO validation contracts
│   └── services/            # ML inference, IdP context, and SOAR orchestration
├── ml/                      # Machine learning training, evaluation, and serialized models
│   ├── model_01_outputs/    # SMD Isolation Forest production model (machine-1-1.joblib) & benchmarks
│   ├── model02a_rcaeval_outputs/ # RCAEval Random Forest technical specialist model & contract
│   ├── model02b_apt_outputs/     # Windows-APT Random Forest cyber attack specialist model
│   └── validate_scenario_data.py # Automated statistical calibration verification engine
├── security/                # SIEM/XDR adapters and policy evaluation
│   ├── adapters/            # Wazuh SIEM adapter, Sysmon, and network flow parsers
│   ├── correlation_engine.py# Multi-source threat correlation engine
│   └── policy_engine.py     # Role-sensitive security & containment policy engine
├── frontend/                # Next.js 16 (App Router) + Tailwind CSS v4 Dashboard
│   ├── src/app/             # 13 Dashboard routes matching all approved UI mockups
│   ├── src/components/      # Reusable primitives, SVG charts, layout shell
│   ├── src/context/         # AuthContext with 4-role live session simulation
│   └── src/proxy.ts         # Next.js 16 edge request proxy and auth guard
├── database/                # Alembic database migrations and seed data
│   └── migrations/versions/ # Foundation schema migrations
├── infrastructure/          # Docker compose and deployment configuration
│   └── docker/              # Dockerfile.backend, compose configurations
├── tests/                   # 133 automated tests across all test suites
│   ├── unit/                # Unit tests (RBAC, policy, adapters, SOAR, IdP)
│   ├── integration/         # Integration tests (APIs, anomaly persistence)
│   ├── ml/                  # ML runtime inference and feature builder tests
│   └── e2e/                 # Rule 29 mandatory end-to-end verification scenarios
├── scripts/                 # Administration and database seed scripts
└── docs/                    # Architecture records (ADRs), API, and thesis documentation
```

---

## 4. Quick Start

### Prerequisites

- **Python 3.11+**
- **Node.js 20+** & **npm 10+**
- **PostgreSQL 16+** (or Docker)

### 1. Backend Setup

```bash
# 1. Clone repository and set up Python virtual environment
git clone <repo-url>
cd secure-maintai
python -m venv .venv

# Activate virtual environment
source .venv/bin/activate       # Linux / macOS
.venv\Scripts\activate          # Windows PowerShell

# 2. Install backend dependencies
pip install -r backend/requirements.txt

# 3. Configure environment variables
cp .env.example .env
# Edit .env to verify database connection string and secret keys

# 4. Run database migrations
cd database
alembic upgrade head
cd ..

# 5. Seed initial RBAC roles, users, and demonstration lab inventory
python scripts/seed_roles.py
python scripts/seed_demo_data.py

# 6. Launch FastAPI backend
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
Interactive API documentation will be accessible at:
- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

### 2. Frontend Dashboard Setup

```bash
# In a new terminal, navigate to the frontend directory
cd frontend

# Install Node dependencies
npm install

# Run the Next.js 16 development server with Turbopack
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser. All API requests (`/api/v1/...`) are automatically proxied to the backend at `http://127.0.0.1:8000`.

### 3. Production Build Verification

```bash
cd frontend
npm run build
```
Compiles with 0 errors across all 15 routes using Turbopack.

---

## 5. Automated Test Suite (144 Tests)

The repository includes a comprehensive test suite enforcing 100% test passing before code merging (Rule 4 & Rule 28):

```bash
# Run the complete test suite
pytest tests/ -v
```

### Verified Test Suites

| Suite | Focus Areas | Tests | Status |
| :--- | :--- | :---: | :---: |
| **Unit Tests** | Security Policy Engine, SOAR Engine, IdP Service, RBAC, Adapters, Buffers, Schemas, JWT Security | 97 | **PASSED** |
| **Integration Tests** | Telemetry Ingestion, Workstation Lifecycle, Security APIs, Incidents, Dashboard Demo API, Active Device Targeting | 33 | **PASSED** |
| **ML Runtime Tests** | Model 01/02-A/02-B loading, screening, diagnosis contracts, and latency benchmarks | 8 | **PASSED** |
| **Rule 29 E2E Scenarios**| Mandatory verification scenarios (Cryptojacking, Research preservation, IdP fallback, Agent offline) | 6 | **PASSED** |
| **Total** | | **144** | **100% GREEN** |

---

## 6. Role-Based Access Control (RBAC)

The system implements strict, server-authoritative RBAC (Rule 8):

| Role | Key Permissions | Target Use Case |
| :--- | :--- | :--- |
| **`ADMIN`** | Full platform administration, user account management, emergency kill switch activation, manual containment triggers, ML parameter tuning | University CISO & Lead Security Engineers |
| **`IT_OPERATOR`** | Workstation fleet monitoring, alert acknowledgment, maintenance scheduling, process termination, isolation execution | Campus Network Operations Center (NOC) Engineers |
| **`RESEARCHER`** | Read access to own laboratory workstations, compute reservations, performance diagnostics; protected against automated containment | Faculty, Graduate Researchers, HPC Scientists |
| **`STUDENT`** | Read-only telemetry access for assigned lab desktop; subject to strict automated containment playbooks on policy violation | Enrolled undergraduate and lab students |

---

## 7. Versioned API Reference (`/api/v1`)

| Module | Method | Endpoint | Auth Required | Description |
| :--- | :---: | :--- | :---: | :--- |
| **Health** | `GET` | `/api/v1/health` | No | Basic health check and subsystem status |
| | `GET` | `/api/v1/ready` | No | Readiness probe verifying database & ML connectivity |
| **Auth** | `POST` | `/api/v1/auth/login` | No | JWT token issuance with encrypted credentials |
| | `GET` | `/api/v1/auth/me` | Yes | Return authenticated user identity & permissions |
| **Telemetry** | `POST` | `/api/v1/telemetry` | Agent/User | Ingest machine metrics with inline ML anomaly screening |
| | `GET` | `/api/v1/telemetry/{id}` | Yes | Query historical telemetry time-series |
| **Workstations**| `GET` | `/api/v1/workstations` | Yes | Query fleet inventory with pagination and filters |
| | `POST` | `/api/v1/workstations/{id}/isolate` | IT/Admin | Execute surgical network containment |
| | `POST` | `/api/v1/workstations/{id}/rollback`| IT/Admin | Revert containment and restore normal networking |
| **Security** | `POST` | `/api/v1/security/events` | Yes | Ingest normalized security events |
| | `POST` | `/api/v1/security/events/wazuh` | Yes | Ingest raw Wazuh/Sysmon alerts |
| | `GET` | `/api/v1/security/correlate/{id}` | Yes | Run multi-source threat correlation on workstation |
| **SOAR & Policy**| `POST` | `/api/v1/policy/evaluate` | Yes | Evaluate security policies against threat context |
| | `POST` | `/api/v1/policy/kill-switch` | Admin | Activate/deactivate global emergency containment |
| **Incidents** | `GET` | `/api/v1/incidents` | Yes | Query active incidents and forensic timelines |
| | `GET` | `/api/v1/alerts` | Yes | Query active and acknowledged system alerts |
| **Users** | `GET` | `/api/v1/users` | Admin | List all registered user accounts and IdP statuses |
| **Demonstration** | `POST` | `/api/v1/demo/trigger-scenario` | Yes | Dispatch authentic 10-stage simulation with active device targeting |
| | `GET` | `/api/v1/demo/dashboard-kpis` | Yes | Retrieve live fleet KPIs and operational aggregates |
| | `GET` | `/api/v1/demo/validation-metrics`| Yes | Real measured runtime validation metrics and model thresholds |
| | `GET` | `/api/v1/demo/recent-anomalies` | Yes | Streaming recent anomaly event feed for administrative UI |

---

## 8. Research Integrity & Context

Secure-MaintAI is developed as academic research at **King Khalid University**. All measured benchmarks, detection latencies, and classification confusion matrices reflect actual local experiments and test executions, in accordance with Rule 39.

For detailed design specifications, consult:
- [`walkthrough.md`](file:///d:/workspace/2026_2027/FirstSemester/KKU/secure-maintai/.agents/plans/walkthrough.md) — Implementation and verification record
- [`docs/architecture/`](file:///d:/workspace/2026_2027/FirstSemester/KKU/secure-maintai/docs/architecture) — Architecture documents and ADRs
- [`docs/ml/README.md`](file:///d:/workspace/2026_2027/FirstSemester/KKU/secure-maintai/docs/ml/README.md) — Multi-stage ML engine specifications
