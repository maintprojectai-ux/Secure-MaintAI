import {
  User,
  Workstation,
  WorkstationPaginatedResponse,
  Alert,
  SecurityEvent,
  MaintenanceTask,
  AuditLogEntry,
  DashboardOverviewKPI,
  ThreatOrigin,
  AttackMatrixCell,
  ModelMetrics,
  ProcessItem,
  UserManagementItem,
  SupportTicket,
  FAQItem,
  CyberKPIs,
  ActiveThreatItem,
  VulnerabilityItem,
  SecurityEventItem,
  SecurityPostureDimension,
  ThreatIntelItem,
  PredictionOverviewKPIs,
  TopPredictionItem,
  AIInsightItem,
  AIModelMetadata,
  MaintenanceOverviewKPIs,
  ScheduledTaskItem,
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceStatus,
  ExecutiveReportKPIs,
  ReportHealthOverview,
  ReportWeeklyThreat,
  ResourceUtilizationMetric,
  TopAlertCategory,
  DashboardKpis,
  ValidationMetricsResponse,
  DemoExecutionReceipt,
  DemoScenarioType,
  TelemetryMetric,
} from "@/types";

const API_BASE = "/api/v1";

export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("access_token");
  if (
    !token ||
    token.startsWith("demo-") ||
    token.startsWith("jwt-") ||
    token === "demo-jwt-token-active" ||
    token === "demo-session"
  ) {
    return null;
  }
  return token;
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("access_token", token);
  // Also set cookie for Next.js proxy.ts edge checks
  document.cookie = `access_token=${token}; path=/; max-age=86400; SameSite=Lax`;
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("access_token");
  localStorage.removeItem("current_user");
  document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
}

export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("current_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: User): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("current_user", JSON.stringify(user));
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: "include",
    });

    if (!res.ok) {
      if (res.status === 401) {
        clearToken();
      }
      const errorData = await res.json().catch(() => ({}));
      throw new ApiError(
        res.status,
        errorData.detail || `Request to ${endpoint} failed with status ${res.status}`,
        errorData
      );
    }

    return (await res.json()) as T;
  } catch (err: unknown) {
    if (err instanceof ApiError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new ApiError(500, `Network error: ${msg}`);
  }
}

// --------------------------------------------------------------------------
// MOCK RESILIENCE SEED DATA (Faithful to the 13 approved UI Mockups)
// --------------------------------------------------------------------------

export const MOCK_CURRENT_USER: User = {
  id: "usr-admin-001",
  email: "admin@university.edu",
  full_name: "Dr. Sarah Al-Rashid",
  role: "ADMIN",
  department: "Cybersecurity & IT Infrastructure",
  is_active: true,
  created_at: "2026-01-15T08:00:00Z",
  last_login: "2026-09-10T08:30:00Z",
};

export const MOCK_DASHBOARD_KPI: DashboardOverviewKPI = {
  total_workstations: 150,
  online_workstations: 100,
  warning_workstations: 30,
  critical_workstations: 15,
  offline_workstations: 5,
  active_threats: 5,
  system_resilience_score: 84.2,
  average_cpu: 42.0,
  average_ram: 68.0,
  average_disk: 54.0,
};

export const MOCK_WORKSTATIONS: Workstation[] = [
  {
    id: "ws-srv-aca01",
    hostname: "SRV-ACA-01",
    ip_address: "10.10.1.10",
    os_type: "Windows Server 2019",
    os_version: "1809 (17763)",
    department: "Main Data Center",
    status: "ONLINE",
    last_seen_at: new Date().toISOString(),
    created_at: "2026-01-10T08:00:00Z",
    cpu_usage: 42.0,
    memory_usage: 68.0,
    disk_usage: 54.0,
    network_throughput: 1000,
    process_count: 148,
    is_isolated: false,
    assigned_user: {
      id: "u-adm-001",
      email: "admin@university.edu",
      full_name: "IT Infrastructure Admin",
      role: "ADMIN",
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
    },
  },
  {
    id: "ws-cs-101",
    hostname: "CS-LAB-WS-01",
    ip_address: "10.0.12.14",
    os_type: "Ubuntu Linux",
    os_version: "24.04 LTS",
    department: "Computer Science",
    status: "CRITICAL",
    last_seen_at: new Date().toISOString(),
    created_at: "2026-02-01T10:00:00Z",
    cpu_usage: 98.4,
    memory_usage: 88.2,
    disk_usage: 62.0,
    network_throughput: 840,
    process_count: 245,
    is_isolated: false,
    assigned_user: {
      id: "u-stu-441",
      email: "student441@university.edu",
      full_name: "Khalid Mansoor",
      role: "STUDENT",
      is_active: true,
      created_at: "2026-02-01T00:00:00Z",
    },
  },
  {
    id: "ws-ai-204",
    hostname: "HPC-RESEARCH-NODE-04",
    ip_address: "10.0.24.88",
    os_type: "Debian GNU/Linux",
    os_version: "12 Bookworm",
    department: "AI Research Lab",
    status: "WARNING",
    last_seen_at: new Date().toISOString(),
    created_at: "2026-01-10T09:00:00Z",
    cpu_usage: 98.1,
    memory_usage: 99.4,
    disk_usage: 84.5,
    network_throughput: 2400,
    process_count: 312,
    is_isolated: false,
    assigned_user: {
      id: "u-res-102",
      email: "dr.tariq@university.edu",
      full_name: "Prof. Tariq Al-Omari",
      role: "RESEARCHER",
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
    },
  },
  {
    id: "ws-ee-018",
    hostname: "EE-CIRCUITS-WS-18",
    ip_address: "10.0.32.22",
    os_type: "Windows 11 Pro",
    os_version: "23H2",
    department: "Electrical Engineering",
    status: "ONLINE",
    last_seen_at: new Date().toISOString(),
    created_at: "2026-03-05T11:00:00Z",
    cpu_usage: 24.5,
    memory_usage: 52.0,
    disk_usage: 41.2,
    network_throughput: 120,
    process_count: 168,
    is_isolated: false,
  },
  {
    id: "ws-med-005",
    hostname: "MED-CLINIC-SRV-02",
    ip_address: "10.0.45.10",
    os_type: "Windows Server 2022",
    os_version: "Standard",
    department: "Medical Sciences",
    status: "ONLINE",
    last_seen_at: new Date().toISOString(),
    created_at: "2026-01-20T14:00:00Z",
    cpu_usage: 38.2,
    memory_usage: 64.1,
    disk_usage: 58.9,
    network_throughput: 450,
    process_count: 198,
    is_isolated: false,
  },
  {
    id: "ws-adm-012",
    hostname: "ADMIN-FINANCE-07",
    ip_address: "10.0.10.45",
    os_type: "Windows 11 Pro",
    os_version: "23H2",
    department: "Administration",
    status: "OFFLINE",
    last_seen_at: "2026-09-09T18:22:00Z",
    created_at: "2026-02-15T08:30:00Z",
    cpu_usage: 0,
    memory_usage: 0,
    disk_usage: 45.0,
    network_throughput: 0,
    process_count: 0,
    is_isolated: false,
  },
  {
    id: "ws-eng-092",
    hostname: "MECH-CAD-WORKSTATION-12",
    ip_address: "10.0.38.92",
    os_type: "Windows 11 Pro",
    os_version: "23H2",
    department: "Mechanical Engineering",
    status: "ONLINE",
    last_seen_at: new Date().toISOString(),
    created_at: "2026-02-28T16:00:00Z",
    cpu_usage: 45.8,
    memory_usage: 68.3,
    disk_usage: 60.1,
    network_throughput: 210,
    process_count: 182,
    is_isolated: false,
  },
];

export const MOCK_ALERTS: Alert[] = [
  {
    id: "alt-9021",
    title: "Cryptomining Binary Detected (XMRig Signature)",
    description: "Anomalous multi-core CPU exhaustion (98%) matched with outbound pool connection to 194.26.29.112:3333.",
    severity: "CRITICAL",
    status: "NEW",
    source: "Model 02-B + Wazuh SIEM",
    workstation_id: "ws-cs-101",
    workstation_hostname: "CS-LAB-WS-01",
    anomaly_score: 0.982,
    created_at: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
  },
  {
    id: "alt-8994",
    title: "High Sustained GPU/CPU Load (HPC Simulation)",
    description: "Multi-threaded PyTorch workload consuming 89% CPU. IdP confirms user is Verified Researcher. Preserving state.",
    severity: "MEDIUM",
    status: "ACKNOWLEDGED",
    source: "Model 01 SMD Anomaly Detector",
    workstation_id: "ws-ai-204",
    workstation_hostname: "HPC-RESEARCH-NODE-04",
    anomaly_score: 0.814,
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: "alt-8850",
    title: "Anomalous PowerShell Execution with Base64 Payload",
    description: "Hidden encoded command invocation flagged by Sysmon Event ID 1 in Student workstation segment.",
    severity: "HIGH",
    status: "NEW",
    source: "Sysmon Adapter",
    workstation_id: "ws-cs-101",
    workstation_hostname: "CS-LAB-WS-01",
    anomaly_score: 0.924,
    created_at: new Date(Date.now() - 1000 * 60 * 82).toISOString(),
  },
  {
    id: "alt-8712",
    title: "Out of Disk Space Warning (< 5% Free Buffer)",
    description: "System drive C: reached 96% utilization on Medical Records server. Cache purge recommended.",
    severity: "LOW",
    status: "RESOLVED",
    source: "Health Telemetry Rule Engine",
    workstation_id: "ws-med-005",
    workstation_hostname: "MED-CLINIC-SRV-02",
    anomaly_score: 0.450,
    created_at: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    resolved_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
];

export const MOCK_SECURITY_EVENTS: SecurityEvent[] = [
  {
    id: "sec-001",
    event_id: "EVT-WAZUH-9142",
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    source: "WAZUH",
    workstation_id: "ws-cs-101",
    workstation_hostname: "CS-LAB-WS-01",
    user: "khalid.mansoor",
    event_type: "Cryptojacking Pool Beaconing",
    severity: "CRITICAL",
    confidence: 0.96,
    evidence: { remote_ip: "194.26.29.112", port: 3333, protocol: "stratum+tcp" },
  },
  {
    id: "sec-002",
    event_id: "EVT-SYSMON-1044",
    timestamp: new Date(Date.now() - 1000 * 60 * 22).toISOString(),
    source: "SYSMON",
    workstation_id: "ws-cs-101",
    workstation_hostname: "CS-LAB-WS-01",
    user: "SYSTEM",
    event_type: "Unusual Service Creation",
    severity: "HIGH",
    confidence: 0.88,
    evidence: { service_name: "win_crypto_svc", bin_path: "C:\\Temp\\xmrig.exe" },
  },
  {
    id: "sec-003",
    event_id: "EVT-NET-4091",
    timestamp: new Date(Date.now() - 1000 * 60 * 48).toISOString(),
    source: "NETWORK_SOCKET",
    workstation_id: "ws-ai-204",
    workstation_hostname: "HPC-RESEARCH-NODE-04",
    user: "tariq.alomari",
    event_type: "High-Bandwidth Dataset Sync",
    severity: "LOW",
    confidence: 0.99,
    evidence: { destination: "huggingface.co", bytes_transferred: 14800000000 },
  },
];

export const MOCK_THREAT_ORIGINS: ThreatOrigin[] = [
  { country: "Eastern Europe", code: "RU", count: 1420, percentage: 42, color: "#ef4444" },
  { country: "East Asia", code: "CN", count: 980, percentage: 29, color: "#f59e0b" },
  { country: "North America (Tor)", code: "US", count: 480, percentage: 14, color: "#3b82f6" },
  { country: "South America", code: "BR", count: 310, percentage: 9, color: "#8b5cf6" },
  { country: "Others", code: "OT", count: 210, percentage: 6, color: "#64748b" },
];

export const MOCK_ATTACK_MATRIX: AttackMatrixCell[] = Array.from({ length: 24 }).map((_, hour) => {
  const intensity = hour >= 2 && hour <= 6 ? "high" : hour >= 13 && hour <= 17 ? "medium" : "low";
  return {
    hour,
    day: "Today",
    attacks: Math.floor(Math.random() * (intensity === "high" ? 80 : 30)) + (intensity === "high" ? 40 : 5),
    severity: intensity === "high" ? "critical" : intensity === "medium" ? "high" : "low",
  };
});

export const MOCK_MODEL_METRICS: ModelMetrics[] = [
  {
    name: "Model 01: Machine Telemetry Anomaly Detector",
    version: "v1.2.0 (SMD 38-Channel Isolation Forest)",
    f1_score: 0.936,
    precision: 0.948,
    recall: 0.925,
    false_positive_rate: 0.038,
    latency_ms: 1.4,
    status: "OPERATIONAL",
  },
  {
    name: "Model 02-A: Technical Root Cause Classifier",
    version: "v1.1.0 (RCAEval 33-Metric Aggregator)",
    f1_score: 0.912,
    precision: 0.920,
    recall: 0.905,
    false_positive_rate: 0.052,
    latency_ms: 2.1,
    status: "OPTIMAL",
  },
  {
    name: "Model 02-B: Windows Sysmon APT Threat Classifier",
    version: "v1.3.0 (30-Feature Random Forest)",
    f1_score: 0.978,
    precision: 0.984,
    recall: 0.972,
    false_positive_rate: 0.016,
    latency_ms: 1.8,
    status: "OPERATIONAL",
  },
];

export const MOCK_MAINTENANCE_TASKS: MaintenanceTask[] = [
  {
    id: "mnt-101",
    title: "Kernel Security Patching (Linux 6.8)",
    workstation_id: "ws-cs-101",
    workstation_hostname: "CS-LAB-WS-01",
    department: "Computer Science",
    status: "SCHEDULED",
    scheduled_date: "2026-09-12 02:00",
    duration_minutes: 45,
    technician: "Alex Rivera",
    type: "PATCH",
  },
  {
    id: "mnt-102",
    title: "Thermal Paste Replacement & Dust Cleanout",
    workstation_id: "ws-ai-204",
    workstation_hostname: "HPC-RESEARCH-NODE-04",
    department: "AI Research Lab",
    status: "IN_PROGRESS",
    scheduled_date: "2026-09-10 14:00",
    duration_minutes: 60,
    technician: "Ziyad Hassan",
    type: "HARDWARE_CHECK",
  },
  {
    id: "mnt-103",
    title: "Storage Cache Compaction & Log Cleanup",
    workstation_id: "ws-med-005",
    workstation_hostname: "MED-CLINIC-SRV-02",
    department: "Medical Sciences",
    status: "COMPLETED",
    scheduled_date: "2026-09-09 23:00",
    duration_minutes: 30,
    technician: "System Auto-Playbook",
    type: "OPTIMIZATION",
  },
  {
    id: "mnt-104",
    title: "Full Anti-Ransomware Deep Scan",
    workstation_id: "ws-adm-012",
    workstation_hostname: "ADMIN-FINANCE-07",
    department: "Administration",
    status: "OVERDUE",
    scheduled_date: "2026-09-08 19:00",
    duration_minutes: 90,
    technician: "Security Ops",
    type: "SECURITY_SCAN",
  },
];

export const MOCK_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: "aud-9801",
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    user_email: "admin@university.edu",
    action: "Trigger Surgical Isolation",
    category: "SECURITY",
    target: "CS-LAB-WS-01 (10.0.12.14)",
    status: "SUCCESS",
    ip_address: "10.0.1.5",
  },
  {
    id: "aud-9788",
    timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    user_email: "operator@university.edu",
    action: "Acknowledge Alert #alt-8994",
    category: "SYSTEM",
    target: "HPC-RESEARCH-NODE-04",
    status: "SUCCESS",
    ip_address: "10.0.1.18",
  },
  {
    id: "aud-9742",
    timestamp: new Date(Date.now() - 1000 * 60 * 75).toISOString(),
    user_email: "sys-soar-engine",
    action: "SOAR Playbook Execution: Process Containment",
    category: "SECURITY",
    target: "PID 4192 (xmrig.exe)",
    status: "SUCCESS",
    ip_address: "127.0.0.1",
  },
  {
    id: "aud-9690",
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    user_email: "admin@university.edu",
    action: "Update ML Anomaly Threshold",
    category: "API",
    target: "Model 01 Config (0.95 -> 0.98)",
    status: "SUCCESS",
    ip_address: "10.0.1.5",
  },
];

export const MOCK_TOP_PROCESSES: ProcessItem[] = [
  { pid: 4192, name: "xmrig.exe", cpu_percent: 78.4, memory_percent: 32.1, user: "khalid", status: "running", command: "xmrig -o 194.26.29.112:3333" },
  { pid: 1042, name: "code.exe", cpu_percent: 12.2, memory_percent: 18.4, user: "khalid", status: "running" },
  { pid: 882, name: "chrome.exe", cpu_percent: 6.8, memory_percent: 22.0, user: "khalid", status: "running" },
  { pid: 441, name: "python3", cpu_percent: 4.1, memory_percent: 14.5, user: "khalid", status: "running" },
  { pid: 1, name: "systemd", cpu_percent: 0.1, memory_percent: 1.2, user: "root", status: "sleeping" },
];

export const MOCK_USER_MANAGEMENT_LIST: UserManagementItem[] = [
  {
    id: "usr-001",
    full_name: "Dr. Sarah Al-Rashid",
    email: "admin@university.edu",
    role: "ADMIN",
    department: "Cybersecurity & IT Infrastructure",
    status: "ACTIVE",
    last_login: "2026-09-10 08:30 AM",
    two_factor_enabled: true,
  },
  {
    id: "usr-002",
    full_name: "Alex Rivera",
    email: "operator@university.edu",
    role: "IT_OPERATOR",
    department: "IT Infrastructure Support",
    status: "ACTIVE",
    last_login: "2026-09-10 09:12 AM",
    two_factor_enabled: true,
  },
  {
    id: "usr-003",
    full_name: "Dr. Tariq Al-Omari",
    email: "researcher@university.edu",
    role: "RESEARCHER",
    department: "Artificial Intelligence Lab",
    status: "ACTIVE",
    last_login: "2026-09-09 04:45 PM",
    two_factor_enabled: true,
  },
  {
    id: "usr-004",
    full_name: "Khalid Mansoor",
    email: "student441@university.edu",
    role: "STUDENT",
    department: "Computer Science",
    status: "ACTIVE",
    last_login: "2026-09-10 09:50 AM",
    two_factor_enabled: false,
  },
  {
    id: "usr-005",
    full_name: "Nora Al-Ghamdi",
    email: "nora.ghamdi@university.edu",
    role: "ADMIN",
    department: "Administration",
    status: "ACTIVE",
    last_login: "2026-09-08 11:20 AM",
    two_factor_enabled: true,
  },
  {
    id: "usr-006",
    full_name: "Yousef Salem",
    email: "yousef.salem@university.edu",
    role: "IT_OPERATOR",
    department: "Cybersecurity Ops",
    status: "ACTIVE",
    last_login: "2026-09-10 07:15 AM",
    two_factor_enabled: true,
  },
  {
    id: "usr-007",
    full_name: "Laila Al-Mansoor",
    email: "laila.mansoor@university.edu",
    role: "RESEARCHER",
    department: "Bioinformatics Research",
    status: "ACTIVE",
    last_login: "2026-09-07 02:30 PM",
    two_factor_enabled: false,
  },
  {
    id: "usr-008",
    full_name: "Fahad Al-Khatib",
    email: "fahad.khatib@university.edu",
    role: "STUDENT",
    department: "Information Systems",
    status: "PENDING",
    last_login: "Never",
    two_factor_enabled: false,
  },
  {
    id: "usr-009",
    full_name: "Amal Al-Zahrani",
    email: "amal.zahrani@university.edu",
    role: "STUDENT",
    department: "Software Engineering",
    status: "ACTIVE",
    last_login: "2026-09-09 08:10 PM",
    two_factor_enabled: true,
  },
  {
    id: "usr-010",
    full_name: "Eng. Sultan Al-Harbi",
    email: "sultan.harbi@university.edu",
    role: "IT_OPERATOR",
    department: "Network Operations Center",
    status: "ACTIVE",
    last_login: "2026-09-10 09:30 AM",
    two_factor_enabled: true,
  },
];

export const MOCK_FULL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: "aud-9805",
    timestamp: "2026-09-16 18:28:14",
    user_email: "admin@university.edu",
    action: "Trigger Surgical Isolation",
    category: "SECURITY",
    target: "CS-LAB-WS-01 (10.0.12.14)",
    status: "SUCCESS",
    ip_address: "10.0.1.5",
  },
  {
    id: "aud-9804",
    timestamp: "2026-09-16 18:22:05",
    user_email: "sys-soar-engine",
    action: "Automated Process Containment",
    category: "SECURITY",
    target: "PID 4192 (xmrig.exe)",
    status: "SUCCESS",
    ip_address: "127.0.0.1",
  },
  {
    id: "aud-9803",
    timestamp: "2026-09-16 18:15:30",
    user_email: "operator@university.edu",
    action: "Acknowledge Alert #alt-8994",
    category: "SYSTEM",
    target: "HPC-RESEARCH-NODE-04",
    status: "SUCCESS",
    ip_address: "10.0.1.18",
  },
  {
    id: "aud-9802",
    timestamp: "2026-09-16 17:50:11",
    user_email: "admin@university.edu",
    action: "Update ML Anomaly Threshold",
    category: "API",
    target: "Model 01 Isolation Forest (0.95 -> 0.98)",
    status: "SUCCESS",
    ip_address: "10.0.1.5",
  },
  {
    id: "aud-9801",
    timestamp: "2026-09-16 17:30:00",
    user_email: "admin@university.edu",
    action: "User Login",
    category: "USER",
    target: "Web Console Session (MFA Verified)",
    status: "SUCCESS",
    ip_address: "10.0.1.5",
  },
  {
    id: "aud-9800",
    timestamp: "2026-09-16 16:45:22",
    user_email: "operator@university.edu",
    action: "Schedule Maintenance Window",
    category: "SYSTEM",
    target: "CS-LAB-WS-01 Kernel Patching",
    status: "SUCCESS",
    ip_address: "10.0.1.18",
  },
  {
    id: "aud-9799",
    timestamp: "2026-09-16 15:12:00",
    user_email: "system-cron",
    action: "Automated Daily Security Scan",
    category: "SECURITY",
    target: "248 University Workstations",
    status: "SUCCESS",
    ip_address: "127.0.0.1",
  },
  {
    id: "aud-9798",
    timestamp: "2026-09-16 14:30:15",
    user_email: "unknown",
    action: "Failed Login Attempt (Brute Force)",
    category: "SECURITY",
    target: "Account: admin@university.edu",
    status: "FAILURE",
    ip_address: "194.26.29.112",
  },
  {
    id: "aud-9797",
    timestamp: "2026-09-16 12:00:00",
    user_email: "system-backup",
    action: "Automated Database Encrypted Snapshot",
    category: "SYSTEM",
    target: "Cloud Storage Bucket (AES-256)",
    status: "SUCCESS",
    ip_address: "127.0.0.1",
  },
  {
    id: "aud-9796",
    timestamp: "2026-09-15 23:14:02",
    user_email: "admin@university.edu",
    action: "Create User Account",
    category: "USER",
    target: "Fahad Al-Khatib (fahad.khatib@university.edu)",
    status: "SUCCESS",
    ip_address: "10.0.1.5",
  },
];

export const MOCK_SUPPORT_TICKETS: SupportTicket[] = [
  {
    id: "tkt-001",
    ticket_number: "#TK-2026-00124",
    title: "Database connection intermittent timeout under load",
    category: "Database & Backend",
    status: "OPEN",
    priority: "HIGH",
    created_at: "Sep 16, 2026",
    author: "Ziyad Hassan (IT Operator)",
  },
  {
    id: "tkt-002",
    ticket_number: "#TK-2026-00118",
    title: "Alert not triggered for high sustained CPU on Node 07",
    category: "Alerts & Notifications",
    status: "IN_PROGRESS",
    priority: "MEDIUM",
    created_at: "Sep 15, 2026",
    author: "Alex Rivera (IT Operator)",
  },
  {
    id: "tkt-003",
    ticket_number: "#TK-2026-00105",
    title: "Report generation PDF formatting overflow on wide tables",
    category: "Reports & Analytics",
    status: "RESOLVED",
    priority: "LOW",
    created_at: "Sep 12, 2026",
    author: "Dr. Sarah Al-Rashid (Admin)",
  },
  {
    id: "tkt-004",
    ticket_number: "#TK-2026-00098",
    title: "Adding new workstation fails on macOS telemetry agent handshake",
    category: "Device Monitoring",
    status: "CLOSED",
    priority: "MEDIUM",
    created_at: "Sep 08, 2026",
    author: "Sultan Al-Harbi (NOC)",
  },
];

export const MOCK_FAQS: FAQItem[] = [
  {
    id: "faq-1",
    question: "How do I add a new workstation or server to the fleet?",
    answer: "Navigate to the Device Monitoring page and click '+ Add Device'. Enter the workstation hostname, IP, MAC address, and select the target department. Next, deploy the Secure-MaintAI lightweight telemetry agent binary or use the provided curl/powershell one-liner with the generated enrollment token.",
    category: "Devices",
  },
  {
    id: "faq-2",
    question: "How can I schedule an automated maintenance task?",
    answer: "Go to Maintenance Schedule and click '+ Schedule Maintenance'. Select the target workstation, maintenance type (Kernel Patching, Hardware Check, Optimization, or Security Deep Scan), select the execution window and assign an operator or enable auto-playbook execution.",
    category: "Maintenance",
  },
  {
    id: "faq-3",
    question: "How does the AI distinguish technical strain from cyber threats?",
    answer: "Secure-MaintAI employs a multi-tier pipeline: Model 01 (SMD Isolation Forest) screens for machine telemetry anomalies. When an anomaly is detected, Model 02-A checks system logs for technical root causes (memory leaks, thermal throttling), while Model 02-B examines Sysmon process behavior and network beaconing. University IdP identity context is correlated to prevent false alarms on legitimate research workloads.",
    category: "AI & Security",
  },
  {
    id: "faq-4",
    question: "How do I trigger or revert a surgical isolation?",
    answer: "From the Device Details or Alerts page, authorized Administrators and IT Operators can click 'Surgical Isolation'. This executes an OS-native packet-filter block restricting outbound sockets while preserving SSH/management channels and active research processes. To revert, click 'Rollback Isolation' on the same page.",
    category: "SOAR",
  },
  {
    id: "faq-5",
    question: "How do I configure role-based permissions and 2FA?",
    answer: "Go to Settings > Security to configure system-wide password complexity, MFA enforcement, and IP subnet whitelisting. In Users Management, you can assign roles (Admin, IT Operator, Researcher, Student) which are verified cryptographically server-side on every request.",
    category: "Access Control",
  },
];

export const MOCK_CYBER_KPIS: CyberKPIs = {
  threats_detected: 312,
  threats_detected_change: "↑ 28% vs last 24h",
  high_risk_events: 87,
  high_risk_change: "↑ 35% vs last 24h",
  blocked_attacks: "1,248",
  blocked_attacks_change: "↑ 18% vs last 24h",
  affected_devices: 23,
  affected_devices_change: "↑ 15% vs last 24h",
  security_score: 72,
  security_score_change: "↑ 8 pts vs last 24h",
};

export const MOCK_CYBER_ATTACK_DISTRIBUTION = [
  { label: "Malware", value: 156, percentage: 50.0, color: "#06b6d4" },
  { label: "DDoS", value: 93, percentage: 29.8, color: "#3b82f6" },
  { label: "Brute Force", value: 41, percentage: 13.1, color: "#f59e0b" },
  { label: "Exploits", value: 22, percentage: 7.1, color: "#8b5cf6" },
];

export const MOCK_TOP_ATTACKED_COUNTRIES = [
  { country: "United States", count: 128 },
  { country: "China", count: 96 },
  { country: "Germany", count: 45 },
  { country: "Netherlands", count: 32 },
  { country: "Russia", count: 24 },
];

export const MOCK_ACTIVE_THREATS: ActiveThreatItem[] = [
  {
    id: "thr-01",
    title: "Malware Campaign Detected",
    category: "MALWARE",
    risk: "High Risk",
    target_description: "Multiple endpoints targeted",
    target_ip: "10.10.1.45",
    time_ago: "15 min ago",
    status: "Investigating",
    statusColor: "amber",
  },
  {
    id: "thr-02",
    title: "DDoS Attack",
    category: "DDOS",
    risk: "Critical",
    target_description: "Target: Data Center 1",
    target_ip: "185.22.12.9",
    time_ago: "22 min ago",
    status: "Active",
    statusColor: "rose",
  },
  {
    id: "thr-03",
    title: "Brute Force Attempt",
    category: "BRUTE_FORCE",
    risk: "Medium",
    target_description: "SSH login attempts detected",
    target_ip: "10.10.2.78",
    time_ago: "35 min ago",
    status: "Active",
    statusColor: "amber",
  },
  {
    id: "thr-04",
    title: "SQL Injection Attempt",
    category: "SQLI",
    risk: "Medium",
    target_description: "Web Application Firewall",
    target_ip: "app.secure-maintai.com",
    time_ago: "1 hour ago",
    status: "Blocked",
    statusColor: "emerald",
  },
  {
    id: "thr-05",
    title: "Suspicious Internal Activity",
    category: "SUSPICIOUS",
    risk: "Low",
    target_description: "Unusual data transfer detected",
    target_ip: "User: admin_backup",
    time_ago: "2 hour ago",
    status: "Monitoring",
    statusColor: "blue",
  },
];

export const MOCK_TOP_VULNERABILITIES: VulnerabilityItem[] = [
  { cve: "CVE-2025-3175", severity: "Critical", affected_assets: 12, cvss_score: 9.8 },
  { cve: "CVE-2025-2148", severity: "High", affected_assets: 8, cvss_score: 8.6 },
  { cve: "CVE-2025-1427", severity: "High", affected_assets: 5, cvss_score: 7.5 },
  { cve: "CVE-2025-0981", severity: "Medium", affected_assets: 18, cvss_score: 6.4 },
  { cve: "CVE-2025-0765", severity: "Medium", affected_assets: 22, cvss_score: 5.3 },
];

export const MOCK_RECENT_SECURITY_EVENTS: SecurityEventItem[] = [
  {
    id: "evt-01",
    time: "Sep 16, 18:32:11",
    event: "Malware Detected",
    source: "10.10.1.45",
    destination: "185.22.12.9",
    severity: "Critical",
    status: "Investigating",
    statusColor: "amber",
  },
  {
    id: "evt-02",
    time: "Sep 16, 18:21:45",
    event: "DDoS Attack",
    source: "185.22.12.9",
    destination: "10.10.3.12",
    severity: "Critical",
    status: "Blocked",
    statusColor: "emerald",
  },
  {
    id: "evt-03",
    time: "Sep 16, 18:18:22",
    event: "Brute Force Attempt",
    source: "203.0.113.45",
    destination: "10.10.2.78",
    severity: "Medium",
    status: "Active",
    statusColor: "amber",
  },
  {
    id: "evt-04",
    time: "Sep 16, 18:05:13",
    event: "SQL Injection",
    source: "198.51.100.23",
    destination: "app.secure-maintai.com",
    severity: "Medium",
    status: "Blocked",
    statusColor: "emerald",
  },
  {
    id: "evt-05",
    time: "Sep 16, 17:58:09",
    event: "Suspicious Login",
    source: "10.10.5.22",
    destination: "10.10.1.10",
    severity: "Low",
    status: "Monitoring",
    statusColor: "blue",
  },
];

export const MOCK_SECURITY_POSTURE_DIMENSIONS: SecurityPostureDimension[] = [
  { name: "Network Security", score: 78, max: 100, colorHex: "#14b8a6" },
  { name: "Endpoint Protection", score: 70, max: 100, colorHex: "#14b8a6" },
  { name: "Application Security", score: 66, max: 100, colorHex: "#06b6d4" },
  { name: "Data Protection", score: 75, max: 100, colorHex: "#3b82f6" },
  { name: "Access Management", score: 71, max: 100, colorHex: "#f59e0b" },
  { name: "Compliance", score: 68, max: 100, colorHex: "#8b5cf6" },
];

export const MOCK_THREAT_INTEL_FEED: ThreatIntelItem[] = [
  {
    id: "ti-01",
    type: "malware",
    title: "New Malware Strain Detected",
    description: "A new malware strain 'DarkGate v2' is targeting Windows servers.",
    time_ago: "2 hours ago",
  },
  {
    id: "ti-02",
    type: "phishing",
    title: "Phishing Campaign Increased",
    description: "Phishing attacks increased by 40% targeting finance sector.",
    time_ago: "5 hours ago",
  },
  {
    id: "ti-03",
    type: "cve",
    title: "Critical Vulnerability Published",
    description: "New critical vulnerability CVE-2025-3175 published in Apache.",
    time_ago: "7 hours ago",
  },
];

export const MOCK_SUBNET_HEATMAP_DATA = [
  { time: "00:00", values: [15, 22, 10, 8, 12, 5] },
  { time: "04:00", values: [25, 45, 18, 14, 20, 10] },
  { time: "08:00", values: [60, 85, 40, 32, 50, 22] },
  { time: "12:00", values: [95, 98, 70, 65, 80, 45] },
  { time: "16:00", values: [75, 88, 55, 48, 62, 30] },
  { time: "20:00", values: [40, 60, 30, 25, 35, 18] },
];

export const MOCK_PREDICTION_KPIS: PredictionOverviewKPIs = {
  predicted_issues: 23,
  predicted_issues_change: "↑ 35% vs last 7 days",
  high_risk_predictions: 8,
  high_risk_change: "↑ 20% vs last 7 days",
  prevented_issues: 47,
  prevented_issues_change: "↑ 62% vs last 7 days",
  prediction_accuracy: 93.6,
  accuracy_change: "↑ 4.2% vs last 7 days",
};

export const MOCK_PREDICTION_TRENDS = {
  days: ["Sep 10", "Sep 11", "Sep 12", "Sep 13", "Sep 14", "Sep 15", "Sep 16"],
  predicted_issues: [58, 62, 54, 65, 59, 70, 88],
  high_risk: [24, 28, 26, 32, 29, 38, 50],
  prevented: [18, 16, 22, 25, 20, 26, 35],
  resolved: [8, 12, 10, 15, 14, 18, 24],
};

export const MOCK_CONFIDENCE_DISTRIBUTION = [
  { label: "High", percentage: 93.6, color: "#3b82f6" },
  { label: "Medium", percentage: 5.2, color: "#f59e0b" },
  { label: "Low", percentage: 1.2, color: "#64748b" },
];

export const MOCK_TOP_PREDICTIONS: TopPredictionItem[] = [
  {
    id: "pred-01",
    risk: "High Risk",
    riskType: "danger",
    device: "SRV-ACA-01",
    issue: "High CPU Usage",
    predicted_time: "Predicted: Sep 17, 2026 10:00 AM",
    confidence_score: 92,
    confidence_label: "92% Confidence",
    sparkline_color: "#f43f5e",
  },
  {
    id: "pred-02",
    risk: "Medium Risk",
    riskType: "warning",
    device: "LAB-DB-02",
    issue: "Disk Space Full",
    predicted_time: "Predicted: Sep 18, 2026 03:00 AM",
    confidence_score: 78,
    confidence_label: "78% Confidence",
    sparkline_color: "#f59e0b",
  },
  {
    id: "pred-03",
    risk: "High Risk",
    riskType: "danger",
    device: "SW-CORE-01",
    issue: "Network Latency",
    predicted_time: "Predicted: Sep 16, 2026 08:00 PM",
    confidence_score: 85,
    confidence_label: "85% Confidence",
    sparkline_color: "#f43f5e",
  },
  {
    id: "pred-04",
    risk: "Low Risk",
    riskType: "info",
    device: "SRV-WEB-01",
    issue: "Memory Usage",
    predicted_time: "Predicted: Sep 19, 2026 11:00 AM",
    confidence_score: 62,
    confidence_label: "62% Confidence",
    sparkline_color: "#8b5cf6",
  },
  {
    id: "pred-05",
    risk: "Optimization",
    riskType: "success",
    device: "Multiple Devices",
    issue: "Resource Optimization",
    predicted_time: "Available now",
    confidence_score: 95,
    confidence_label: "95% Potential Gain",
    sparkline_color: "#10b981",
  },
];

export const MOCK_AI_INSIGHTS: AIInsightItem[] = [
  {
    id: "ins-01",
    title: "High CPU usage predicted",
    description: "SRV-ACA-01 is predicted to exceed 90% CPU usage in the next 24 hours.",
    time_ago: "15 min ago",
    severity: "high",
  },
  {
    id: "ins-02",
    title: "Disk space running low",
    description: "LAB-DB-02 is predicted to have less than 10% disk space in 3 days.",
    time_ago: "45 min ago",
    severity: "medium",
  },
  {
    id: "ins-03",
    title: "Network latency increase",
    description: "Traffic congestion predicted on SW-CORE-01 in the next 6 hours.",
    time_ago: "1 hour ago",
    severity: "high",
  },
  {
    id: "ins-04",
    title: "System optimization available",
    description: "AI recommends optimizing memory allocation for 3 servers.",
    time_ago: "2 hours ago",
    severity: "success",
  },
];

export const MOCK_AI_MODEL_METADATA: AIModelMetadata = {
  model_name: "InfraPredict AI v2.4",
  model_type: "Deep Learning (LSTM)",
  last_trained: "Sep 10, 2026 02:30 AM",
  next_training: "Sep 17, 2026 02:30 AM",
  training_data: "2.4 TB",
  accuracy: "93.6%",
};

export const MOCK_RECENT_PREDICTIONS = [
  {
    id: "rec-01",
    title: "High CPU usage on SRV-ACA-01",
    risk: "High Risk",
    time_ago: "15 min ago",
    color: "rose",
  },
  {
    id: "rec-02",
    title: "Disk space full on LAB-DB-02",
    risk: "Medium Risk",
    time_ago: "45 min ago",
    color: "amber",
  },
  {
    id: "rec-03",
    title: "Network latency on SW-CORE-01",
    risk: "High Risk",
    time_ago: "1 hour ago",
    color: "rose",
  },
  {
    id: "rec-04",
    title: "Memory usage on SRV-WEB-01",
    risk: "Low Risk",
    time_ago: "2 hours ago",
    color: "blue",
  },
];

export const MOCK_MAINTENANCE_KPIS: MaintenanceOverviewKPIs = {
  total_scheduled: 24,
  total_scheduled_change: "↑ 4 from last month",
  completed: 15,
  completed_change: "↑ 3 from last month",
  in_progress: 3,
  in_progress_change: "— No change",
  upcoming: 6,
  upcoming_change: "↑ 2 from last month",
  overdue: 2,
  overdue_change: "↓ 1 from last month",
};

export const MOCK_UPCOMING_TASKS: ScheduledTaskItem[] = [
  {
    id: "up-01",
    task_name: "Database Optimization",
    category: "Database",
    target_system: "DB-Server-01",
    scheduled_date_time: "Sep 18, 2026 02:00 AM",
    duration: "2h",
    priority: "Medium",
    status: "Upcoming",
    created_by: "Admin",
    description: "Vacuum full and index defragmentation on university student records database.",
  },
  {
    id: "up-02",
    task_name: "Security Patch Update",
    category: "Security",
    target_system: "Web-Server-02",
    scheduled_date_time: "Sep 20, 2026 01:00 AM",
    duration: "1h 30m",
    priority: "High",
    status: "Upcoming",
    created_by: "Admin",
    description: "Apply OpenSSL CVE security patches and restart reverse-proxy service.",
  },
  {
    id: "up-03",
    task_name: "Network Firmware Upgrade",
    category: "Network",
    target_system: "Core-Switch-01",
    scheduled_date_time: "Sep 22, 2026 12:00 AM",
    duration: "1h",
    priority: "High",
    status: "Upcoming",
    created_by: "Security Team",
    description: "Install Cisco IOS-XE maintenance release with redundant route processor failover test.",
  },
  {
    id: "up-04",
    task_name: "Backup System Maintenance",
    category: "Backup",
    target_system: "Backup-Server-01",
    scheduled_date_time: "Sep 25, 2026 03:00 AM",
    duration: "2h",
    priority: "Medium",
    status: "Upcoming",
    created_by: "Backup Team",
    description: "Integrity validation of cold LTO tape archive and deduplication pool verification.",
  },
  {
    id: "up-05",
    task_name: "SSL Certificate Renewal",
    category: "Security",
    target_system: "Web-Server-02",
    scheduled_date_time: "Sep 28, 2026 11:00 PM",
    duration: "30m",
    priority: "Low",
    status: "Upcoming",
    created_by: "Admin",
    description: "Automated ACME Let's Encrypt wildcard renewal for university subdomains.",
  },
];

export const MOCK_ALL_MAINTENANCE_SCHEDULE: ScheduledTaskItem[] = [
  {
    id: "sch-01",
    task_name: "Operating System Update",
    category: "System",
    target_system: "App-Server-01",
    scheduled_date_time: "Sep 05, 2026 11:00 PM",
    duration: "1h",
    priority: "High",
    status: "Completed",
    created_by: "Admin",
  },
  {
    id: "sch-02",
    task_name: "Log Rotation & Cleanup",
    category: "System",
    target_system: "Log-Server-01",
    scheduled_date_time: "Sep 08, 2026 01:00 AM",
    duration: "45m",
    priority: "Low",
    status: "Completed",
    created_by: "Admin",
  },
  {
    id: "sch-03",
    task_name: "Disk Space Cleanup",
    category: "System",
    target_system: "File-Server-01",
    scheduled_date_time: "Sep 10, 2026 02:00 AM",
    duration: "1h",
    priority: "Low",
    status: "Completed",
    created_by: "System",
  },
  {
    id: "sch-04",
    task_name: "Application Patch Update",
    category: "Application",
    target_system: "App-Server-02",
    scheduled_date_time: "Sep 12, 2026 12:00 AM",
    duration: "2h",
    priority: "Medium",
    status: "Completed",
    created_by: "Admin",
  },
  {
    id: "sch-05",
    task_name: "Firewall Rule Review",
    category: "Security",
    target_system: "Firewall-01",
    scheduled_date_time: "Sep 15, 2026 10:00 PM",
    duration: "1h 30m",
    priority: "Medium",
    status: "In Progress",
    created_by: "Security Team",
  },
  {
    id: "sch-06",
    task_name: "VMware Tools Update",
    category: "Virtualization",
    target_system: "VM-Host-01",
    scheduled_date_time: "Sep 16, 2026 01:00 AM",
    duration: "1h",
    priority: "Low",
    status: "In Progress",
    created_by: "Admin",
  },
  {
    id: "sch-07",
    task_name: "Backup Verification",
    category: "Backup",
    target_system: "Backup-Server-01",
    scheduled_date_time: "Sep 16, 2026 09:00 AM",
    duration: "1h",
    priority: "Medium",
    status: "In Progress",
    created_by: "Backup Team",
  },
  {
    id: "sch-08",
    task_name: "Database Optimization",
    category: "Database",
    target_system: "DB-Server-01",
    scheduled_date_time: "Sep 18, 2026 02:00 AM",
    duration: "2h",
    priority: "Medium",
    status: "Upcoming",
    created_by: "Admin",
  },
  {
    id: "sch-09",
    task_name: "Security Patch Update",
    category: "Security",
    target_system: "Web-Server-02",
    scheduled_date_time: "Sep 20, 2026 01:00 AM",
    duration: "1h 30m",
    priority: "High",
    status: "Upcoming",
    created_by: "Admin",
  },
  {
    id: "sch-10",
    task_name: "Core Switch Config Audit",
    category: "Network",
    target_system: "Core-Switch-01",
    scheduled_date_time: "Sep 10, 2026 04:00 AM",
    duration: "45m",
    priority: "High",
    status: "Overdue",
    created_by: "Security Team",
  },
  {
    id: "sch-11",
    task_name: "Unscheduled Hardware Cleanout",
    category: "System",
    target_system: "LAB-PC-17",
    scheduled_date_time: "Sep 07, 2026 02:00 PM",
    duration: "1h",
    priority: "Medium",
    status: "Overdue",
    created_by: "System",
  },
];

export const MOCK_EXECUTIVE_REPORT_KPIS: ExecutiveReportKPIs = {
  total_devices: 128,
  total_devices_change: "↑ 12 from last week",
  system_uptime: 99.42,
  system_uptime_change: "↑ 1.02% from last week",
  critical_alerts: 12,
  critical_alerts_change: "↓ 3 from last week",
  security_score: 72,
  security_score_change: "↑ 8 points from last week",
};

export const MOCK_REPORT_HEALTH_OVERVIEW: ReportHealthOverview = {
  online_devices: 98,
  online_percentage: 76.6,
  offline_devices: 18,
  offline_percentage: 14.1,
  warning_devices: 12,
  warning_percentage: 9.3,
  new_devices: 7,
};

export const MOCK_REPORT_UPTIME_TREND = {
  days: ["Sep 10", "Sep 11", "Sep 12", "Sep 13", "Sep 14", "Sep 15", "Sep 16"],
  values: [99.2, 97.5, 98.8, 97.9, 99.6, 98.1, 99.42],
};

export const MOCK_REPORT_ALERTS_OVERVIEW = {
  total_alerts: 54,
  slices: [
    { label: "Critical", count: 12, percentage: 22.2, color: "#ef4444" },
    { label: "High", count: 18, percentage: 33.3, color: "#f97316" },
    { label: "Medium", count: 14, percentage: 25.9, color: "#eab308" },
    { label: "Low", count: 6, percentage: 11.1, color: "#3b82f6" },
    { label: "Info", count: 4, percentage: 7.4, color: "#a855f7" },
  ],
};

export const MOCK_REPORT_SECURITY_KPIS = {
  security_score: 72,
  security_score_change: "↑ 8 points from last week",
  security_score_sparkline: [62, 64, 65, 68, 67, 70, 72],
  threats_detected: 312,
  threats_detected_change: "↑ 28% from last week",
  threats_sparkline: [210, 230, 245, 280, 260, 295, 312],
  vulnerabilities: 23,
  vulnerabilities_change: "↓ 15% from last week",
  vulnerabilities_sparkline: [35, 32, 30, 28, 26, 25, 23],
};

export const MOCK_TOP_THREATS_WEEK: ReportWeeklyThreat[] = [
  {
    id: "th-01",
    threat_name: "Malware Campaign Detected",
    severity: "High",
    occurrences: 15,
    status: "Investigating",
    first_detected: "Sep 10, 2026 09:15 AM",
  },
  {
    id: "th-02",
    threat_name: "Brute Force Attempt",
    severity: "Medium",
    occurrences: 23,
    status: "Active",
    first_detected: "Sep 10, 2026 11:42 AM",
  },
  {
    id: "th-03",
    threat_name: "SQL Injection Attempt",
    severity: "Medium",
    occurrences: 8,
    status: "Blocked",
    first_detected: "Sep 11, 2026 02:31 PM",
  },
  {
    id: "th-04",
    threat_name: "DDoS Attack",
    severity: "High",
    occurrences: 5,
    status: "Mitigated",
    first_detected: "Sep 12, 2026 08:20 AM",
  },
];

export const MOCK_TOP_ALERT_CATEGORIES: TopAlertCategory[] = [
  { category: "High CPU Usage", count: 18, color: "#ef4444" },
  { category: "Multiple Failed Login Attempts", count: 11, color: "#f97316" },
  { category: "Memory Usage High", count: 9, color: "#3b82f6" },
  { category: "Disk Space Running Low", count: 8, color: "#06b6d4" },
  { category: "Network Latency", count: 4, color: "#a855f7" },
];

export const MOCK_RESOURCE_UTILIZATION: ResourceUtilizationMetric[] = [
  {
    name: "CPU Usage",
    average: 34,
    sparkline: [28, 35, 30, 42, 36, 31, 34],
    color: "#3b82f6",
  },
  {
    name: "Memory Usage",
    average: 52,
    sparkline: [48, 50, 55, 51, 54, 50, 52],
    color: "#8b5cf6",
  },
  {
    name: "Disk Usage",
    average: 68,
    sparkline: [65, 66, 66, 67, 67, 68, 68],
    color: "#f59e0b",
  },
  {
    name: "Network I/O",
    average: 28,
    sparkline: [20, 25, 35, 22, 30, 24, 28],
    color: "#10b981",
  },
];

export const MOCK_REPORT_RECOMMENDATIONS = [
  "Optimize processes causing high CPU usage",
  "Implement stricter access control policies",
  "Increase disk space on 3 servers",
  "Review security alerts marked as high risk",
];

// -------------------------------------------------------------
// Live API Methods (Dashboard, Telemetry, Demo, Validation)
// -------------------------------------------------------------

export async function getDashboardKpis(): Promise<DashboardKpis> {
  return apiFetch<DashboardKpis>("/dashboard/kpis");
}

export async function getValidationMetrics(): Promise<ValidationMetricsResponse> {
  return apiFetch<ValidationMetricsResponse>("/dashboard/validation-metrics");
}

export async function getRecentAnomalies(limit: number = 50): Promise<any[]> {
  return apiFetch<any[]>(`/telemetry/anomalies?limit=${limit}`);
}

export async function getWorkstationTelemetry(
  workstationId: string,
  limit: number = 30
): Promise<TelemetryMetric[]> {
  return apiFetch<TelemetryMetric[]>(`/telemetry/workstation/${workstationId}?limit=${limit}`);
}

export async function triggerDemoScenario(
  scenarioType: DemoScenarioType,
  workstationId?: string
): Promise<DemoExecutionReceipt> {
  return apiFetch<DemoExecutionReceipt>("/demo/trigger-scenario", {
    method: "POST",
    body: JSON.stringify({ scenario_type: scenarioType, workstation_id: workstationId }),
  });
}

export async function getWorkstations(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  department?: string;
  lab?: string;
  status?: string;
}): Promise<WorkstationPaginatedResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", params.page.toString());
  if (params?.pageSize) query.set("page_size", params.pageSize.toString());
  if (params?.search) query.set("search", params.search);
  if (params?.department) query.set("department", params.department);
  if (params?.lab) query.set("lab", params.lab);
  if (params?.status) query.set("status", params.status);

  const qs = query.toString();
  return apiFetch<WorkstationPaginatedResponse>(`/workstations${qs ? `?${qs}` : ""}`);
}

export async function getWorkstation(workstationId: string): Promise<Workstation> {
  return apiFetch<Workstation>(`/workstations/${workstationId}`);
}

export async function isolateWorkstation(
  workstationId: string
): Promise<{ status: string; message: string }> {
  return apiFetch<{ status: string; message: string }>(
    `/policy/evaluate/${workstationId}?auto_execute=true`,
    {
      method: "POST",
    }
  );
}

export async function rollbackWorkstationIsolation(
  workstationId: string
): Promise<{ status: string; message: string }> {
  return apiFetch<{ status: string; message: string }>(
    `/policy/rollback-isolation/${workstationId}`,
    {
      method: "POST",
    }
  );
}

// -------------------------------------------------------------
// Live Alerts API
// -------------------------------------------------------------

export async function getAlerts(params?: {
  status?: string;
  severity?: string;
  sourceType?: string;
  limit?: number;
}): Promise<any[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.severity) query.set("severity", params.severity);
  if (params?.sourceType) query.set("source_type", params.sourceType);
  if (params?.limit) query.set("limit", params.limit.toString());

  const qs = query.toString();
  return apiFetch<any[]>(`/alerts${qs ? `?${qs}` : ""}`);
}

export async function acknowledgeAlert(alertId: string): Promise<any> {
  return apiFetch<any>(`/alerts/${alertId}/acknowledge`, {
    method: "POST",
  });
}

export async function resolveAlert(alertId: string, notes?: string): Promise<any> {
  return apiFetch<any>(`/alerts/${alertId}/resolve`, {
    method: "POST",
    body: JSON.stringify({ notes: notes || "Resolved by operator" }),
  });
}

// -------------------------------------------------------------
// Live Cybersecurity & Incidents API
// -------------------------------------------------------------

export async function getIncidents(params?: {
  status?: string;
  severity?: string;
  category?: string;
  workstationId?: string;
  limit?: number;
}): Promise<any[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.severity) query.set("severity", params.severity);
  if (params?.category) query.set("category", params.category);
  if (params?.workstationId) query.set("workstation_id", params.workstationId);
  if (params?.limit) query.set("limit", params.limit.toString());

  const qs = query.toString();
  return apiFetch<any[]>(`/incidents${qs ? `?${qs}` : ""}`);
}

export async function getSecurityEvents(params?: {
  severity?: string;
  eventType?: string;
  source?: string;
  workstationId?: string;
  limit?: number;
}): Promise<any[]> {
  const query = new URLSearchParams();
  if (params?.severity) query.set("severity", params.severity);
  if (params?.eventType) query.set("event_type", params.eventType);
  if (params?.source) query.set("source", params.source);
  if (params?.workstationId) query.set("workstation_id", params.workstationId);
  if (params?.limit) query.set("limit", params.limit.toString());

  const qs = query.toString();
  return apiFetch<any[]>(`/security/events${qs ? `?${qs}` : ""}`);
}

// -------------------------------------------------------------
// Live Users Management API
// -------------------------------------------------------------

export interface UsersPaginatedResponse {
  items: Array<{
    id: string;
    username: string;
    email: string;
    role: string;
    status: string;
    last_login_at?: string;
    created_at: string;
  }>;
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export async function getUsers(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: string;
}): Promise<UsersPaginatedResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", params.page.toString());
  if (params?.pageSize) query.set("page_size", params.pageSize.toString());
  if (params?.search) query.set("search", params.search);
  if (params?.role) query.set("role", params.role);

  const qs = query.toString();
  return apiFetch<UsersPaginatedResponse>(`/users${qs ? `?${qs}` : ""}`);
}

export async function createUser(payload: {
  username: string;
  email: string;
  password?: string;
  role: string;
}): Promise<any> {
  return apiFetch<any>("/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateUser(
  userId: string,
  payload: { status?: string; role_id?: string }
): Promise<any> {
  return apiFetch<any>(`/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteUser(userId: string): Promise<any> {
  return apiFetch<any>(`/users/${userId}`, {
    method: "DELETE",
  });
}

// -------------------------------------------------------------
// Live Audit Log API
// -------------------------------------------------------------

export interface AuditLogPaginatedResponse {
  items: Array<{
    id: string;
    actor: string;
    action: string;
    resource: string;
    timestamp: string;
    source_ip?: string;
    result: string;
    correlation_id?: string;
    metadata?: Record<string, any>;
  }>;
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export async function getAuditLogs(params?: {
  page?: number;
  pageSize?: number;
  action?: string;
  actor?: string;
  result?: string;
  search?: string;
}): Promise<AuditLogPaginatedResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", params.page.toString());
  if (params?.pageSize) query.set("page_size", params.pageSize.toString());
  if (params?.action) query.set("action", params.action);
  if (params?.actor) query.set("actor", params.actor);
  if (params?.result) query.set("result", params.result);
  if (params?.search) query.set("search", params.search);

  const qs = query.toString();
  return apiFetch<AuditLogPaginatedResponse>(`/audit/logs${qs ? `?${qs}` : ""}`);
}

// -------------------------------------------------------------
// Live Predictive Maintenance API
// -------------------------------------------------------------

export interface MaintenanceTaskItem {
  id: string;
  title: string;
  workstation_id?: string;
  workstation_hostname: string;
  department: string;
  status: "Scheduled" | "In Progress" | "Completed" | "Overdue";
  scheduled_time: string;
  duration: string;
  duration_minutes: number;
  assigned_to: string;
  priority: "Low" | "Medium" | "High";
  category: "System" | "Database" | "Network" | "Backup" | "Security" | "Application" | "Virtualization";
  description: string;
  affected_systems: string[];
  incident_number?: string;
}

export interface MaintenanceKPIs {
  scheduled_today: number;
  in_progress: number;
  completed_this_week: number;
  overdue: number;
  system_health_score: number;
}

export async function getMaintenanceTasks(params?: {
  status?: string;
  limit?: number;
}): Promise<MaintenanceTaskItem[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.limit) query.set("limit", params.limit.toString());
  const qs = query.toString();
  return apiFetch<MaintenanceTaskItem[]>(`/maintenance/tasks${qs ? `?${qs}` : ""}`);
}

export async function getMaintenanceKPIs(): Promise<MaintenanceKPIs> {
  return apiFetch<MaintenanceKPIs>("/maintenance/kpis");
}

export async function createMaintenanceTask(payload: {
  title: string;
  workstation_id?: string;
  category?: string;
  priority?: string;
  scheduled_time?: string;
  duration_minutes?: number;
  description?: string;
  assigned_to?: string;
}): Promise<MaintenanceTaskItem> {
  return apiFetch<MaintenanceTaskItem>("/maintenance/tasks", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateMaintenanceTaskStatus(
  taskId: string,
  status: string,
  notes?: string
): Promise<MaintenanceTaskItem> {
  return apiFetch<MaintenanceTaskItem>(`/maintenance/tasks/${taskId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, notes }),
  });
}

// -------------------------------------------------------------
// Live Executive Reports API
// -------------------------------------------------------------

export interface ExecutiveReportSummary {
  generated_at: string;
  fleet_total_workstations: number;
  fleet_online_workstations: number;
  fleet_uptime_percentage: number;
  total_incidents: number;
  active_security_threats: number;
  resolved_incidents: number;
  maintenance_advisories: number;
  total_alerts: number;
  critical_alerts: number;
  mean_time_to_resolution_minutes: number;
  threat_distribution: Record<string, number>;
  system_health_rating: string;
}

export async function getReportSummary(): Promise<ExecutiveReportSummary> {
  return apiFetch<ExecutiveReportSummary>("/reports/summary");
}

// -------------------------------------------------------------
// Live System Settings & Platform Diagnostics API
// -------------------------------------------------------------

export interface SystemSettingsData {
  app_name: string;
  app_env: string;
  kill_switch_active: boolean;
  smd_threshold: number;
  sysmon_confidence: number;
  auto_surgical_isolation: boolean;
  notify_critical: boolean;
  notify_daily_report: boolean;
  idp_mode: string;
  idp_status: string;
}

export interface IdPHealthCheck {
  status: "healthy" | "degraded" | "outage";
  latency_ms: number;
  protocol: string;
  mock_users_registered: number;
  active_workloads_registered: number;
  outage_mode_active: boolean;
}

export async function getSystemSettings(): Promise<SystemSettingsData> {
  return apiFetch<SystemSettingsData>("/system/settings");
}

export async function updateSystemSettings(payload: Partial<SystemSettingsData>): Promise<SystemSettingsData> {
  return apiFetch<SystemSettingsData>("/system/settings", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function checkIdPHealth(): Promise<IdPHealthCheck> {
  return apiFetch<IdPHealthCheck>("/system/health/idp");
}

