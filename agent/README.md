# Secure-MaintAI — Endpoint Monitoring Agent

Lightweight, non-intrusive 24/7 background telemetry collection daemon for university workstations, lab PCs, and HPC nodes.

---

## Quick Reference

- **Operating Instructions:** See [`agent/OPERATING_INSTRUCTIONS.md`](file:///d:/workspace/2026_2027/FirstSemester/KKU/secure-maintai/agent/OPERATING_INSTRUCTIONS.md)
- **Dependencies:** [`agent/requirements.txt`](file:///d:/workspace/2026_2027/FirstSemester/KKU/secure-maintai/agent/requirements.txt)
- **Technical Architecture Specification:** [`docs/agent/README.md`](file:///d:/workspace/2026_2027/FirstSemester/KKU/secure-maintai/docs/agent/README.md)
- **Main Daemon:** [`agent/main.py`](file:///d:/workspace/2026_2027/FirstSemester/KKU/secure-maintai/agent/main.py)
- **Local Offline Disk Buffer:** [`agent/buffer.py`](file:///d:/workspace/2026_2027/FirstSemester/KKU/secure-maintai/agent/buffer.py)
- **HTTPS Client & Retry Logic:** [`agent/client.py`](file:///d:/workspace/2026_2027/FirstSemester/KKU/secure-maintai/agent/client.py)
- **Configuration & State:** [`agent/config.py`](file:///d:/workspace/2026_2027/FirstSemester/KKU/secure-maintai/agent/config.py)
- **Metric Collectors:** [`agent/collectors/`](file:///d:/workspace/2026_2027/FirstSemester/KKU/secure-maintai/agent/collectors)

---

## Running the Agent

```powershell
# 1. Activate virtual environment
.venv\Scripts\activate

# 2. Run agent daemon
python agent/main.py
```

### Environment Configuration (Optional)
```powershell
$env:AGENT_BACKEND_URL = "http://localhost:8000/api/v1"
$env:AGENT_COLLECTION_INTERVAL = "10"
$env:AGENT_HEARTBEAT_INTERVAL = "60"
$env:AGENT_DEPARTMENT = "Computer Science"
$env:AGENT_LAB = "CS Lab 101"
python agent/main.py
```
