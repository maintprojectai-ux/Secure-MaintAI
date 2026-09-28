# Secure-MaintAI Monitoring Agent — Operating Instructions

This document provides step-by-step instructions for deploying, configuring, and operating the **Secure-MaintAI Endpoint Monitoring Agent** on university workstations, lab computers, and server nodes.

---

## 1. Prerequisites & System Requirements

| Requirement | Specification |
| :--- | :--- |
| **Operating System** | Windows 10/11, Ubuntu 20.04+, Debian 11+, RHEL/CentOS 8+, macOS 12+ |
| **Python Runtime** | Python 3.10, 3.11, 3.12, 3.13, or 3.14 |
| **Privileges** | Standard user privileges (Admin/root recommended for complete process inspection) |
| **Network** | Outbound HTTPS connectivity to the Secure-MaintAI backend API (port 8000 or 443) |
| **Resource Footprint** | $< 2\%$ CPU utilization, $< 50\,\text{MB}$ RAM, $< 50\,\text{MB}$ disk storage |

---

## 2. Installation on the Workstation

### A. Windows Installation (PowerShell)

1. Open PowerShell and navigate to the agent directory:
   ```powershell
   cd secure-maintai\agent
   ```

2. Create and activate an isolated Python virtual environment:
   ```powershell
   python -m venv .venv
   .venv\Scripts\Activate.ps1
   ```

3. Install the lightweight agent dependencies:
   ```powershell
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

---

### B. Linux / macOS Installation (Bash)

1. Open a terminal and navigate to the agent directory:
   ```bash
   cd secure-maintai/agent
   ```

2. Create and activate a virtual environment:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. Install the dependencies:
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

---

## 3. Configuration Reference

The agent is configured using environment variables. You can set them in your shell or define them in a local `.env` file.

| Environment Variable | Default Value | Description |
| :--- | :--- | :--- |
| `AGENT_BACKEND_URL` | `http://localhost:8000/api/v1` | Base URL of the Secure-MaintAI backend server |
| `AGENT_COLLECTION_INTERVAL` | `10` | Interval between telemetry metric collections (seconds) |
| `AGENT_HEARTBEAT_INTERVAL` | `60` | Interval between heartbeat liveness pings (seconds) |
| `AGENT_DEPARTMENT` | `Computer Science` | Department name associated with the workstation |
| `AGENT_LAB` | `CS Lab 101` | Specific lab, room, or office identifier |
| `AGENT_MAX_BUFFER_MB` | `50` | Maximum disk size for offline SQLite buffer (MB) |
| `AGENT_BUFFER_DIR` | `.agent_buffer` | Directory storing the offline SQLite buffer queue |
| `AGENT_STATE_FILE` | `.agent_state.json` | Local file storing the assigned agent & workstation identity |

---

## 4. Running the Agent

### Method 1: Interactive Execution (Testing & Development)

Run the daemon directly in your terminal to inspect real-time log output:

**On Windows (PowerShell):**
```powershell
# Set backend server URL (example)
$env:AGENT_BACKEND_URL = "http://10.0.0.10:8000/api/v1"
$env:AGENT_DEPARTMENT = "Computer Science"
$env:AGENT_LAB = "CS Lab 101"

# Start the agent daemon
python main.py
```

**On Linux (Bash):**
```bash
export AGENT_BACKEND_URL="https://api.secure-maintai.kku.edu.sa/api/v1"
export AGENT_DEPARTMENT="Artificial Intelligence"
export AGENT_LAB="AI Research Lab"

python3 main.py
```

---

### Method 2: Running as a Background Daemon on Linux (`systemd`)

To ensure the agent starts automatically on boot and restarts if terminated:

1. Create a service unit file `/etc/systemd/system/secure-maintai-agent.service`:
   ```ini
   [Unit]
   Description=Secure-MaintAI Endpoint Monitoring Agent
   After=network-online.target
   Wants=network-online.target

   [Service]
   Type=simple
   User=root
   WorkingDirectory=/opt/secure-maintai/agent
   Environment="AGENT_BACKEND_URL=https://api.secure-maintai.kku.edu.sa/api/v1"
   Environment="AGENT_DEPARTMENT=Computer Science"
   Environment="AGENT_LAB=CS Lab 101"
   ExecStart=/opt/secure-maintai/agent/.venv/bin/python main.py
   Restart=always
   RestartSec=10

   [Install]
   WantedBy=multi-user.target
   ```

2. Enable and start the service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable secure-maintai-agent
   sudo systemctl start secure-maintai-agent
   ```

3. Check service status and logs:
   ```bash
   sudo systemctl status secure-maintai-agent
   sudo journalctl -u secure-maintai-agent -f
   ```

---

### Method 3: Running in the Background on Windows

To run the agent in the background on Windows without keeping a terminal open:

**Using Windows Task Scheduler (Recommended for Lab PCs):**
1. Open **Task Scheduler** (`taskschd.msc`).
2. Click **Create Basic Task** $\rightarrow$ Name: `SecureMaintAIAgent`.
3. Set Trigger: **When the computer starts**.
4. Set Action: **Start a program**.
   - **Program/script:** `C:\path\to\secure-maintai\agent\.venv\Scripts\pythonw.exe`
   - **Add arguments:** `main.py`
   - **Start in:** `C:\path\to\secure-maintai\agent`
5. Finish and start the task.

*(Note: Using `pythonw.exe` runs the process invisibly in the background without opening a console window).*

---

## 5. Verifying Agent Operation

### 1. Enrollment Verification
On its first run, the agent automatically registers the workstation with the backend and saves its credentials in `.agent_state.json`:
```json
{
  "agent_id": "c71e9882-628d-4ba6-86c0-d3065b75b9f7",
  "workstation_id": "31b088b9-8e6f-4537-8f78-1ff2f08a9561",
  "auth_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "agent_version": "1.0.0"
}
```
If this file exists and contains valid UUIDs, enrollment was successful.

### 2. Normal Log Signatures
A healthy agent outputs log entries similar to:
```text
2026-09-18 18:00:00 [INFO] [secure-maintai.agent] Agent successfully registered: agent_id=c71e..., workstation_id=31b0...
2026-09-18 18:00:10 [INFO] [secure-maintai.agent] Transmitted 1 telemetry records. Buffer remaining: 0.
2026-09-18 18:01:00 [INFO] [secure-maintai.agent] Heartbeat sent successfully.
```

### 3. Testing Offline Buffer Resilience
1. Disconnect the workstation's network or stop the backend server.
2. The agent logs will indicate network buffering:
   ```text
   [WARNING] [agent.client] Network error transmitting telemetry...
   [INFO] [secure-maintai.agent] Queued telemetry snapshot to local disk buffer.
   ```
3. Reconnect the network.
4. The agent automatically drains the SQLite queue (`.agent_buffer/telemetry_queue.db`) in batches without data loss.

---

## 6. Troubleshooting & Diagnostics

| Symptom | Probable Cause | Remediation |
| :--- | :--- | :--- |
| **`Connection refused` / `Failed to enroll agent`** | Backend server is not running or unreachable at `AGENT_BACKEND_URL`. | Verify backend is up (`curl http://<backend-ip>:8000/api/v1/health`) and firewall allows traffic. |
| **`422 Unprocessable Entity`** | Telemetry schema mismatch or metric value out of bounds. | Ensure agent is running version 1.0.0+ matching the backend schema. |
| **`PermissionDenied` during process sampling** | Agent run under restricted account cannot inspect system process PIDs. | Run with standard or elevated permissions (`sudo` on Linux / Run as Administrator on Windows). |
| **Device appears `OFFLINE` on Dashboard** | Heartbeats haven't been received for $>3$ minutes. | Check if agent process is still running and network connection is active. |
| **Re-registering a Workstation** | You want to regenerate a new agent identity. | Delete `.agent_state.json` and restart the agent daemon. |

---

## 7. Security & Compliance Notes

1. **Outbound Only:** The agent never listens on open inbound ports; it communicates purely via outbound HTTPS.
2. **No Remote Code Execution:** The agent does not execute server-supplied commands (Rule 9).
3. **Data Integrity:** All payloads are timestamped in UTC and cryptographically tied to the workstation's enrolled bearer token.
