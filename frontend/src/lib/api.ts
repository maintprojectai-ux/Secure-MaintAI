import {
  User,
  Workstation,
  WorkstationPaginatedResponse,
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

const inFlightRequests = new Map<string, Promise<unknown>>();

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const isGet = method === "GET";

  if (isGet && inFlightRequests.has(endpoint)) {
    return inFlightRequests.get(endpoint) as Promise<T>;
  }

  const requestPromise = (async () => {
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
    } finally {
      if (isGet) {
        inFlightRequests.delete(endpoint);
      }
    }
  })();

  if (isGet) {
    inFlightRequests.set(endpoint, requestPromise);
  }

  return requestPromise;
}

// -------------------------------------------------------------
// Live API Methods (Dashboard, Telemetry, Demo, Validation)
// -------------------------------------------------------------

export async function getDashboardKpis(): Promise<DashboardKpis> {
  return apiFetch<DashboardKpis>("/dashboard/kpis");
}

export async function getValidationMetrics(): Promise<ValidationMetricsResponse> {
  return apiFetch<ValidationMetricsResponse>("/dashboard/validation-metrics");
}

export async function getRecentAnomalies(
  limit: number = 50,
  workstationId?: string
): Promise<any[]> {
  const query = new URLSearchParams({ limit: limit.toString() });
  if (workstationId) query.set("workstation_id", workstationId);
  return apiFetch<any[]>(`/telemetry/anomalies?${query.toString()}`);
}

export async function getWorkstationTelemetry(
  workstationId: string,
  limit: number = 30
): Promise<TelemetryMetric[]> {
  return apiFetch<TelemetryMetric[]>(`/telemetry/workstation/${workstationId}?limit=${limit}`);
}

export async function triggerDemoScenario(
  scenarioType: DemoScenarioType,
  workstationId?: string,
  userRole?: string
): Promise<DemoExecutionReceipt> {
  return apiFetch<DemoExecutionReceipt>("/demo/trigger-scenario", {
    method: "POST",
    body: JSON.stringify({
      scenario_type: scenarioType,
      workstation_id: workstationId,
      user_role: userRole,
    }),
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

export interface UpdateWorkstationPayload {
  department?: string | null;
  lab?: string | null;
  asset_tag?: string | null;
  status?: string | null;
}

export async function updateWorkstation(
  workstationId: string,
  data: UpdateWorkstationPayload
): Promise<Workstation> {
  return apiFetch<Workstation>(`/workstations/${workstationId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
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
  workstationId?: string;
  requiresHumanIntervention?: boolean;
  limit?: number;
}): Promise<any[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.severity) query.set("severity", params.severity);
  if (params?.sourceType) query.set("source_type", params.sourceType);
  if (params?.workstationId) query.set("workstation_id", params.workstationId);
  if (params?.requiresHumanIntervention !== undefined) {
    query.set("requires_human_intervention", String(params.requiresHumanIntervention));
  }
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

export async function approveAlert(alertId: string, notes?: string): Promise<any> {
  return apiFetch<any>(`/alerts/${alertId}/approve`, {
    method: "POST",
    body: JSON.stringify({ notes: notes || "Authorized by SOC operator" }),
  });
}

export interface CreateAlertInput {
  title: string;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  source_type?:
    | "TECHNICAL_ANOMALY"
    | "CYBERSECURITY_THREAT"
    | "PREDICTIVE_MAINTENANCE"
    | "HUMAN_INTERVENTION_REQUIRED";
  workstation_id?: string;
  requires_human_intervention?: boolean;
  recommendation?: string;
}

export async function createAlert(input: CreateAlertInput): Promise<any> {
  return apiFetch<any>("/alerts", {
    method: "POST",
    body: JSON.stringify({
      title: input.title,
      description: input.description,
      severity: input.severity,
      source_type: input.source_type || "TECHNICAL_ANOMALY",
      workstation_id: input.workstation_id || null,
      requires_human_intervention: input.requires_human_intervention || false,
      recommendation: input.recommendation || null,
    }),
  });
}

// -------------------------------------------------------------
// Live Security Events & Incidents API
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

export async function updateUser(
  userId: string,
  payload: { status?: string; role?: string; email?: string }
): Promise<any> {
  return apiFetch<any>(`/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
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

export interface ReportThreatRow {
  id: string;
  threat_name: string;
  severity: string;
  occurrences: number;
  status: string;
  first_detected: string;
}

export interface ReportUptimeTrendPoint {
  date: string;
  label: string;
  value: number;
}

export interface ExecutiveReportSummary {
  generated_at: string;
  fleet_total_workstations: number;
  fleet_online_workstations: number;
  fleet_offline_workstations: number;
  fleet_warning_workstations: number;
  fleet_new_workstations_7d: number;
  fleet_uptime_percentage: number;
  uptime_trend: ReportUptimeTrendPoint[];
  total_incidents: number;
  active_security_threats: number;
  resolved_incidents: number;
  maintenance_advisories: number;
  total_alerts: number;
  critical_alerts: number;
  high_alerts: number;
  medium_alerts: number;
  low_alerts: number;
  alert_categories: Record<string, number>;
  top_threats: ReportThreatRow[];
  avg_cpu_usage: number;
  avg_memory_usage: number;
  avg_disk_activity: number;
  avg_network_activity: number;
  mean_time_to_resolution_minutes: number;
  threat_distribution: Record<string, number>;
  system_health_rating: string;
}

export async function getReportSummary(): Promise<ExecutiveReportSummary> {
  return apiFetch<ExecutiveReportSummary>("/reports/summary");
}

export async function downloadReportExport(format: "csv" | "json" = "csv"): Promise<Blob> {
  const token = getToken();
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}/reports/export?format=${format}`, {
    method: "GET",
    headers,
  });
  if (!res.ok) {
    throw new ApiError(res.status, `Export download failed with status ${res.status}`);
  }
  return res.blob();
}
