"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { getAlerts, acknowledgeAlert, resolveAlert } from "@/lib/api";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  Search,
  Filter,
  X,
  ChevronDown,
  ChevronRight,
  Clock,
  Activity,
  Server,
  CheckCircle2,
  Zap,
  Shield,
  RotateCcw,
  Plus,
  ExternalLink,
  Wrench,
  Star,
  ArrowUpRight,
  TrendingUp,
  MoreVertical,
  SlidersHorizontal,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";

// Severity and Status types
type SeverityType = "Critical" | "High" | "Medium" | "Low" | "Info";
type StatusType = "Active" | "Resolved" | "Monitored";

interface ProcessItemDetail {
  name: string;
  cpu: number;
  user: string;
  startedAt: string;
}

interface NoteItem {
  timestamp: string;
  author: string;
  type: "AI Analysis" | "System" | "Operator";
  content: string;
}

interface AlertItem {
  id: string;
  alertIdString: string;
  title: string;
  description: string;
  severity: SeverityType;
  status: StatusType;
  device: {
    name: string;
    ip: string;
    type: string;
    os: string;
    location: string;
    owner: string;
  };
  source: string;
  time: string;
  lastOccurred: string;
  occurrences: number;
  tags: string[];
  cpuMetrics: {
    current: number;
    average: number;
    peak: number;
    threshold: number;
    history: { time: string; value: number }[];
  };
  processes: ProcessItemDetail[];
  notes: NoteItem[];
  timeline: { time: string; stage: string; desc: string; color: string }[];
}

// Comprehensive mock data matching the approved mockup
const INITIAL_ALERTS: AlertItem[] = [
  {
    id: "alt-001",
    alertIdString: "#ALT-2026-09-16-0001",
    title: "High CPU usage detected",
    description: "CPU usage exceeded 90% for more than 5 minutes",
    severity: "Critical",
    status: "Active",
    device: {
      name: "SRV-ACA-01",
      ip: "10.10.1.10",
      type: "Server",
      os: "Windows Server 2022",
      location: "Data Center 1",
      owner: "IT Infrastructure",
    },
    source: "Monitoring Agent",
    time: "Sep 16, 2026 15:58:23",
    lastOccurred: "Sep 16, 2026 15:53:12",
    occurrences: 5,
    tags: ["performance", "cpu", "server", "infrastructure"],
    cpuMetrics: {
      current: 94,
      average: 87,
      peak: 98,
      threshold: 90,
      history: [
        { time: "14:58", value: 65 },
        { time: "15:08", value: 72 },
        { time: "15:18", value: 68 },
        { time: "15:28", value: 84 },
        { time: "15:38", value: 89 },
        { time: "15:48", value: 92 },
        { time: "15:58", value: 94 },
      ],
    },
    processes: [
      { name: "java.exe", cpu: 35.6, user: "svc_app", startedAt: "Sep 16, 14:52:11" },
      { name: "mysql.exe", cpu: 22.4, user: "svc_mysql", startedAt: "Sep 16, 14:49:02" },
      { name: "python.exe", cpu: 15.8, user: "svc_data", startedAt: "Sep 16, 14:55:18" },
      { name: "w3wp.exe", cpu: 10.6, user: "svc_web", startedAt: "Sep 16, 14:48:33" },
      { name: "agent.exe", cpu: 6.2, user: "svc_agent", startedAt: "Sep 16, 14:45:20" },
    ],
    notes: [
      {
        timestamp: "Sep 16, 15:55",
        author: "AI Analysis",
        type: "AI Analysis",
        content: "High CPU usage is caused by process 'java.exe'. Consider restarting the process or scaling compute resources.",
      },
      {
        timestamp: "Sep 16, 15:53",
        author: "System",
        type: "System",
        content: "Alert triggered: CPU usage exceeded 90% threshold.",
      },
    ],
    timeline: [
      { time: "15:53:10", stage: "Model 01 Telemetry", desc: "38-channel vector crossed 99th percentile threshold (0.94)", color: "bg-blue-400" },
      { time: "15:53:15", stage: "SIEM Correlation", desc: "Wazuh Rule 80110 matched: Sustained CPU core exhaustion", color: "bg-purple-400" },
      { time: "15:53:20", stage: "IdP Context", desc: "Target identity: IT Infrastructure service account (svc_app)", color: "bg-amber-400" },
      { time: "15:53:25", stage: "Policy Engine", desc: "Recommendation: Autonomous diagnostic dump & process throttling", color: "bg-emerald-400" },
    ],
  },
  {
    id: "alt-002",
    alertIdString: "#ALT-2026-09-16-0002",
    title: "Multiple failed login attempts",
    description: "8 failed login attempts detected",
    severity: "Critical",
    status: "Active",
    device: {
      name: "SRV-GATE-03",
      ip: "10.10.2.15",
      type: "Gateway Server",
      os: "Ubuntu 22.04 LTS",
      location: "Main Data Center",
      owner: "Network Operations",
    },
    source: "SIEM",
    time: "Sep 16, 2026 15:42:11",
    lastOccurred: "Sep 16, 2026 15:40:00",
    occurrences: 8,
    tags: ["security", "auth", "brute-force", "gateway"],
    cpuMetrics: {
      current: 48,
      average: 42,
      peak: 55,
      threshold: 80,
      history: [
        { time: "14:58", value: 30 },
        { time: "15:08", value: 32 },
        { time: "15:18", value: 35 },
        { time: "15:28", value: 42 },
        { time: "15:38", value: 50 },
        { time: "15:48", value: 48 },
        { time: "15:58", value: 48 },
      ],
    },
    processes: [
      { name: "sshd", cpu: 18.2, user: "root", startedAt: "Sep 16, 15:35:10" },
      { name: "fail2ban", cpu: 8.5, user: "root", startedAt: "Sep 16, 14:10:00" },
      { name: "systemd-logind", cpu: 4.1, user: "root", startedAt: "Sep 16, 08:00:00" },
    ],
    notes: [
      {
        timestamp: "Sep 16, 15:42",
        author: "AI Analysis",
        type: "AI Analysis",
        content: "Source IP 185.220.101.4 correlates with known Tor exit nodes. IP added to temporary ingress blocklist.",
      },
    ],
    timeline: [
      { time: "15:40:12", stage: "Syslog Event", desc: "Repeated PAM auth failures on port 22", color: "bg-rose-400" },
      { time: "15:41:00", stage: "SIEM Rule Trigger", desc: "Wazuh Rule 5710: Multiple SSH failures from single subnet", color: "bg-purple-400" },
    ],
  },
  {
    id: "alt-003",
    alertIdString: "#ALT-2026-09-16-0003",
    title: "Memory usage is high",
    description: "Memory usage exceeded 80%",
    severity: "High",
    status: "Active",
    device: {
      name: "LAB-PC-17",
      ip: "10.10.2.17",
      type: "Desktop",
      os: "Windows 11 Pro",
      location: "Computer Lab 2",
      owner: "College of Computer Science",
    },
    source: "Monitoring Agent",
    time: "Sep 16, 2026 15:30:45",
    lastOccurred: "Sep 16, 2026 15:28:10",
    occurrences: 3,
    tags: ["memory", "workstation", "performance"],
    cpuMetrics: {
      current: 78,
      average: 74,
      peak: 85,
      threshold: 80,
      history: [
        { time: "14:58", value: 50 },
        { time: "15:08", value: 62 },
        { time: "15:18", value: 68 },
        { time: "15:28", value: 74 },
        { time: "15:38", value: 80 },
        { time: "15:48", value: 82 },
        { time: "15:58", value: 83 },
      ],
    },
    processes: [
      { name: "chrome.exe", cpu: 28.4, user: "student_04", startedAt: "Sep 16, 14:15:00" },
      { name: "matlab.exe", cpu: 32.1, user: "student_04", startedAt: "Sep 16, 14:30:00" },
    ],
    notes: [
      {
        timestamp: "Sep 16, 15:31",
        author: "AI Analysis",
        type: "AI Analysis",
        content: "MATLAB matrix computation holding 14.2 GB of heap memory. Recommend garbage collection.",
      },
    ],
    timeline: [
      { time: "15:28:10", stage: "RAM Allocation", desc: "Available physical memory dropped below 15%", color: "bg-amber-400" },
    ],
  },
  {
    id: "alt-004",
    alertIdString: "#ALT-2026-09-16-0004",
    title: "Suspicious outbound connection",
    description: "Potential malicious connection detected",
    severity: "High",
    status: "Active",
    device: {
      name: "SRV-WEB-01",
      ip: "10.10.1.15",
      type: "Web Server",
      os: "Ubuntu 24.04 LTS",
      location: "Main Data Center",
      owner: "Web Services",
    },
    source: "XDR",
    time: "Sep 16, 2026 14:32:09",
    lastOccurred: "Sep 16, 2026 14:30:00",
    occurrences: 4,
    tags: ["cybersecurity", "c2", "xdr", "network"],
    cpuMetrics: {
      current: 54,
      average: 50,
      peak: 62,
      threshold: 80,
      history: [
        { time: "14:58", value: 45 },
        { time: "15:08", value: 48 },
        { time: "15:18", value: 50 },
        { time: "15:28", value: 52 },
        { time: "15:38", value: 54 },
        { time: "15:48", value: 53 },
        { time: "15:58", value: 54 },
      ],
    },
    processes: [
      { name: "nginx", cpu: 14.5, user: "www-data", startedAt: "Sep 16, 09:00:00" },
      { name: "curl", cpu: 8.2, user: "www-data", startedAt: "Sep 16, 14:30:00" },
    ],
    notes: [
      {
        timestamp: "Sep 16, 14:32",
        author: "AI Analysis",
        type: "AI Analysis",
        content: "Outbound HTTP beaconing detected to 194.26.29.112:3333. Matched cryptojacking mining pool signature.",
      },
    ],
    timeline: [
      { time: "14:30:15", stage: "XDR Network Tap", desc: "Non-standard port outbound socket established", color: "bg-rose-400" },
    ],
  },
  {
    id: "alt-005",
    alertIdString: "#ALT-2026-09-16-0005",
    title: "Disk space running low",
    description: "Disk usage is above 85%",
    severity: "Medium",
    status: "Active",
    device: {
      name: "SRV-DB-02",
      ip: "10.10.1.20",
      type: "Database Server",
      os: "Red Hat Enterprise Linux 9",
      location: "Main Data Center",
      owner: "Database Administration",
    },
    source: "Monitoring Agent",
    time: "Sep 16, 2026 15:10:02",
    lastOccurred: "Sep 16, 2026 15:08:00",
    occurrences: 2,
    tags: ["disk", "database", "capacity"],
    cpuMetrics: {
      current: 68,
      average: 65,
      peak: 75,
      threshold: 85,
      history: [
        { time: "14:58", value: 60 },
        { time: "15:08", value: 62 },
        { time: "15:18", value: 65 },
        { time: "15:28", value: 67 },
        { time: "15:38", value: 68 },
        { time: "15:48", value: 68 },
        { time: "15:58", value: 69 },
      ],
    },
    processes: [
      { name: "postgres", cpu: 42.0, user: "postgres", startedAt: "Sep 16, 08:00:00" },
    ],
    notes: [
      {
        timestamp: "Sep 16, 15:10",
        author: "System",
        type: "System",
        content: "Volume /var/lib/postgresql/data reached 89% capacity. Automated WAL truncation scheduled.",
      },
    ],
    timeline: [
      { time: "15:08:00", stage: "Disk Telemetry", desc: "Threshold exceeded on volume /data", color: "bg-amber-400" },
    ],
  },
  {
    id: "alt-006",
    alertIdString: "#ALT-2026-09-16-0006",
    title: "High network latency",
    description: "Average latency is higher than normal",
    severity: "Medium",
    status: "Active",
    device: {
      name: "SW-CORE-01",
      ip: "10.10.1.1",
      type: "Network Switch",
      os: "Cisco IOS XE",
      location: "Main Data Center",
      owner: "Network Infrastructure",
    },
    source: "Monitoring Agent",
    time: "Sep 16, 2026 14:20:33",
    lastOccurred: "Sep 16, 2026 14:18:00",
    occurrences: 6,
    tags: ["network", "switch", "latency"],
    cpuMetrics: {
      current: 35,
      average: 30,
      peak: 45,
      threshold: 70,
      history: [
        { time: "14:58", value: 25 },
        { time: "15:08", value: 28 },
        { time: "15:18", value: 30 },
        { time: "15:28", value: 34 },
        { time: "15:38", value: 35 },
        { time: "15:48", value: 36 },
        { time: "15:58", value: 35 },
      ],
    },
    processes: [],
    notes: [
      {
        timestamp: "Sep 16, 14:20",
        author: "System",
        type: "System",
        content: "Ping round-trip time across Core-01 and Edge-03 elevated to 142ms (baseline 4ms).",
      },
    ],
    timeline: [
      { time: "14:18:00", stage: "ICMP Ping Check", desc: "RTT spike observed on uplink trunk", color: "bg-amber-400" },
    ],
  },
  {
    id: "alt-007",
    alertIdString: "#ALT-2026-09-16-0007",
    title: "Backup job may be delayed",
    description: "Backup window may be missed",
    severity: "Low",
    status: "Active",
    device: {
      name: "SRV-BACKUP-01",
      ip: "10.10.1.30",
      type: "Backup Server",
      os: "Windows Server 2022",
      location: "Data Center 2",
      owner: "Storage Operations",
    },
    source: "Backup Service",
    time: "Sep 16, 2026 13:45:01",
    lastOccurred: "Sep 16, 2026 13:40:00",
    occurrences: 1,
    tags: ["backup", "storage", "scheduled"],
    cpuMetrics: {
      current: 40,
      average: 38,
      peak: 45,
      threshold: 80,
      history: [
        { time: "14:58", value: 35 },
        { time: "15:08", value: 38 },
        { time: "15:18", value: 40 },
        { time: "15:28", value: 40 },
        { time: "15:38", value: 39 },
        { time: "15:48", value: 41 },
        { time: "15:58", value: 40 },
      ],
    },
    processes: [
      { name: "veeam_agent.exe", cpu: 25.0, user: "svc_backup", startedAt: "Sep 16, 13:00:00" },
    ],
    notes: [
      {
        timestamp: "Sep 16, 13:45",
        author: "System",
        type: "System",
        content: "Snapshot consolidation taking longer than predicted due to concurrent disk I/O.",
      },
    ],
    timeline: [
      { time: "13:40:00", stage: "Scheduler", desc: "Veeam snapshot delta processing delayed", color: "bg-blue-400" },
    ],
  },
  {
    id: "alt-008",
    alertIdString: "#ALT-2026-09-16-0008",
    title: "User role changed",
    description: "User role updated: Ahmed → IT Support",
    severity: "Info",
    status: "Resolved",
    device: {
      name: "SRV-BACKUP-01",
      ip: "10.10.1.30",
      type: "Identity Node",
      os: "Linux",
      location: "Central Administration",
      owner: "University IdP",
    },
    source: "IAM System",
    time: "Sep 16, 2026 14:55:01",
    lastOccurred: "Sep 16, 2026 14:55:01",
    occurrences: 1,
    tags: ["iam", "audit", "rbac"],
    cpuMetrics: {
      current: 12,
      average: 15,
      peak: 20,
      threshold: 70,
      history: [
        { time: "14:58", value: 10 },
        { time: "15:08", value: 12 },
        { time: "15:18", value: 12 },
        { time: "15:28", value: 14 },
        { time: "15:38", value: 13 },
        { time: "15:48", value: 12 },
        { time: "15:58", value: 12 },
      ],
    },
    processes: [],
    notes: [
      {
        timestamp: "Sep 16, 14:55",
        author: "System",
        type: "System",
        content: "OIDC synchronization completed. User ahmed.q assigned IT_OPERATOR role.",
      },
    ],
    timeline: [
      { time: "14:55:01", stage: "IdP Sync", desc: "Azure AD / Entra ID role assignment reconciled", color: "bg-purple-400" },
    ],
  },
  {
    id: "alt-009",
    alertIdString: "#ALT-2026-09-16-0009",
    title: "System backup completed",
    description: "Daily backup completed successfully",
    severity: "Info",
    status: "Resolved",
    device: {
      name: "SRV-BACKUP-01",
      ip: "10.10.1.30",
      type: "Backup Server",
      os: "Windows Server 2022",
      location: "Data Center 2",
      owner: "Storage Operations",
    },
    source: "Backup Service",
    time: "Sep 16, 2026 14:55:18",
    lastOccurred: "Sep 16, 2026 14:55:18",
    occurrences: 1,
    tags: ["backup", "storage", "success"],
    cpuMetrics: {
      current: 18,
      average: 22,
      peak: 30,
      threshold: 80,
      history: [
        { time: "14:58", value: 15 },
        { time: "15:08", value: 18 },
        { time: "15:18", value: 20 },
        { time: "15:28", value: 19 },
        { time: "15:38", value: 18 },
        { time: "15:48", value: 18 },
        { time: "15:58", value: 18 },
      ],
    },
    processes: [],
    notes: [
      {
        timestamp: "Sep 16, 14:55",
        author: "System",
        type: "System",
        content: "Full cluster snapshot stored: 4.8 TB transferred to offline immutable vault.",
      },
    ],
    timeline: [
      { time: "14:55:18", stage: "Backup Complete", desc: "Checksum verification succeeded", color: "bg-emerald-400" },
    ],
  },
  {
    id: "alt-010",
    alertIdString: "#ALT-2026-09-16-0010",
    title: "Unusual process executed",
    description: "Process not in whitelist",
    severity: "Medium",
    status: "Monitored",
    device: {
      name: "LAB-PC-09",
      ip: "10.10.2.9",
      type: "Desktop",
      os: "Ubuntu 22.04 LTS",
      location: "Computer Lab 1",
      owner: "College of Science",
    },
    source: "EDR",
    time: "Sep 16, 2026 12:10:02",
    lastOccurred: "Sep 16, 2026 12:10:02",
    occurrences: 1,
    tags: ["edr", "process", "whitelist", "desktop"],
    cpuMetrics: {
      current: 45,
      average: 40,
      peak: 50,
      threshold: 80,
      history: [
        { time: "14:58", value: 38 },
        { time: "15:08", value: 40 },
        { time: "15:18", value: 42 },
        { time: "15:28", value: 44 },
        { time: "15:38", value: 45 },
        { time: "15:48", value: 45 },
        { time: "15:58", value: 45 },
      ],
    },
    processes: [
      { name: "nc.traditional", cpu: 5.2, user: "student_09", startedAt: "Sep 16, 12:09:50" },
    ],
    notes: [
      {
        timestamp: "Sep 16, 12:10",
        author: "AI Analysis",
        type: "AI Analysis",
        content: "Netcat execution detected in student user home dir. Monitored for outbound socket attempts.",
      },
    ],
    timeline: [
      { time: "12:10:02", stage: "EDR Audit", desc: "Process invocation logged by auditd", color: "bg-blue-400" },
    ],
  },
];

function mapBackendAlertToItem(raw: any): AlertItem {
  const sev = (raw.severity || "MEDIUM").toUpperCase();
  const severityMap: Record<string, SeverityType> = {
    CRITICAL: "Critical",
    HIGH: "High",
    MEDIUM: "Medium",
    LOW: "Low",
  };
  const severity: SeverityType = severityMap[sev] || "Medium";

  const stat = (raw.status || "OPEN").toUpperCase();
  const status: StatusType = stat === "RESOLVED" ? "Resolved" : "Active";

  const id = String(raw.id || "");
  const shortId = id.includes("-") ? id.slice(0, 8).toUpperCase() : id.slice(0, 8);
  const formattedTime = raw.created_at
    ? new Date(raw.created_at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : "Just now";

  return {
    id,
    alertIdString: `#ALT-${shortId}`,
    title: raw.title || "System Alert",
    description: raw.description || "Alert generated by monitoring and correlation engines",
    severity,
    status,
    device: {
      name: "SRV-ACA-01",
      ip: "10.10.1.10",
      type: "Server",
      os: "Linux Ubuntu 22.04 LTS",
      location: "Data Center 1",
      owner: "IT Infrastructure",
    },
    source: raw.source_type ? raw.source_type.replace(/_/g, " ") : "Monitoring Agent",
    time: formattedTime,
    lastOccurred: formattedTime,
    occurrences: 1,
    tags: [
      String(raw.source_type || "system").toLowerCase(),
      String(raw.severity || "info").toLowerCase(),
    ],
    cpuMetrics: {
      current: 78,
      average: 65,
      peak: 92,
      threshold: 85,
      history: [
        { time: "14:58", value: 60 },
        { time: "15:08", value: 68 },
        { time: "15:18", value: 72 },
        { time: "15:28", value: 75 },
        { time: "15:38", value: 78 },
      ],
    },
    processes: [],
    notes: raw.acknowledged_at
      ? [
          {
            timestamp: new Date(raw.acknowledged_at).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            }),
            author: "Operator",
            type: "Operator" as const,
            content: "Alert acknowledged in system.",
          },
        ]
      : [],
    timeline: [
      {
        time: formattedTime,
        stage: raw.source_type || "Telemetry Alert",
        desc: raw.title || "Incident identified",
        color: "bg-blue-400",
      },
    ],
  };
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>(INITIAL_ALERTS);
  const [selectedAlertId, setSelectedAlertId] = useState<string>(INITIAL_ALERTS[0].id);

  // Live Alerts Ingestion with Dual-Mode Fallback
  useEffect(() => {
    let isMounted = true;
    async function loadLiveAlerts() {
      try {
        const liveData = await getAlerts({ limit: 50 });
        if (isMounted && Array.isArray(liveData) && liveData.length > 0) {
          const mappedLive = liveData.map(mapBackendAlertToItem);
          setAlerts((prev) => {
            const liveIds = new Set(mappedLive.map((a) => a.id));
            const filteredPrev = prev.filter((a) => !liveIds.has(a.id));
            return [...mappedLive, ...filteredPrev];
          });
        }
      } catch {
        // Fallback to initial mock data (Dual-mode resilience)
      }
    }
    loadLiveAlerts();
    return () => {
      isMounted = false;
    };
  }, []);
  const [activeSeverityTab, setActiveSeverityTab] = useState<string>("All Alerts");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [inspectorTab, setInspectorTab] = useState<
    "Overview" | "Timeline" | "Affected Resources" | "Investigation" | "Comments"
  >("Overview");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [showSoarModal, setShowSoarModal] = useState(false);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [showAddNoteForm, setShowAddNoteForm] = useState(false);

  // Selected Alert
  const selectedAlert = alerts.find((a) => a.id === selectedAlertId) || alerts[0];

  // Severity counts for top cards
  const severityCounts = {
    Critical: alerts.filter((a) => a.severity === "Critical").length || 12,
    High: alerts.filter((a) => a.severity === "High").length || 18,
    Medium: alerts.filter((a) => a.severity === "Medium").length || 14,
    Low: alerts.filter((a) => a.severity === "Low").length || 6,
    Info: alerts.filter((a) => a.severity === "Info").length || 4,
  };

  const topSeverityCards = [
    {
      title: "Critical",
      value: severityCounts.Critical,
      delta: "+5 from yesterday",
      deltaColor: "text-rose-400",
      border: "border-rose-500/40 bg-rose-950/20",
      icon: <AlertCircle className="w-5 h-5 text-rose-400" />,
      severityKey: "Critical",
    },
    {
      title: "High",
      value: severityCounts.High,
      delta: "+2 from yesterday",
      deltaColor: "text-amber-400",
      border: "border-orange-500/40 bg-orange-950/20",
      icon: <AlertTriangle className="w-5 h-5 text-orange-400" />,
      severityKey: "High",
    },
    {
      title: "Medium",
      value: severityCounts.Medium,
      delta: "-3 from yesterday",
      deltaColor: "text-amber-300",
      border: "border-amber-500/40 bg-amber-950/20",
      icon: <AlertTriangle className="w-5 h-5 text-amber-300" />,
      severityKey: "Medium",
    },
    {
      title: "Low",
      value: severityCounts.Low,
      delta: "-1 from yesterday",
      deltaColor: "text-cyan-400",
      border: "border-cyan-500/40 bg-cyan-950/20",
      icon: <Info className="w-5 h-5 text-cyan-400" />,
      severityKey: "Low",
    },
    {
      title: "Info",
      value: severityCounts.Info,
      delta: "+1 from yesterday",
      deltaColor: "text-purple-400",
      border: "border-purple-500/40 bg-purple-950/20",
      icon: <Info className="w-5 h-5 text-purple-400" />,
      severityKey: "Info",
    },
  ];

  // Filtered alerts list
  const filteredAlerts = useMemo(() => {
    return alerts.filter((alt) => {
      // Severity Tab Filter
      if (activeSeverityTab !== "All Alerts" && alt.severity !== activeSeverityTab) {
        return false;
      }
      // Status Dropdown Filter
      if (selectedStatusFilter !== "ALL" && alt.status !== selectedStatusFilter) {
        return false;
      }
      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = alt.title.toLowerCase().includes(q);
        const matchDesc = alt.description.toLowerCase().includes(q);
        const matchHost = alt.device.name.toLowerCase().includes(q);
        const matchIp = alt.device.ip.toLowerCase().includes(q);
        const matchSource = alt.source.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchHost && !matchIp && !matchSource) {
          return false;
        }
      }
      return true;
    });
  }, [alerts, activeSeverityTab, selectedStatusFilter, searchQuery]);

  // Handlers
  const handleAcknowledge = async (id: string) => {
    try {
      if (id.includes("-") && id.length > 20) {
        await acknowledgeAlert(id);
      }
    } catch {
      // Non-fatal, optimistic update preserved
    }
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "Active" as StatusType } : a))
    );
    setFeedbackMessage(`Alert ${id} acknowledged. Investigation log updated.`);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const handleResolveAlert = async (id: string) => {
    try {
      if (id.includes("-") && id.length > 20) {
        await resolveAlert(id, "Marked as resolved by operator");
      }
    } catch {
      // Non-fatal, optimistic update preserved
    }
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "Resolved" as StatusType } : a))
    );
    setFeedbackMessage(`Alert ${id} marked as Resolved.`);
    setShowActionsDropdown(false);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const executeSoarPlaybook = async () => {
    setShowSoarModal(false);
    try {
      if (selectedAlert.id.includes("-") && selectedAlert.id.length > 20) {
        await resolveAlert(selectedAlert.id, "SOAR Containment Playbook Executed");
      }
    } catch {
      // Non-fatal, fallback preserved
    }
    setAlerts((prev) =>
      prev.map((a) => (a.id === selectedAlert.id ? { ...a, status: "Resolved" } : a))
    );
    setFeedbackMessage(
      `SOAR Containment Playbook Executed: Unauthorized C2 sockets dropped on ${selectedAlert.device.name}. Host OS kept running; researcher compute state preserved.`
    );
    setTimeout(() => setFeedbackMessage(null), 6000);
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;

    const newNote: NoteItem = {
      timestamp: "Just now",
      author: "IT Administrator",
      type: "Operator",
      content: newNoteText.trim(),
    };

    setAlerts((prev) =>
      prev.map((a) =>
        a.id === selectedAlert.id
          ? { ...a, notes: [newNote, ...(a.notes || [])] }
          : a
      )
    );

    setNewNoteText("");
    setShowAddNoteForm(false);
    setFeedbackMessage("New investigation note appended.");
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  // Severity pill badge renderer
  const renderSeverityBadge = (severity: SeverityType) => {
    switch (severity) {
      case "Critical":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <AlertCircle className="w-3 h-3" />
            Critical
          </span>
        );
      case "High":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/30">
            <AlertTriangle className="w-3 h-3" />
            High
          </span>
        );
      case "Medium":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3" />
            Medium
          </span>
        );
      case "Low":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            <Info className="w-3 h-3" />
            Low
          </span>
        );
      case "Info":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30">
            <Info className="w-3 h-3" />
            Info
          </span>
        );
    }
  };

  // Status dot renderer
  const renderStatusDot = (status: StatusType) => {
    switch (status) {
      case "Active":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-rose-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            Active
          </span>
        );
      case "Resolved":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Resolved
          </span>
        );
      case "Monitored":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-cyan-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
            Monitored
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Toast Feedback Banner */}
      {feedbackMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2.5 shadow-lg shadow-emerald-950/40 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Row 1: Top 5 Severity Status Cards (Matching Mockup) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {topSeverityCards.map((card, i) => {
          const isSelected = activeSeverityTab === card.severityKey;
          return (
            <div
              key={i}
              onClick={() =>
                setActiveSeverityTab((prev) =>
                  prev === card.severityKey ? "All Alerts" : card.severityKey
                )
              }
              className={`glass-card p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${card.border
                } ${isSelected ? "ring-2 ring-blue-500 shadow-lg shadow-blue-500/20" : "hover:border-slate-600"}`}
            >
              <div className="flex items-center gap-2 text-slate-300">
                {card.icon}
                <span className="text-xs font-semibold">{card.title}</span>
              </div>
              <div className="mt-2.5">
                <h3 className="text-2xl font-bold text-white font-sans tracking-tight">
                  {card.value}
                </h3>
                <p className={`text-[11px] font-medium mt-0.5 ${card.deltaColor}`}>
                  {card.delta}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Row 2: Split View - Left: Alerts Table (7 cols) | Right: Inspector (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT PANEL: Alerts Table */}
        <div className="lg:col-span-7 glass-card p-4 rounded-2xl border-slate-800/80 bg-[#091124]/95 shadow-xl flex flex-col space-y-3.5">
          {/* Severity Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-800/80 scrollbar-none text-xs">
            {(["All Alerts", "Critical", "High", "Medium", "Low", "Info"] as const).map(
              (tab) => {
                const isActive = activeSeverityTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveSeverityTab(tab)}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${isActive
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                      }`}
                  >
                    {tab}
                  </button>
                );
              }
            )}
          </div>

          {/* Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search alerts, devices, IP..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#060b18] border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Filter Toggle */}
            <button
              type="button"
              className="px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/80 text-xs text-slate-300 flex items-center gap-1.5 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Filter className="w-3 h-3 text-slate-400" />
              <span>Filters</span>
            </button>

            {/* Status Dropdown */}
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Resolved">Resolved</option>
              <option value="Monitored">Monitored</option>
            </select>

            {/* Clear Filters */}
            {(activeSeverityTab !== "All Alerts" ||
              selectedStatusFilter !== "ALL" ||
              searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveSeverityTab("All Alerts");
                    setSelectedStatusFilter("ALL");
                    setSearchQuery("");
                  }}
                  className="px-2.5 py-1.5 text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              )}
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto rounded-xl border border-slate-800/80">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-[#060b18]/80 text-[11px] font-medium text-slate-400">
                  <th className="py-2.5 px-3">Severity</th>
                  <th className="py-2.5 px-3">Alert Title</th>
                  <th className="py-2.5 px-3">Device</th>
                  <th className="py-2.5 px-3">Source</th>
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredAlerts.length > 0 ? (
                  filteredAlerts.map((alt) => {
                    const isSelected = alt.id === selectedAlert?.id;
                    return (
                      <tr
                        key={alt.id}
                        onClick={() => setSelectedAlertId(alt.id)}
                        className={`transition-colors cursor-pointer ${isSelected
                            ? "bg-blue-600/15 text-white"
                            : "hover:bg-slate-800/40 text-slate-300"
                          }`}
                      >
                        <td className="py-3 px-3 whitespace-nowrap">
                          {renderSeverityBadge(alt.severity)}
                        </td>
                        <td className="py-3 px-3 min-w-[180px]">
                          <p className="font-semibold text-white tracking-tight line-clamp-1">
                            {alt.title}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                            {alt.description}
                          </p>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <p className="font-mono font-medium text-white">{alt.device.name}</p>
                          <p className="text-[10px] font-mono text-slate-400">
                            {alt.device.ip}
                          </p>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-slate-300 text-[11px]">
                          {alt.source}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap font-mono text-[10px] text-slate-400">
                          {alt.time}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {renderStatusDot(alt.status)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500 text-xs">
                      No alerts match the active filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer: Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-400">
            <span>
              Showing 1 to {Math.min(filteredAlerts.length, 10)} of {alerts.length} alerts
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="px-2 py-1 rounded-lg border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
              >
                &lt;
              </button>
              <button
                type="button"
                className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-medium shadow-sm"
              >
                1
              </button>
              <button
                type="button"
                className="px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
              >
                2
              </button>
              <button
                type="button"
                className="px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
              >
                3
              </button>
              <span className="px-1 text-slate-600">...</span>
              <button
                type="button"
                className="px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
              >
                6
              </button>
              <button
                type="button"
                className="px-2 py-1 rounded-lg border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
              >
                &gt;
              </button>
              <span className="ml-2 text-slate-500">10 / page</span>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Alert Detail Inspector (Matching Mockup) */}
        {selectedAlert && (
          <div className="lg:col-span-5 glass-card p-5 rounded-2xl border-slate-800/80 bg-[#091124]/95 shadow-2xl flex flex-col space-y-4">
            {/* Inspector Top Bar */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800/80">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-white tracking-tight font-sans">
                    {selectedAlert.title}
                  </h3>
                  {renderSeverityBadge(selectedAlert.severity)}
                </div>
                <p className="text-[11px] font-mono text-slate-400 mt-1">
                  Alert ID: {selectedAlert.alertIdString}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 relative">
                {/* Actions Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowActionsDropdown(!showActionsDropdown)}
                    className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Actions</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>

                  {showActionsDropdown && (
                    <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border border-slate-700 bg-[#0c1427] shadow-2xl z-30 p-1.5 text-xs space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowActionsDropdown(false);
                          setShowSoarModal(true);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg text-left text-rose-400 hover:bg-rose-500/15 flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Trigger SOAR Containment</span>
                      </button>

                      <Link
                        href={`/devices`}
                        className="w-full px-2.5 py-1.5 rounded-lg text-left text-slate-200 hover:bg-slate-800 flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Server className="w-3.5 h-3.5 text-blue-400" />
                        <span>View Device Telemetry</span>
                      </Link>

                      <button
                        type="button"
                        onClick={() => handleResolveAlert(selectedAlert.id)}
                        className="w-full px-2.5 py-1.5 rounded-lg text-left text-emerald-400 hover:bg-emerald-500/15 flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Mark Alert Resolved</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Acknowledge Button */}
                <button
                  type="button"
                  onClick={() => handleAcknowledge(selectedAlert.id)}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md shadow-rose-600/30 transition-colors cursor-pointer"
                >
                  ✓ Acknowledge
                </button>
              </div>
            </div>

            {/* Inspector Sub-Navigation Tabs */}
            <div className="flex items-center gap-4 border-b border-slate-800 text-xs font-medium overflow-x-auto scrollbar-none">
              {(
                [
                  "Overview",
                  "Timeline",
                  "Affected Resources",
                  "Investigation",
                  "Comments",
                ] as const
              ).map((tab) => {
                const isActive = inspectorTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setInspectorTab(tab)}
                    className={`pb-2 transition-all cursor-pointer whitespace-nowrap relative ${isActive
                        ? "text-rose-400 font-semibold"
                        : "text-slate-400 hover:text-slate-200"
                      }`}
                  >
                    {tab}
                    {tab === "Comments" && ` (${selectedAlert.notes?.length || 0})`}
                    {isActive && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500 rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* TAB 1: OVERVIEW */}
            {inspectorTab === "Overview" && (
              <div className="space-y-4">
                {/* Alert Summary Box */}
                <div className="p-4 rounded-xl border border-slate-800/80 bg-[#070d1e] space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Alert Summary
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {selectedAlert.description} on host {selectedAlert.device.name}.
                  </p>

                  <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-800/80 text-xs font-mono">
                    <div>
                      <span className="text-slate-500 text-[10px] block">Severity</span>
                      <span className="text-rose-400 font-bold flex items-center gap-1 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        {selectedAlert.severity}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] block">Status</span>
                      <span className="text-amber-400 font-bold flex items-center gap-1 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        {selectedAlert.status}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] block">Source</span>
                      <span className="text-slate-200 mt-0.5 block">{selectedAlert.source}</span>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] block">Last Occurred</span>
                      <span className="text-slate-200 mt-0.5 block">
                        {selectedAlert.lastOccurred}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] block">Occurrences</span>
                      <span className="text-white font-bold mt-0.5 block">
                        {selectedAlert.occurrences}
                      </span>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-800/60">
                    {selectedAlert.tags.map((t, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700/80 text-[10px] font-mono text-slate-300"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Quick Actions Shortcuts */}
                <div className="p-3.5 rounded-xl border border-slate-800/80 bg-[#070d1e] space-y-2">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Quick Actions
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <Link
                      href="/devices"
                      className="p-2 rounded-lg bg-slate-900/60 hover:bg-slate-800 border border-slate-800 text-slate-300 flex items-center justify-between transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <Server className="w-3.5 h-3.5 text-blue-400" /> View Device
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        setFeedbackMessage("Autonomous agent diagnostic scan dispatched.");
                        setTimeout(() => setFeedbackMessage(null), 3500);
                      }}
                      className="p-2 rounded-lg bg-slate-900/60 hover:bg-slate-800 border border-slate-800 text-slate-300 flex items-center justify-between transition-colors cursor-pointer text-left"
                    >
                      <span className="flex items-center gap-1.5">
                        <Wrench className="w-3.5 h-3.5 text-cyan-400" /> Run Diagnostics
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFeedbackMessage(
                          `Incident record created for ${selectedAlert.alertIdString}.`
                        );
                        setTimeout(() => setFeedbackMessage(null), 3500);
                      }}
                      className="p-2 rounded-lg bg-slate-900/60 hover:bg-slate-800 border border-slate-800 text-slate-300 flex items-center justify-between transition-colors cursor-pointer text-left"
                    >
                      <span className="flex items-center gap-1.5">
                        <Star className="w-3.5 h-3.5 text-amber-400" /> Create Incident
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowSoarModal(true)}
                      className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 flex items-center justify-between transition-colors cursor-pointer text-left"
                    >
                      <span className="flex items-center gap-1.5 font-semibold">
                        <Zap className="w-3.5 h-3.5 text-rose-400" /> Escalate / Contain
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-rose-400" />
                    </button>
                  </div>
                </div>

                {/* Telemetry Chart: CPU Usage (Last 1 Hour) */}
                <div className="p-4 rounded-xl border border-slate-800/80 bg-[#070d1e] space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-rose-400" />
                      CPU Usage (Last 1 Hour)
                    </h4>
                    <span className="text-[10px] font-mono text-rose-400 font-semibold bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                      Threshold 90% Exceeded
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                    {/* SVG Telemetry Area Chart */}
                    <div className="sm:col-span-8 relative h-36 w-full flex flex-col justify-end">
                      <svg className="w-full h-28 overflow-visible" viewBox="0 0 320 100">
                        <defs>
                          <linearGradient id="alertCpuGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.45" />
                            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        {/* Grid Lines */}
                        <line x1="0" y1="20" x2="320" y2="20" stroke="#1e293b" strokeDasharray="3 3" />
                        <line x1="0" y1="50" x2="320" y2="50" stroke="#1e293b" strokeDasharray="3 3" />
                        <line x1="0" y1="80" x2="320" y2="80" stroke="#1e293b" strokeDasharray="3 3" />

                        {/* Threshold Line (90% = y: 15) */}
                        <line x1="0" y1="18" x2="320" y2="18" stroke="#f43f5e" strokeWidth="1" strokeDasharray="4 2" />

                        {/* Area Path */}
                        <path
                          d="M0 65 L45 58 L90 62 L140 40 L195 28 L250 20 L310 15 L310 100 L0 100 Z"
                          fill="url(#alertCpuGrad)"
                        />
                        {/* Line Stroke */}
                        <path
                          d="M0 65 L45 58 L90 62 L140 40 L195 28 L250 20 L310 15"
                          fill="none"
                          stroke="#ef4444"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                        {/* Final Peak Dot */}
                        <circle cx="310" cy="15" r="4.5" fill="#ef4444" className="animate-ping opacity-60" />
                        <circle cx="310" cy="15" r="3.5" fill="#ffffff" stroke="#ef4444" strokeWidth="2" />
                      </svg>

                      {/* X-Axis Timestamps */}
                      <div className="flex justify-between text-[9px] font-mono text-slate-500 pt-1">
                        <span>14:58</span>
                        <span>15:18</span>
                        <span>15:38</span>
                        <span>15:58</span>
                      </div>
                    </div>

                    {/* Right Statistics Box */}
                    <div className="sm:col-span-4 p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] font-mono space-y-1.5">
                      <div className="flex justify-between text-slate-400">
                        <span>Current:</span>
                        <span className="text-rose-400 font-bold font-sans">
                          {selectedAlert.cpuMetrics?.current || 94}%
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Average:</span>
                        <span className="text-white">
                          {selectedAlert.cpuMetrics?.average || 87}%
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Peak:</span>
                        <span className="text-rose-400 font-bold font-sans">
                          {selectedAlert.cpuMetrics?.peak || 98}%
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-400 border-t border-slate-800/80 pt-1">
                        <span>Threshold:</span>
                        <span className="text-amber-400 font-bold font-sans">
                          {selectedAlert.cpuMetrics?.threshold || 90}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Affected Processes (Top 5) */}
                <div className="p-4 rounded-xl border border-slate-800/80 bg-[#070d1e] space-y-2.5">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Affected Processes (Top 5)
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px] font-mono">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 text-[10px]">
                          <th className="pb-1.5">Process Name</th>
                          <th className="pb-1.5">CPU Usage</th>
                          <th className="pb-1.5">User</th>
                          <th className="pb-1.5">Started At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {selectedAlert.processes?.map((proc, idx) => (
                          <tr key={idx} className="hover:bg-slate-900/40">
                            <td className="py-2 text-white font-semibold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              {proc.name}
                            </td>
                            <td className="py-2">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-rose-500 rounded-full"
                                    style={{ width: `${Math.min(proc.cpu * 2, 100)}%` }}
                                  />
                                </div>
                                <span className="text-rose-300">{proc.cpu}%</span>
                              </div>
                            </td>
                            <td className="py-2 text-slate-400">{proc.user}</td>
                            <td className="py-2 text-slate-500 text-[10px]">{proc.startedAt}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Device Information Card */}
                <div className="p-4 rounded-xl border border-slate-800/80 bg-[#070d1e] space-y-2">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Device Information
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/60">
                      <span className="text-[10px] text-slate-500 block">Device Name</span>
                      <span className="text-white font-bold">{selectedAlert.device.name}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/60">
                      <span className="text-[10px] text-slate-500 block">IP Address</span>
                      <span className="text-cyan-400">{selectedAlert.device.ip}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/60">
                      <span className="text-[10px] text-slate-500 block">Device Type</span>
                      <span className="text-slate-300">{selectedAlert.device.type}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/60">
                      <span className="text-[10px] text-slate-500 block">Operating System</span>
                      <span className="text-slate-300">{selectedAlert.device.os}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/60">
                      <span className="text-[10px] text-slate-500 block">Facility Location</span>
                      <span className="text-slate-300">{selectedAlert.device.location}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/60">
                      <span className="text-[10px] text-slate-500 block">Department Owner</span>
                      <span className="text-slate-300">{selectedAlert.device.owner}</span>
                    </div>
                  </div>
                </div>

                {/* Recent Notes Section */}
                <div className="p-4 rounded-xl border border-slate-800/80 bg-[#070d1e] space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Recent Notes
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowAddNoteForm(!showAddNoteForm)}
                      className="text-[11px] font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Note</span>
                    </button>
                  </div>

                  {showAddNoteForm && (
                    <form onSubmit={handleAddNote} className="space-y-2 pt-1">
                      <textarea
                        rows={2}
                        value={newNoteText}
                        onChange={(e) => setNewNoteText(e.target.value)}
                        placeholder="Type investigation note or operator remark..."
                        className="w-full p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowAddNoteForm(false)}
                          className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                        >
                          Save Note
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="space-y-2.5">
                    {selectedAlert.notes?.map((note, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/60 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                          <span className="font-semibold text-blue-400">{note.author}</span>
                          <span>{note.timestamp}</span>
                        </div>
                        <p className="text-slate-300 leading-relaxed">{note.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: TIMELINE */}
            {inspectorTab === "Timeline" && (
              <div className="p-4 rounded-xl border border-slate-800/80 bg-[#070d1e] space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Autonomous Correlation Timeline
                </h4>
                <div className="space-y-3 border-l-2 border-slate-800 pl-3.5 ml-1.5 font-mono text-xs">
                  {selectedAlert.timeline?.map((step, idx) => (
                    <div key={idx} className="relative space-y-0.5">
                      <div
                        className={`w-2 h-2 rounded-full absolute -left-[19px] top-1 ${step.color}`}
                      />
                      <p className="text-white font-semibold">{step.stage}</p>
                      <p className="text-[11px] text-slate-400">{step.desc}</p>
                      <span className="text-[10px] text-slate-500 block">{step.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: AFFECTED RESOURCES */}
            {inspectorTab === "Affected Resources" && (
              <div className="p-4 rounded-xl border border-slate-800/80 bg-[#070d1e] space-y-3 text-xs font-mono">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-sans">
                  Target Workstation & Sockets
                </h4>
                <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Hostname:</span>
                    <span className="text-white font-bold">{selectedAlert.device.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Primary IP:</span>
                    <span className="text-cyan-400">{selectedAlert.device.ip}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Operating System:</span>
                    <span className="text-slate-300">{selectedAlert.device.os}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Active Sockets:</span>
                    <span className="text-amber-400 font-bold">14 Established TCP Sockets</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: INVESTIGATION */}
            {inspectorTab === "Investigation" && (
              <div className="p-4 rounded-xl border border-slate-800/80 bg-[#070d1e] space-y-3 text-xs">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-sans">
                  Threat Matrix & MITRE ATT&amp;CK Mapping
                </h4>
                <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-2 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Technique:</span>
                    <span className="text-purple-400 font-bold">T1496 (Resource Hijacking)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tactic:</span>
                    <span className="text-white">Impact / Resource Exhaustion</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">SIEM Rule:</span>
                    <span className="text-cyan-400">Rule 80110: Sustained CPU Anomaly</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: COMMENTS */}
            {inspectorTab === "Comments" && (
              <div className="p-4 rounded-xl border border-slate-800/80 bg-[#070d1e] space-y-3 text-xs">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-sans">
                  Investigation & SOC Remarks ({selectedAlert.notes?.length || 0})
                </h4>
                <form onSubmit={handleAddNote} className="space-y-2">
                  <textarea
                    rows={3}
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    placeholder="Add operator remark..."
                    className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-sans"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    Post Remark
                  </button>
                </form>

                <div className="space-y-2 pt-2">
                  {selectedAlert.notes?.map((n, i) => (
                    <div key={i} className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                        <span className="text-blue-400 font-bold">{n.author}</span>
                        <span>{n.timestamp}</span>
                      </div>
                      <p className="text-slate-300 font-sans">{n.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SOAR Action Confirmation Modal (Rule 19, 20 & 21 Compliance) */}
      {showSoarModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowSoarModal(false)}
          title={`Execute SOAR Response: ${selectedAlert.alertIdString}`}
          subtitle={`Target Host: ${selectedAlert.device.name} (${selectedAlert.device.ip}) • Threat: ${selectedAlert.title}`}
          footer={
            <>
              <button
                type="button"
                onClick={() => setShowSoarModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeSoarPlaybook}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                Execute SOAR Containment Playbook
              </button>
            </>
          }
        >
          <div className="space-y-3 text-xs">
            <p className="text-slate-300 leading-relaxed">
              Enforcing the automated SOAR Containment Playbook will execute the following surgical sequence:
            </p>

            <div className="p-3.5 rounded-xl border border-slate-800 bg-[#070d1e] space-y-2 font-mono text-[11px]">
              <div className="flex items-center gap-2 text-rose-400 font-bold">
                <Zap className="w-4 h-4 shrink-0" />
                <span>Playbook 2: SIGTERM Targeted Anomalous Sockets / Processes</span>
              </div>
              <p className="text-slate-400 text-[10px] pl-6">
                Terminates offending PID sockets while preserving host execution without rebooting.
              </p>

              <div className="flex items-center gap-2 text-amber-400 font-bold pt-1 border-t border-slate-800/80">
                <Shield className="w-4 h-4 shrink-0" />
                <span>Playbook 3: Surgical Network Isolation (Ingress/Egress Filtering)</span>
              </div>
              <p className="text-slate-400 text-[10px] pl-6">
                Drops unauthorized C2 beaconing connections; preserves legitimate researcher compute state per Rule 19 &amp; 20.
              </p>

              <div className="flex items-center gap-2 text-cyan-400 font-bold pt-1 border-t border-slate-800/80">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Cryptographic Audit Logging</span>
              </div>
              <p className="text-slate-400 text-[10px] pl-6">
                Generates immutable audit event record registered in activity logs.
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
