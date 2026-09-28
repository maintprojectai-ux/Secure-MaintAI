export type UserRole = "ADMIN" | "IT_OPERATOR" | "RESEARCHER" | "STUDENT";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  department?: string;
  is_active: boolean;
  created_at: string;
  last_login?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export type WorkstationStatus =
  | "ONLINE"
  | "WARNING"
  | "CRITICAL"
  | "OFFLINE"
  | "ISOLATED"
  | "MAINTENANCE"
  | "COMPROMISED"
  | "DECOMMISSIONED";

export interface HardwareSpecs {
  processor?: string;
  cores?: number;
  logical_cpus?: number;
  ram_gb?: number;
  architecture?: string;
  gpu?: string;
  platform?: string;
  [key: string]: unknown;
}

export interface Workstation {
  id: string;
  hostname: string;
  asset_tag?: string | null;
  agent_id?: string | null;
  ip_address: string;
  mac_address?: string | null;
  operating_system?: string;
  os_type?: string;
  os_version?: string;
  department?: string | null;
  lab?: string | null;
  status: WorkstationStatus;
  agent_version?: string | null;
  hardware_specs?: HardwareSpecs | null;
  last_seen_at?: string | null;
  assigned_user?: User;
  assigned_user_id?: string;
  created_at: string;
  updated_at?: string;
  // Live metric aggregates for cards/tables
  cpu_usage?: number;
  memory_usage?: number;
  disk_usage?: number;
  network_throughput?: number;
  process_count?: number;
  is_isolated?: boolean;
}

export interface WorkstationPaginatedResponse {
  items: Workstation[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface TelemetryMetric {
  id: string;
  workstation_id: string;
  timestamp: string;
  cpu_usage: number;
  memory_usage: number;
  disk_read: number;
  disk_write: number;
  network_in: number;
  network_out: number;
  process_count: number;
}

export interface ProcessItem {
  pid: number;
  name: string;
  cpu_percent: number;
  memory_percent: number;
  user: string;
  status: "running" | "sleeping" | "suspended" | "terminated";
  command?: string;
}

export type AlertSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type AlertStatus = "NEW" | "ACKNOWLEDGED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

export interface Alert {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  status: AlertStatus;
  source: string;
  workstation_id: string;
  workstation_hostname?: string;
  assigned_to?: string;
  evidence?: Record<string, unknown>;
  anomaly_score?: number;
  created_at: string;
  updated_at?: string;
  resolved_at?: string;
}

export interface Incident {
  id: string;
  title: string;
  severity: AlertSeverity;
  status: "OPEN" | "CONTAINED" | "RESOLVED";
  workstation_id: string;
  workstation_hostname: string;
  threat_type: string;
  playbook_executed?: string;
  containment_status?: string;
  created_at: string;
  timeline: {
    time: string;
    action: string;
    actor: string;
    details?: string;
  }[];
}

export interface SecurityEvent {
  id: string;
  event_id: string;
  timestamp: string;
  source: "WAZUH" | "SYSMON" | "NETWORK_SOCKET" | "INTERNAL";
  workstation_id: string;
  workstation_hostname: string;
  user?: string;
  event_type: string;
  severity: AlertSeverity;
  confidence: number;
  evidence: Record<string, unknown>;
}

export interface ThreatOrigin {
  country: string;
  code: string;
  count: number;
  percentage: number;
  color: string;
}

export interface AttackMatrixCell {
  hour: number;
  day: string;
  attacks: number;
  severity: "none" | "low" | "medium" | "high" | "critical";
}

export interface ModelMetrics {
  name: string;
  version: string;
  f1_score: number;
  precision: number;
  recall: number;
  false_positive_rate: number;
  latency_ms: number;
  status: "OPERATIONAL" | "OPTIMAL" | "RETRAINING";
}

export interface MaintenanceTask {
  id: string;
  title: string;
  workstation_id: string;
  workstation_hostname: string;
  department: string;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "OVERDUE";
  scheduled_date: string;
  duration_minutes: number;
  technician: string;
  type: "PATCH" | "SECURITY_SCAN" | "HARDWARE_CHECK" | "OPTIMIZATION";
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user_email: string;
  action: string;
  category: "USER" | "SYSTEM" | "SECURITY" | "API";
  target: string;
  status: "SUCCESS" | "WARNING" | "FAILURE";
  ip_address: string;
}

export interface DashboardOverviewKPI {
  total_workstations: number;
  online_workstations: number;
  warning_workstations: number;
  critical_workstations: number;
  offline_workstations: number;
  active_threats: number;
  system_resilience_score: number;
  average_cpu: number;
  average_ram: number;
  average_disk: number;
}

export interface SupportTicket {
  id: string;
  ticket_number: string;
  title: string;
  description?: string;
  category: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  created_at: string;
  author: string;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export interface UserManagementItem {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  department: string;
  status: "ACTIVE" | "PENDING" | "SUSPENDED";
  last_login: string;
  two_factor_enabled: boolean;
  avatar?: string;
}

export interface CyberKPIs {
  threats_detected: number;
  threats_detected_change: string;
  high_risk_events: number;
  high_risk_change: string;
  blocked_attacks: string;
  blocked_attacks_change: string;
  affected_devices: number;
  affected_devices_change: string;
  security_score: number;
  security_score_change: string;
}

export interface ActiveThreatItem {
  id: string;
  title: string;
  category: "MALWARE" | "DDOS" | "BRUTE_FORCE" | "SQLI" | "SUSPICIOUS";
  risk: "Critical" | "High Risk" | "Medium" | "Low";
  target_description: string;
  target_ip: string;
  time_ago: string;
  status: "Investigating" | "Active" | "Blocked" | "Monitoring";
  statusColor: "amber" | "rose" | "emerald" | "blue";
}

export interface VulnerabilityItem {
  cve: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  affected_assets: number;
  cvss_score: number;
}

export interface SecurityEventItem {
  id: string;
  time: string;
  event: string;
  source: string;
  destination: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  status: "Investigating" | "Blocked" | "Active" | "Monitoring";
  statusColor: "amber" | "emerald" | "rose" | "blue";
}

export interface SecurityPostureDimension {
  name: string;
  score: number;
  max: number;
  colorHex: string;
}

export interface ThreatIntelItem {
  id: string;
  title: string;
  description: string;
  time_ago: string;
  type: "malware" | "phishing" | "cve";
}

export interface PredictionOverviewKPIs {
  predicted_issues: number;
  predicted_issues_change: string;
  high_risk_predictions: number;
  high_risk_change: string;
  prevented_issues: number;
  prevented_issues_change: string;
  prediction_accuracy: number;
  accuracy_change: string;
}

export interface TopPredictionItem {
  id: string;
  risk: "High Risk" | "Medium Risk" | "Low Risk" | "Optimization";
  riskType: "danger" | "warning" | "info" | "success";
  device: string;
  issue: string;
  predicted_time: string;
  confidence_score: number;
  confidence_label: string;
  sparkline_color: string;
}

export interface AIInsightItem {
  id: string;
  title: string;
  description: string;
  time_ago: string;
  severity: "high" | "medium" | "info" | "success";
}

export interface AIModelMetadata {
  model_name: string;
  model_type: string;
  last_trained: string;
  next_training: string;
  training_data: string;
  accuracy: string;
}

export interface MaintenanceOverviewKPIs {
  total_scheduled: number;
  total_scheduled_change: string;
  completed: number;
  completed_change: string;
  in_progress: number;
  in_progress_change: string;
  upcoming: number;
  upcoming_change: string;
  overdue: number;
  overdue_change: string;
}

export type MaintenanceCategory =
  | "Database"
  | "Security"
  | "Network"
  | "Backup"
  | "System"
  | "Application"
  | "Virtualization";

export type MaintenancePriority = "High" | "Medium" | "Low";

export type MaintenanceStatus = "Upcoming" | "In Progress" | "Completed" | "Overdue";

export interface ScheduledTaskItem {
  id: string;
  task_name: string;
  category: MaintenanceCategory;
  target_system: string;
  scheduled_date_time: string;
  duration: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  created_by?: string;
  description?: string;
}

export interface ExecutiveReportKPIs {
  total_devices: number;
  total_devices_change: string;
  system_uptime: number;
  system_uptime_change: string;
  critical_alerts: number;
  critical_alerts_change: string;
  security_score: number;
  security_score_change: string;
}

export interface ReportHealthOverview {
  online_devices: number;
  online_percentage: number;
  offline_devices: number;
  offline_percentage: number;
  warning_devices: number;
  warning_percentage: number;
  new_devices: number;
}

export interface ReportWeeklyThreat {
  id: string;
  threat_name: string;
  severity: "High" | "Medium" | "Low" | "Critical";
  occurrences: number;
  status: "Investigating" | "Active" | "Blocked" | "Mitigated";
  first_detected: string;
}

export interface ResourceUtilizationMetric {
  name: "CPU Usage" | "Memory Usage" | "Disk Usage" | "Network I/O";
  average: number;
  sparkline: number[];
  color: string;
}

export interface TopAlertCategory {
  category: string;
  count: number;
  color: string;
}

// -------------------------------------------------------------
// Live Demonstration & Validation Metrics Types (Guide Section 6)
// -------------------------------------------------------------

export interface DashboardKpis {
  total_workstations: number;
  online_workstations: number;
  warning_workstations: number;
  critical_workstations: number;
  isolated_workstations: number;
  offline_workstations: number;
  active_threats: number;
  active_alerts: number;
  security_posture: number;
}

export interface Model01Metrics {
  model_name: string;
  dataset: string;
  machines_evaluated: number;
  event_recall: number;
  false_positive_rate: number;
  balanced_accuracy: number;
  roc_auc: number;
  average_precision: number;
  detector_config: Record<string, unknown>;
}

export interface Model02Metrics {
  model_name: string;
  dataset: string;
  models: Array<{
    model: string;
    accuracy: number;
    balanced_accuracy: number;
    precision_macro?: number;
    recall_macro?: number;
    f1_macro?: number;
    precision?: number;
    recall?: number;
    f1?: number;
    roc_auc?: number;
    average_precision?: number;
  }>;
  confusion_matrix?: number[][];
  labels?: string[];
}

export interface ValidationMetricsResponse {
  model_01_screening: Model01Metrics;
  model_02a_technical: Model02Metrics;
  model_02b_cyber: Model02Metrics;
  acceptance_thresholds: {
    agent_max_rss: string;
    agent_max_cpu: string;
    screening_latency: string;
    soar_mttr: string;
  };
}

export type DemoScenarioType =
  | "STUDENT_CYBER_THREAT"
  | "TECHNICAL_DEGRADATION"
  | "RESEARCHER_HPC_WORKLOAD"
  | "PRIVILEGE_ESCALATION"
  | "IDP_OUTAGE_FALLBACK"
  | "NORMAL_BASELINE";

export interface DataProvenanceInfo {
  tier: string;
  dataset_name: string;
  reference_citation: string;
  generation_method: string;
}

export interface ScenarioProcessSnapshot {
  pid: number;
  name: string;
  command: string;
  cpu_percent: number;
  memory_mb: number;
  user: string;
  status: string;
}

export interface ScenarioSocketSnapshot {
  protocol: string;
  local_address: string;
  remote_address: string;
  state: string;
  pid: number;
  threat_note?: string | null;
}

export interface ScenarioTrajectoryPoint {
  phase: string;
  offset_seconds: number;
  cpu_percent: number;
  memory_percent: number;
  disk_read_mb_s: number;
  disk_write_mb_s: number;
  network_out_mb_s: number;
  process_count: number;
  anomaly_score: number;
}

export interface DemoExecutionReceipt {
  scenario_type: DemoScenarioType;
  scenario_title: string;
  data_provenance?: DataProvenanceInfo;
  step_1_kpis: {
    total_workstations: number;
    online: number;
    isolated: number;
  };
  step_2_workstation: {
    id: string;
    hostname: string;
    ip_address: string;
    department: string;
    lab: string;
    status: string;
    processes?: ScenarioProcessSnapshot[];
  };
  step_3_telemetry: {
    cpu_percent: number;
    memory_percent: number;
    disk_read_mb_s: number;
    network_out_mb_s: number;
    process_count: number;
    trajectory?: ScenarioTrajectoryPoint[];
    sockets?: ScenarioSocketSnapshot[];
  };
  step_4_scenario: {
    name: string;
    type: string;
    triggered_at: string;
  };
  step_5_ml_result: {
    is_anomaly: boolean;
    anomaly_type: string;
    score: number;
    confidence: number;
    model_name: string;
    model_version: string;
    evidence: string[];
    predicted_fault?: string | null;
  };
  step_6_idp_context: {
    user_id: string;
    username: string;
    role: string;
    department: string;
    lab?: string | null;
    active_workloads: string[];
    is_fallback: boolean;
  };
  step_7_policy_decision: {
    decision: string;
    playbook_to_execute: string;
    reason: string;
    rules_triggered: string[];
    requires_human_approval: boolean;
  };
  step_8_soar_execution: {
    status: string;
    action_taken: string;
    workstation_final_status: string;
    can_rollback: boolean;
  };
  step_9_incident_audit: {
    incident_id?: string | null;
    alert_id?: string | null;
    audit_id?: string | null;
    status: string;
  };
  step_10_validation_summary: {
    instruction: string;
    acceptance_thresholds: Record<string, string>;
  };
}



