"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Target,
  Monitor,
  CheckCircle2,
  Search,
  ChevronDown,
  Radio,
  Flame,
  Lock,
  Globe,
  ArrowUpRight,
  X,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { DonutChart, DonutSegment } from "@/components/charts/DonutChart";
import {
  MOCK_ACTIVE_THREATS,
  MOCK_TOP_VULNERABILITIES,
  MOCK_RECENT_SECURITY_EVENTS,
  MOCK_SECURITY_POSTURE_DIMENSIONS,
  getIncidents,
  getSecurityEvents,
  isolateWorkstation,
  rollbackWorkstationIsolation,
  getWorkstations,
  getDashboardKpis,
  updateIncidentStatus,
} from "@/lib/api";
import {
  ActiveThreatItem,
  SecurityEventItem,
  VulnerabilityItem,
  Workstation,
  DashboardKpis,
} from "@/types";

function mapBackendIncidentToThreat(raw: any, wsMap?: Map<string, Workstation>): ActiveThreatItem {
  const cat = (raw.category || "OTHER").toUpperCase();
  const titleUpper = (raw.title || "").toUpperCase();
  const descUpper = (raw.description || "").toUpperCase();
  const combined = `${cat} ${titleUpper} ${descUpper}`;

  let category: ActiveThreatItem["category"] = "SUSPICIOUS";
  if (combined.includes("DDOS") || combined.includes("FLOOD")) {
    category = "DDOS";
  } else if (combined.includes("BRUTE") || combined.includes("UNAUTHORIZED") || combined.includes("AUTH")) {
    category = "BRUTE_FORCE";
  } else if (combined.includes("SQL") || combined.includes("PRIVILEGE") || combined.includes("EXPLOIT")) {
    category = "SQLI";
  } else if (
    combined.includes("MALWARE") ||
    combined.includes("CRYPTO") ||
    combined.includes("MINER") ||
    combined.includes("SECURITY") ||
    combined.includes("CYBER")
  ) {
    category = "MALWARE";
  }

  const sev = (raw.severity || "MEDIUM").toUpperCase();
  const risk: ActiveThreatItem["risk"] =
    sev === "CRITICAL" ? "Critical" : sev === "HIGH" ? "High Risk" : sev === "LOW" ? "Low" : "Medium";

  const stat = (raw.status || "OPEN").toUpperCase();
  const status: ActiveThreatItem["status"] =
    stat === "RESOLVED" || stat === "CLOSED"
      ? "Blocked"
      : stat === "INVESTIGATING"
        ? "Investigating"
        : stat === "CONTAINED"
          ? "Blocked"
          : "Active";

  const statusColor: ActiveThreatItem["statusColor"] =
    status === "Blocked" ? "emerald" : risk === "Critical" ? "rose" : risk === "High Risk" ? "amber" : "blue";

  const ws = raw.workstation_id && wsMap ? wsMap.get(String(raw.workstation_id)) : null;

  return {
    id: String(raw.id),
    title: raw.title || `Incident ${raw.incident_number || ""}`,
    category,
    risk,
    target_description: raw.description || "Active security incident detected",
    target_ip: ws?.ip_address || "10.10.1.15",
    time_ago: raw.created_at
      ? new Date(raw.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
      : "Just now",
    status,
    statusColor,
    workstation_id: raw.workstation_id ? String(raw.workstation_id) : undefined,
    workstation_hostname: ws?.hostname || undefined,
    incident_number: raw.incident_number || undefined,
    raw_status: raw.status,
  };
}

function formatEventTitle(eventType?: string, description?: string): string {
  if (eventType) {
    return eventType
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  if (description) {
    const descLower = description.toLowerCase();
    if (descLower.includes("stratum") || descLower.includes("mining")) {
      return "Cryptomining Traffic";
    }
    if (descLower.includes("brute")) {
      return "Brute Force Incursion";
    }
    if (descLower.includes("scan")) {
      return "Port Scan Reconnaissance";
    }
    if (descLower.includes("ddos") || descLower.includes("flood")) {
      return "DDoS Packet Flood";
    }
    if (description.length > 28) {
      return description.slice(0, 26) + "…";
    }
    return description;
  }
  return "Security Event";
}

function formatEventSource(source?: string): string {
  if (!source) return "Wazuh SIEM";
  if (source === "NETWORK_FLOW_INSPECTOR") return "NetFlow";
  if (source === "SECURITY_MONITOR") return "SecDaemon";
  if (source.length > 14) return source.slice(0, 12) + "…";
  return source;
}

function mapBackendSecurityEvent(raw: any, wsMap?: Map<string, Workstation>): SecurityEventItem {
  const sev = (raw.severity || "MEDIUM").toUpperCase();
  const severity: SecurityEventItem["severity"] =
    sev === "CRITICAL" ? "Critical" : sev === "HIGH" ? "High" : sev === "LOW" ? "Low" : "Medium";

  const timeFormatted = raw.created_at || raw.timestamp
    ? new Date(raw.created_at || raw.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
    : "Just now";

  const ws = raw.workstation_id && wsMap ? wsMap.get(String(raw.workstation_id)) : null;
  const isHostIsolated = ws?.status === "ISOLATED";

  const status: SecurityEventItem["status"] = isHostIsolated
    ? "Blocked"
    : severity === "Critical"
      ? "Active"
      : severity === "High"
        ? "Investigating"
        : "Blocked";

  const eventTitle = formatEventTitle(raw.event_type, raw.description);
  const src = formatEventSource(raw.source);

  return {
    id: String(raw.id),
    time: timeFormatted,
    event: eventTitle,
    description: raw.description || raw.event_type || "Security Event",
    source: src,
    destination: ws ? `${ws.ip_address} (${ws.hostname})` : (raw.destination || "10.10.1.0/24"),
    severity,
    status,
    statusColor: status === "Blocked" ? "emerald" : severity === "Critical" ? "rose" : severity === "High" ? "amber" : "emerald",
    workstation_id: raw.workstation_id ? String(raw.workstation_id) : undefined,
    workstation_hostname: ws?.hostname || undefined,
    event_type: raw.event_type || undefined,
    raw_status: raw.status,
  };
}

export default function CybersecurityPage() {
  // Filters & Controls
  const [timeRange, setTimeRange] = useState("Last 24 Hours");
  const [searchQuery, setSearchQuery] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [eventPage, setEventPage] = useState(1);
  const [eventSeverityFilter, setEventSeverityFilter] = useState<"ALL" | "CRITICAL" | "HIGH" | "BLOCKED">("ALL");
  const EVENTS_PER_PAGE = 7;

  // Live state
  const [activeThreats, setActiveThreats] = useState<ActiveThreatItem[]>(MOCK_ACTIVE_THREATS);
  const [securityEvents, setSecurityEvents] = useState<SecurityEventItem[]>(MOCK_RECENT_SECURITY_EVENTS);
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [dashboardKpis, setDashboardKpis] = useState<DashboardKpis | null>(null);

  // Selected entities for modals
  const [selectedEvent, setSelectedEvent] = useState<SecurityEventItem | null>(null);
  const [selectedThreat, setSelectedThreat] = useState<ActiveThreatItem | null>(null);
  const [selectedVuln, setSelectedVuln] = useState<VulnerabilityItem | null>(null);
  const [showIsolationModal, setShowIsolationModal] = useState(false);
  const [isolationTargetId, setIsolationTargetId] = useState<string | null>(null);
  const [isolationTargetLabel, setIsolationTargetLabel] = useState<string>("");

  // Dynamic attack distribution computed from live security events & threats
  const attackDistributionData: DonutSegment[] = useMemo(() => {
    const counts: Record<string, number> = {
      "Malware / Mining": 0,
      DDoS: 0,
      "Brute Force": 0,
      Exploits: 0,
    };
    for (const e of securityEvents) {
      const evUpper = `${e.event_type || ""} ${e.event || ""} ${e.description || ""}`.toUpperCase();
      if (evUpper.includes("CRYPTO") || evUpper.includes("MINING") || evUpper.includes("MALWARE")) {
        counts["Malware / Mining"] += 1;
      } else if (evUpper.includes("DDOS") || evUpper.includes("FLOOD")) {
        counts.DDoS += 1;
      } else if (evUpper.includes("BRUTE") || evUpper.includes("UNAUTHORIZED") || evUpper.includes("LOGIN")) {
        counts["Brute Force"] += 1;
      } else {
        counts.Exploits += 1;
      }
    }
    for (const t of activeThreats) {
      if (t.category === "MALWARE") counts["Malware / Mining"] += 1;
      else if (t.category === "DDOS") counts.DDoS += 1;
      else if (t.category === "BRUTE_FORCE") counts["Brute Force"] += 1;
      else counts.Exploits += 1;
    }
    const hasData = Object.values(counts).some((v) => v > 0);
    if (!hasData) {
      return [
        { label: "Malware / Mining", value: 156, color: "#06b6d4" },
        { label: "DDoS", value: 93, color: "#3b82f6" },
        { label: "Brute Force", value: 41, color: "#f59e0b" },
        { label: "Exploits", value: 22, color: "#8b5cf6" },
      ];
    }
    return [
      { label: "Malware / Mining", value: counts["Malware / Mining"], color: "#06b6d4" },
      { label: "DDoS", value: counts.DDoS, color: "#3b82f6" },
      { label: "Brute Force", value: counts["Brute Force"], color: "#f59e0b" },
      { label: "Exploits", value: counts.Exploits, color: "#8b5cf6" },
    ];
  }, [activeThreats, securityEvents]);

  // Dynamic KPIs derived from live threat intelligence, SIEM events, and workstation status
  const currentKpi = useMemo(() => {
    const activeThreatsList = activeThreats.filter(
      (t) => t.status === "Active" || t.status === "Investigating"
    );
    const threatsCount = activeThreatsList.length;
    const highRiskCount = securityEvents.filter(
      (e) => e.severity === "Critical" || e.severity === "High"
    ).length;
    const blockedCount = activeThreats.filter((t) => t.status === "Blocked").length;

    // Unique affected devices
    const affectedIds = new Set<string>();
    for (const t of activeThreats) {
      if (t.workstation_id) affectedIds.add(t.workstation_id);
    }
    for (const e of securityEvents) {
      if (e.workstation_id) affectedIds.add(e.workstation_id);
    }
    const affectedCount = affectedIds.size > 0 ? affectedIds.size : threatsCount > 0 ? Math.min(threatsCount, 4) : 0;

    // Posture score from backend KPI or derived
    const posture = dashboardKpis?.security_posture !== undefined
      ? Math.round(dashboardKpis.security_posture)
      : Math.max(50, 100 - threatsCount * 10 - highRiskCount * 3);

    return {
      threats_detected: threatsCount > 0 ? String(threatsCount) : "0",
      threats_detected_change: threatsCount > 0 ? `Active: ${threatsCount}` : "All clear",
      high_risk_events: highRiskCount > 0 ? String(highRiskCount) : "0",
      high_risk_change: highRiskCount > 0 ? `${highRiskCount} alerts requiring action` : "Zero critical events",
      blocked_attacks: blockedCount > 0 ? String(blockedCount) : "0",
      blocked_attacks_change: `${blockedCount} neutralized`,
      affected_devices: String(affectedCount),
      affected_devices_change: affectedCount > 0 ? `${affectedCount} affected endpoints` : "All devices secure",
      security_score: posture,
      security_score_change: posture >= 85 ? "Optimal Resilience" : "Elevated Risk",
    };
  }, [activeThreats, securityEvents, dashboardKpis]);

  // Exact percentages and ranking for attack distribution
  const attackStats = useMemo(() => {
    const total = attackDistributionData.reduce((acc, curr) => acc + curr.value, 0);
    const list = attackDistributionData.map((item) => ({
      ...item,
      percentage: total > 0 ? ((item.value / total) * 100).toFixed(1) : "0.0",
    }));
    const sorted = [...list].sort((a, b) => b.value - a.value);
    const top = sorted[0] || { label: "Malware", percentage: "0.0" };
    return {
      total,
      list,
      top,
    };
  }, [attackDistributionData]);

  // Live Cybersecurity Data Ingestion with Dual-Mode Resilience
  const loadCyberData = async () => {
    try {
      const [incidentsRes, eventsRes, wsRes, kpisRes] = await Promise.allSettled([
        getIncidents({ limit: 50 }),
        getSecurityEvents({ limit: 50 }),
        getWorkstations({ pageSize: 100 }),
        getDashboardKpis(),
      ]);

      const wsList = wsRes.status === "fulfilled" && wsRes.value?.items ? wsRes.value.items : [];
      setWorkstations(wsList);
      const wsMap = new Map<string, Workstation>();
      for (const ws of wsList) {
        if (ws.id) wsMap.set(String(ws.id), ws);
      }

      if (kpisRes.status === "fulfilled" && kpisRes.value) {
        setDashboardKpis(kpisRes.value);
      }

      if (
        incidentsRes.status === "fulfilled" &&
        Array.isArray(incidentsRes.value) &&
        incidentsRes.value.length > 0
      ) {
        const secIncidents = incidentsRes.value.filter(
          (raw) => String(raw.category || "").toUpperCase() !== "MAINTENANCE"
        );
        if (secIncidents.length > 0) {
          const liveThreats = secIncidents.map((raw) => mapBackendIncidentToThreat(raw, wsMap));
          setActiveThreats(liveThreats);
        }
      }

      if (
        eventsRes.status === "fulfilled" &&
        Array.isArray(eventsRes.value) &&
        eventsRes.value.length > 0
      ) {
        const liveEvts = eventsRes.value.map((raw) => mapBackendSecurityEvent(raw, wsMap));
        setSecurityEvents(liveEvts);
      }
    } catch (err) {
      console.warn("Failed to load live cybersecurity telemetry:", err);
    }
  };

  useEffect(() => {
    loadCyberData();

    // Listen to Server-Sent Events (SSE) alerts/incidents updates in real-time with zero polling
    const handleUpdate = () => {
      loadCyberData();
    };
    window.addEventListener("alerts-updated", handleUpdate);
    return () => {
      window.removeEventListener("alerts-updated", handleUpdate);
    };
  }, []);

  // Filtered Events with Search and Severity quick-filters
  const filteredEvents = useMemo(() => {
    let list = securityEvents;

    if (eventSeverityFilter === "CRITICAL") {
      list = list.filter((e) => e.severity === "Critical");
    } else if (eventSeverityFilter === "HIGH") {
      list = list.filter((e) => e.severity === "High");
    } else if (eventSeverityFilter === "BLOCKED") {
      list = list.filter((e) => e.status === "Blocked");
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (e) =>
        e.event.toLowerCase().includes(q) ||
        e.source.toLowerCase().includes(q) ||
        e.destination.toLowerCase().includes(q) ||
        e.severity.toLowerCase().includes(q) ||
        (e.description && e.description.toLowerCase().includes(q))
    );
  }, [searchQuery, securityEvents, eventSeverityFilter]);

  const totalEventPages = Math.max(1, Math.ceil(filteredEvents.length / EVENTS_PER_PAGE));
  const paginatedEvents = useMemo(() => {
    const start = (eventPage - 1) * EVENTS_PER_PAGE;
    return filteredEvents.slice(start, start + EVENTS_PER_PAGE);
  }, [filteredEvents, eventPage]);

  const handleIsolateClick = (targetWsId?: string, displayLabel?: string) => {
    let resolvedId = targetWsId;
    let label = displayLabel || "Host Endpoint";

    // If ID is missing or invalid, resolve by label/hostname/IP in workstations
    if (!resolvedId || resolvedId.length < 20) {
      const matched = workstations.find(
        (w) =>
          w.hostname.toLowerCase() === (displayLabel || "").toLowerCase() ||
          w.ip_address === displayLabel
      );
      if (matched) {
        resolvedId = String(matched.id);
        label = `${matched.hostname} (${matched.ip_address})`;
      } else if (workstations.length > 0) {
        resolvedId = String(workstations[0].id);
        label = `${workstations[0].hostname} (${workstations[0].ip_address})`;
      }
    }

    setIsolationTargetId(resolvedId || null);
    setIsolationTargetLabel(label);
    setShowIsolationModal(true);
  };

  const handleConfirmIsolation = async () => {
    setShowIsolationModal(false);
    if (!isolationTargetId) {
      setFeedback("Error: Missing target workstation UUID for surgical isolation.");
      setTimeout(() => setFeedback(null), 4000);
      return;
    }

    setIsProcessingAction(true);
    try {
      await isolateWorkstation(isolationTargetId);
      setFeedback(`Surgical isolation executed for ${isolationTargetLabel}. Non-reboot kernel packet filtering active.`);
      window.dispatchEvent(new CustomEvent("alerts-updated", { detail: { action: "isolation_executed" } }));
      loadCyberData();
    } catch (err: any) {
      setFeedback(`Isolation error: ${err?.message || "Failed to execute surgical containment."}`);
    } finally {
      setIsProcessingAction(false);
      setTimeout(() => setFeedback(null), 6000);
    }
  };

  const handleRollbackIsolation = async (targetWsId: string, label: string) => {
    setIsProcessingAction(true);
    try {
      await rollbackWorkstationIsolation(targetWsId);
      setFeedback(`Surgical isolation rolled back for ${label}. Network connectivity restored to ONLINE.`);
      window.dispatchEvent(new CustomEvent("alerts-updated", { detail: { action: "isolation_rolled_back" } }));
      loadCyberData();
    } catch (err: any) {
      setFeedback(`Rollback error: ${err?.message || "Failed to rollback isolation."}`);
    } finally {
      setIsProcessingAction(false);
      setTimeout(() => setFeedback(null), 6000);
    }
  };

  const handleUpdateStatus = async (
    threatId: string,
    newStatus: "INVESTIGATING" | "CONTAINED" | "RESOLVED"
  ) => {
    setIsProcessingAction(true);
    try {
      await updateIncidentStatus(threatId, newStatus);
      const displayStatus =
        newStatus === "RESOLVED" || newStatus === "CONTAINED" ? "Blocked" : "Investigating";
      const displayColor =
        newStatus === "RESOLVED" || newStatus === "CONTAINED" ? "emerald" : "amber";

      setActiveThreats((prev) =>
        prev.map((t) =>
          t.id === threatId
            ? { ...t, status: displayStatus, statusColor: displayColor, raw_status: newStatus }
            : t
        )
      );

      if (selectedThreat && selectedThreat.id === threatId) {
        setSelectedThreat((prev) =>
          prev
            ? { ...prev, status: displayStatus, statusColor: displayColor, raw_status: newStatus }
            : null
        );
      }

      setFeedback(`Incident ${threatId} status transitioned to ${newStatus}.`);
      window.dispatchEvent(new CustomEvent("alerts-updated", { detail: { action: "incident_status_updated" } }));
    } catch (err: any) {
      setFeedback(`Status update error: ${err?.message || "Failed to update incident status."}`);
    } finally {
      setIsProcessingAction(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Feedback Toast Notification */}
      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-mono">{feedback}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Filter & Time Range Bar (Aligns with Mockup Header Controls) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search IP, domain, device..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setEventPage(1);
            }}
            className="w-full pl-10 pr-9 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setEventPage(1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          <div className="relative">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-xs text-slate-200 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option>Last 24 Hours</option>
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          <button
            onClick={() => {
              loadCyberData();
              setFeedback("Refreshed SIEM and live anomaly intelligence feeds.");
              setTimeout(() => setFeedback(null), 4000);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-xs font-medium text-slate-300 rounded-lg border border-slate-700/80 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Sync</span>
          </button>
        </div>
      </div>

      {/* Top 5 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Threats Detected */}
        <div className="glass-card p-4 flex flex-col justify-between relative overflow-hidden group hover:border-rose-500/40 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-medium text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
              {currentKpi.threats_detected_change}
            </span>
          </div>
          <div className="mt-3">
            <span className="text-xs text-slate-400 font-medium">Threats Detected</span>
            <div className="text-2xl font-bold font-mono text-white mt-0.5">
              {currentKpi.threats_detected}
            </div>
          </div>
          {/* Red Sparkline */}
          <div className="mt-2 h-7 w-full">
            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 24">
              <path
                d="M 0 18 Q 15 12, 30 16 T 60 8 T 85 14 T 100 6"
                fill="none"
                stroke="#f43f5e"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M 0 18 Q 15 12, 30 16 T 60 8 T 85 14 T 100 6 L 100 24 L 0 24 Z"
                fill="rgba(244, 63, 94, 0.1)"
              />
            </svg>
          </div>
        </div>

        {/* Card 2: High Risk Events */}
        <div className="glass-card p-4 flex flex-col justify-between relative overflow-hidden group hover:border-amber-500/40 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Target className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              {currentKpi.high_risk_change}
            </span>
          </div>
          <div className="mt-3">
            <span className="text-xs text-slate-400 font-medium">High Risk Events</span>
            <div className="text-2xl font-bold font-mono text-white mt-0.5">
              {currentKpi.high_risk_events}
            </div>
          </div>
          {/* Orange Sparkline */}
          <div className="mt-2 h-7 w-full">
            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 24">
              <path
                d="M 0 16 Q 20 8, 40 14 T 70 6 T 100 10"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M 0 16 Q 20 8, 40 14 T 70 6 T 100 10 L 100 24 L 0 24 Z"
                fill="rgba(245, 158, 11, 0.1)"
              />
            </svg>
          </div>
        </div>

        {/* Card 3: Blocked Attacks */}
        <div className="glass-card p-4 flex flex-col justify-between relative overflow-hidden group hover:border-emerald-500/40 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              {currentKpi.blocked_attacks_change}
            </span>
          </div>
          <div className="mt-3">
            <span className="text-xs text-slate-400 font-medium">Blocked Attacks</span>
            <div className="text-2xl font-bold font-mono text-white mt-0.5">
              {currentKpi.blocked_attacks}
            </div>
          </div>
          {/* Green Sparkline */}
          <div className="mt-2 h-7 w-full">
            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 24">
              <path
                d="M 0 20 Q 25 10, 50 16 T 80 8 T 100 4"
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M 0 20 Q 25 10, 50 16 T 80 8 T 100 4 L 100 24 L 0 24 Z"
                fill="rgba(16, 185, 129, 0.1)"
              />
            </svg>
          </div>
        </div>

        {/* Card 4: Affected Devices */}
        <div className="glass-card p-4 flex flex-col justify-between relative overflow-hidden group hover:border-purple-500/40 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Monitor className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-medium text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
              {currentKpi.affected_devices_change}
            </span>
          </div>
          <div className="mt-3">
            <span className="text-xs text-slate-400 font-medium">Affected Devices</span>
            <div className="text-2xl font-bold font-mono text-white mt-0.5">
              {currentKpi.affected_devices}
            </div>
          </div>
          {/* Purple Sparkline */}
          <div className="mt-2 h-7 w-full">
            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 24">
              <path
                d="M 0 14 Q 25 18, 50 10 T 75 12 T 100 6"
                fill="none"
                stroke="#a855f7"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M 0 14 Q 25 18, 50 10 T 75 12 T 100 6 L 100 24 L 0 24 Z"
                fill="rgba(168, 85, 247, 0.1)"
              />
            </svg>
          </div>
        </div>

        {/* Card 5: Security Score */}
        <div className="glass-card p-4 flex flex-col justify-between relative overflow-hidden group hover:border-blue-500/40 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <button
              onClick={() => {
                const el = document.getElementById("posture-card");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className="text-[11px] font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
            >
              View all <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="mt-3">
            <span className="text-xs text-slate-400 font-medium">Security Score</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-bold font-mono text-white">{currentKpi.security_score}</span>
              <span className="text-sm font-mono text-slate-400">/100</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1 mt-1">
              {currentKpi.security_score_change}
            </span>
          </div>
          {/* Blue Sparkline */}
          <div className="mt-2 h-7 w-full">
            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 24">
              <path
                d="M 0 16 Q 20 20, 45 12 T 75 8 T 100 4"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M 0 16 Q 20 20, 45 12 T 75 8 T 100 4 L 100 24 L 0 24 Z"
                fill="rgba(59, 130, 246, 0.1)"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Main SOC Dashboard Grid (12 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left / Center Column (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Top Row: Attack Types Distribution & Top Vulnerabilities (2-Column Subgrid) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Attack Types Distribution (Donut Chart) */}
            <div className="glass-card p-5 flex flex-col justify-between">
              <div className="pb-3 border-b border-slate-800">
                <h4 className="text-sm font-bold text-white tracking-tight">Attack Types Distribution</h4>
                <p className="text-[11px] text-slate-400">Classified by Model 02-B & Wazuh Rules</p>
              </div>

              {/* Center Donut Ring Graphic using DonutChart */}
              <div className="py-4 flex flex-col sm:flex-row items-center justify-center gap-6">
                <div className="flex items-center justify-center shrink-0">
                  <DonutChart
                    data={attackDistributionData}
                    size={140}
                    strokeWidth={14}
                    centerLabel={String(attackStats.total)}
                    centerSub="Total"
                    showLegend={false}
                  />
                </div>

                {/* Legend with exact stats */}
                <div className="space-y-2 text-xs w-full max-w-[170px]">
                  {attackStats.list.map((item) => (
                    <div
                      key={item.label}
                      onClick={() => {
                        setSearchQuery(item.label);
                        setEventPage(1);
                        setFeedback(`Filtered events for attack type ${item.label}`);
                        setTimeout(() => setFeedback(null), 3000);
                      }}
                      className="flex items-center justify-between cursor-pointer hover:bg-slate-800/40 px-1.5 py-0.5 rounded transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-slate-300 group-hover:text-white font-medium">{item.label}</span>
                      </div>
                      <span className="font-mono text-slate-400 text-[11px] group-hover:text-slate-200">
                        {item.percentage}% <span className="text-slate-500">({item.value})</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Top Incursion: {attackStats.top.label}</span>
                <span className="text-cyan-400 font-bold">{attackStats.top.percentage}% Dominance</span>
              </div>
            </div>

            {/* Top Vulnerabilities */}
            <div className="glass-card p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h4 className="text-sm font-bold text-white tracking-tight">Top Vulnerabilities</h4>
                    <p className="text-[11px] text-slate-400">CVE exposures identified on university hosts</p>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto my-3">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                        <th className="pb-2">Vulnerability</th>
                        <th className="pb-2">Severity</th>
                        <th className="pb-2 text-center">Affected Assets</th>
                        <th className="pb-2 text-right">CVSS Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {MOCK_TOP_VULNERABILITIES.map((vuln) => (
                        <tr
                          key={vuln.cve}
                          onClick={() => setSelectedVuln(vuln)}
                          className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                        >
                          <td className="py-2.5 font-bold text-blue-400 group-hover:text-blue-300 transition-colors">
                            {vuln.cve}
                          </td>
                          <td className="py-2.5">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                vuln.severity === "Critical"
                                  ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                  : vuln.severity === "High"
                                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                    : "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                              }`}
                            >
                              {vuln.severity}
                            </span>
                          </td>
                          <td className="py-2.5 text-center text-slate-300 font-bold">{vuln.affected_assets}</td>
                          <td className="py-2.5 text-right font-bold text-sm">
                            <span
                              className={
                                vuln.cvss_score >= 9.0
                                  ? "text-rose-400"
                                  : vuln.cvss_score >= 7.0
                                    ? "text-amber-400"
                                    : "text-yellow-400"
                              }
                            >
                              {vuln.cvss_score.toFixed(1)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <button
                  onClick={() => {
                    setFeedback("Displaying complete university CVE ledger.");
                    setTimeout(() => setFeedback(null), 3000);
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 transition-colors"
                >
                  View all vulnerabilities →
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Row: Recent Security Events (Full Width of col-span-8, Flex-1 to balance height) */}
          <div className="glass-card p-5 flex flex-col justify-between flex-1 min-h-[480px]" id="recent-events">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white tracking-tight">Recent Security Events</h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60">
                      {filteredEvents.length} Events
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">SIEM events correlated with telemetry</p>
                </div>

                {/* Severity & Status Quick Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto text-[11px]">
                  {(["ALL", "CRITICAL", "HIGH", "BLOCKED"] as const).map((sev) => {
                    const label =
                      sev === "ALL"
                        ? "All"
                        : sev === "CRITICAL"
                          ? "Critical"
                          : sev === "HIGH"
                            ? "High"
                            : "Blocked";
                    const isActive = eventSeverityFilter === sev;
                    return (
                      <button
                        key={sev}
                        onClick={() => {
                          setEventSeverityFilter(sev);
                          setEventPage(1);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                          isActive
                            ? "bg-blue-600/30 text-blue-300 border border-blue-500/50 shadow-sm"
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Table or Empty State */}
              {filteredEvents.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-3 shadow-inner">
                    <Search className="w-5 h-5 text-slate-400" />
                  </div>
                  <p className="text-sm font-semibold text-slate-200">No security events found</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">
                    {searchQuery
                      ? `No telemetry logs matched "${searchQuery}". Try searching a different IP or keyword.`
                      : "No active security events found for the selected filter."}
                  </p>
                  {(searchQuery || eventSeverityFilter !== "ALL") && (
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setEventSeverityFilter("ALL");
                        setEventPage(1);
                      }}
                      className="mt-3.5 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-medium transition-colors"
                    >
                      Reset active filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto my-3">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                        <th className="pb-2">Time</th>
                        <th className="pb-2">Event / Threat</th>
                        <th className="pb-2">Source</th>
                        <th className="pb-2">Destination</th>
                        <th className="pb-2">Severity</th>
                        <th className="pb-2">Status</th>
                        <th className="pb-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {paginatedEvents.map((evt) => (
                        <tr
                          key={evt.id}
                          onClick={() => setSelectedEvent(evt)}
                          className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                        >
                          <td className="py-3 text-[10px] text-slate-400 whitespace-nowrap">{evt.time}</td>
                          <td className="py-3 max-w-[200px]">
                            <div
                              className="font-sans font-semibold text-white group-hover:text-blue-400 transition-colors truncate text-xs"
                              title={evt.description || evt.event}
                            >
                              {evt.event}
                            </div>
                            {evt.description && evt.description !== evt.event && (
                              <div
                                className="text-[10px] text-slate-400 truncate max-w-[195px]"
                                title={evt.description}
                              >
                                {evt.description}
                              </div>
                            )}
                          </td>
                          <td className="py-3 text-[10px] text-cyan-400 font-mono whitespace-nowrap">
                            <span className="px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/40">
                              {evt.source}
                            </span>
                          </td>
                          <td className="py-3 text-[11px] text-slate-300 font-mono whitespace-nowrap">
                            {evt.workstation_hostname ? (
                              <div>
                                <span className="text-white font-medium block text-[11px] truncate max-w-[150px]">
                                  {evt.workstation_hostname}
                                </span>
                                <span className="text-[10px] text-slate-500 block">
                                  {evt.destination.split(" ")[0]}
                                </span>
                              </div>
                            ) : (
                              <span className="truncate max-w-[150px] block">{evt.destination}</span>
                            )}
                          </td>
                          <td className="py-3 whitespace-nowrap">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                evt.severity === "Critical"
                                  ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                  : evt.severity === "High"
                                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                    : evt.severity === "Medium"
                                      ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                                      : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                              }`}
                            >
                              {evt.severity}
                            </span>
                          </td>
                          <td className="py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] ${
                                evt.statusColor === "emerald"
                                  ? "text-emerald-400"
                                  : evt.statusColor === "rose"
                                    ? "text-rose-400"
                                    : evt.statusColor === "amber"
                                      ? "text-amber-400"
                                      : "text-blue-400"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  evt.statusColor === "emerald"
                                    ? "bg-emerald-400"
                                    : evt.statusColor === "rose"
                                      ? "bg-rose-400"
                                      : evt.statusColor === "amber"
                                        ? "bg-amber-400"
                                        : "bg-blue-400"
                                }`}
                              />
                              {evt.status}
                            </span>
                          </td>
                          <td className="py-3 text-right whitespace-nowrap">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEvent(evt);
                              }}
                              className="px-2 py-1 rounded bg-slate-800/80 hover:bg-blue-600/20 hover:text-blue-400 text-slate-400 border border-slate-700/60 hover:border-blue-500/40 text-[10px] font-mono transition-colors"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer with Pagination */}
            <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="text-slate-400 font-mono text-[11px]">
                Showing{" "}
                <strong className="text-white">
                  {filteredEvents.length === 0 ? 0 : (eventPage - 1) * EVENTS_PER_PAGE + 1}
                </strong>{" "}
                –{" "}
                <strong className="text-white">
                  {Math.min(filteredEvents.length, eventPage * EVENTS_PER_PAGE)}
                </strong>{" "}
                of <strong className="text-white">{filteredEvents.length}</strong> events
              </div>

              <div className="flex items-center gap-2">
                <button
                  disabled={eventPage <= 1}
                  onClick={() => setEventPage((p) => Math.max(1, p - 1))}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed text-xs transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>
                <span className="text-[11px] font-mono text-slate-400 px-1">
                  Page {eventPage} of {totalEventPages}
                </span>
                <button
                  disabled={eventPage >= totalEventPages}
                  onClick={() => setEventPage((p) => Math.min(totalEventPages, p + 1))}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed text-xs transition-colors"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column Stack (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Card 1: Active Threats */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="text-sm font-bold text-white tracking-tight">Active Threats</h4>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                {activeThreats.length} Active
              </span>
            </div>

            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {activeThreats.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedThreat(t)}
                  className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                          t.category === "MALWARE"
                            ? "bg-rose-500/15 text-rose-400"
                            : t.category === "DDOS"
                              ? "bg-amber-500/15 text-amber-400"
                              : t.category === "BRUTE_FORCE"
                                ? "bg-yellow-500/15 text-yellow-400"
                                : t.category === "SQLI"
                                  ? "bg-blue-500/15 text-blue-400"
                                  : "bg-purple-500/15 text-purple-400"
                        }`}
                      >
                        {t.category === "MALWARE" && <ShieldAlert className="w-4 h-4" />}
                        {t.category === "DDOS" && <Flame className="w-4 h-4" />}
                        {t.category === "BRUTE_FORCE" && <Lock className="w-4 h-4" />}
                        {t.category === "SQLI" && <Globe className="w-4 h-4" />}
                        {t.category === "SUSPICIOUS" && <Radio className="w-4 h-4" />}
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">
                          {t.title}
                        </h5>
                        <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{t.target_description}</p>
                        <p className="text-[10px] font-mono text-cyan-400 mt-1 flex items-center gap-1.5">
                          {t.workstation_hostname ? (
                            <>
                              <span className="text-white font-medium">{t.workstation_hostname}</span>
                              <span className="text-slate-500">•</span>
                              <span>{t.target_ip}</span>
                            </>
                          ) : (
                            <span>{t.target_ip}</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          t.risk === "Critical"
                            ? "bg-rose-500/20 text-rose-400"
                            : t.risk === "High Risk"
                              ? "bg-amber-500/20 text-amber-400"
                              : t.risk === "Medium"
                                ? "bg-yellow-500/20 text-yellow-400"
                                : "bg-blue-500/20 text-blue-400"
                        }`}
                      >
                        {t.risk}
                      </span>
                      <p className="text-[10px] text-slate-500 mt-1.5">{t.time_ago}</p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            t.statusColor === "emerald"
                              ? "bg-emerald-400"
                              : t.statusColor === "rose"
                                ? "bg-rose-400"
                                : t.statusColor === "amber"
                                  ? "bg-amber-400"
                                  : "bg-blue-400"
                          }`}
                        />
                        <span className="text-[9px] text-slate-400">{t.status}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card 2: Security Posture */}
          <div className="glass-card p-5 space-y-4 flex-1 flex flex-col justify-between" id="posture-card">
            <div>
              <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
                <h4 className="text-sm font-bold text-white tracking-tight">Security Posture</h4>
                <span
                  className={`text-xs font-mono font-bold ${
                    currentKpi.security_score >= 85
                      ? "text-emerald-400"
                      : currentKpi.security_score >= 70
                        ? "text-blue-400"
                        : "text-amber-400"
                  }`}
                >
                  {currentKpi.security_score >= 85
                    ? "Optimal"
                    : currentKpi.security_score >= 70
                      ? "Good"
                      : "Elevated Risk"}
                </span>
              </div>

              {/* Center Radial/Gauge Meter Graphic */}
              <div className="py-4 flex flex-col items-center justify-center">
                <div className="relative w-36 h-36 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="50" fill="transparent" stroke="#1e293b" strokeWidth="12" />
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      fill="transparent"
                      stroke={
                        currentKpi.security_score >= 85
                          ? "#10b981"
                          : currentKpi.security_score >= 70
                            ? "#3b82f6"
                            : "#f59e0b"
                      }
                      strokeWidth="12"
                      strokeDasharray={2 * Math.PI * 50}
                      strokeDashoffset={2 * Math.PI * 50 * (1 - currentKpi.security_score / 100)}
                      strokeLinecap="round"
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-bold font-mono text-white tracking-tight">
                      {currentKpi.security_score}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">/100</span>
                    <span
                      className={`text-[10px] font-semibold mt-0.5 ${
                        currentKpi.security_score >= 85
                          ? "text-emerald-400"
                          : currentKpi.security_score >= 70
                            ? "text-blue-400"
                            : "text-amber-400"
                      }`}
                    >
                      {currentKpi.security_score >= 85
                        ? "Optimal"
                        : currentKpi.security_score >= 70
                          ? "Good"
                          : "Elevated"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Security Dimensions Progress Bars */}
              <div className="space-y-2.5 pt-2">
                {MOCK_SECURITY_POSTURE_DIMENSIONS.map((dim) => (
                  <div key={dim.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-medium">{dim.name}</span>
                      <span className="font-mono text-slate-400 font-semibold">
                        {dim.score}/{dim.max}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${(dim.score / dim.max) * 100}%`,
                          backgroundColor: dim.colorHex,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: Security Event Inspector (SOAR & Wazuh Integration) */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-bold text-white">Security Event Telemetry</h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono">
                <div>
                  <span className="text-slate-500 text-[10px]">EVENT ID</span>
                  <p className="text-white font-bold">{selectedEvent.id}</p>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px]">TIME OCCURRED</span>
                  <p className="text-slate-300">{selectedEvent.time}</p>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px]">SOURCE IP / HOST</span>
                  <p className="text-cyan-400 font-bold">{selectedEvent.source}</p>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px]">TARGET DESTINATION</span>
                  <p className="text-amber-400 font-bold">{selectedEvent.destination}</p>
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Incident Classification:</span>
                  <span className="text-rose-400 font-bold">{selectedEvent.event}</span>
                </div>
                {selectedEvent.description && selectedEvent.description !== selectedEvent.event && (
                  <div className="text-[11px] text-slate-300 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80 leading-relaxed">
                    <span className="text-slate-500 block text-[10px] uppercase font-mono mb-1">Telemetry Evidence Description</span>
                    {selectedEvent.description}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Severity Level:</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    {selectedEvent.severity}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">SOAR Correlation Status:</span>
                  <span className="text-emerald-400 font-medium">{selectedEvent.status}</span>
                </div>
              </div>

              <div className="p-3 bg-blue-950/40 border border-blue-800/40 rounded-xl text-[11px] text-blue-200">
                <strong>SIEM/XDR Rule Verification:</strong> Correlated via{" "}
                <code>{selectedEvent.source}</code> (Type:{" "}
                <code>{selectedEvent.event_type || selectedEvent.event}</code>). Evaluated against{" "}
                <code>Model 02-B</code> (Windows-APT Specialist) and University IdP role context before SOAR dispatch.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium cursor-pointer"
              >
                Dismiss
              </button>
              {(() => {
                const targetWs = selectedEvent.workstation_id
                  ? workstations.find((w) => String(w.id) === selectedEvent.workstation_id)
                  : workstations.find(
                      (w) =>
                        w.hostname.toLowerCase() ===
                        (selectedEvent.workstation_hostname || "").toLowerCase()
                    );
                const isIsolated = targetWs?.status === "ISOLATED";
                const targetId = targetWs ? String(targetWs.id) : selectedEvent.workstation_id;
                const label = targetWs
                  ? `${targetWs.hostname} (${targetWs.ip_address})`
                  : selectedEvent.workstation_hostname || selectedEvent.destination;

                if (isIsolated && targetId) {
                  return (
                    <button
                      disabled={isProcessingAction}
                      onClick={() => {
                        setSelectedEvent(null);
                        handleRollbackIsolation(targetId, label);
                      }}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Rollback Isolation
                    </button>
                  );
                }

                return (
                  <button
                    disabled={isProcessingAction}
                    onClick={() => {
                      setSelectedEvent(null);
                      handleIsolateClick(targetId, label);
                    }}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Isolate Host Endpoint
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Active Threat Action & Containment Modal */}
      {selectedThreat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">{selectedThreat.title}</h3>
              </div>
              <button
                onClick={() => setSelectedThreat(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">CATEGORY</span>
                  <span className="text-white font-bold">{selectedThreat.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">TARGET</span>
                  <span className="text-cyan-400">
                    {selectedThreat.workstation_hostname
                      ? `${selectedThreat.workstation_hostname} (${selectedThreat.target_ip})`
                      : selectedThreat.target_ip}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">LIFECYCLE STATUS</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${selectedThreat.raw_status === "RESOLVED" ||
                      selectedThreat.raw_status === "CONTAINED" ||
                      selectedThreat.status === "Blocked"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : selectedThreat.raw_status === "INVESTIGATING" ||
                        selectedThreat.status === "Investigating"
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      }`}
                  >
                    {selectedThreat.raw_status || selectedThreat.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">RISK LEVEL</span>
                  <span className="text-rose-400 font-bold">{selectedThreat.risk}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">DISCOVERED</span>
                  <span className="text-slate-300">{selectedThreat.time_ago}</span>
                </div>
              </div>

              <p className="text-slate-300 leading-relaxed">{selectedThreat.target_description}</p>

              {/* Interactive Incident Status Controls */}
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2">
                <span className="text-slate-400 font-medium block">Transition Incident State:</span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    disabled={isProcessingAction || selectedThreat.raw_status === "INVESTIGATING"}
                    onClick={() => handleUpdateStatus(selectedThreat.id, "INVESTIGATING")}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold text-[11px] disabled:opacity-40 transition-colors"
                  >
                    Investigate
                  </button>
                  <button
                    disabled={isProcessingAction || selectedThreat.raw_status === "CONTAINED"}
                    onClick={() => handleUpdateStatus(selectedThreat.id, "CONTAINED")}
                    className="px-2.5 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 font-semibold text-[11px] disabled:opacity-40 transition-colors"
                  >
                    Mark Contained
                  </button>
                  <button
                    disabled={isProcessingAction || selectedThreat.raw_status === "RESOLVED"}
                    onClick={() => handleUpdateStatus(selectedThreat.id, "RESOLVED")}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold text-[11px] disabled:opacity-40 transition-colors"
                  >
                    Resolve Threat
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setSelectedThreat(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium"
              >
                Close
              </button>
              {(() => {
                const targetWs = selectedThreat.workstation_id
                  ? workstations.find((w) => String(w.id) === selectedThreat.workstation_id)
                  : workstations.find(
                    (w) =>
                      w.hostname.toLowerCase() ===
                      (selectedThreat.workstation_hostname || "").toLowerCase() ||
                      w.ip_address === selectedThreat.target_ip
                  );
                const isIsolated = targetWs?.status === "ISOLATED";
                const targetId = targetWs ? String(targetWs.id) : selectedThreat.workstation_id;
                const label = targetWs
                  ? `${targetWs.hostname} (${targetWs.ip_address})`
                  : selectedThreat.workstation_hostname || selectedThreat.target_ip;

                if (isIsolated && targetId) {
                  return (
                    <button
                      disabled={isProcessingAction}
                      onClick={() => {
                        setSelectedThreat(null);
                        handleRollbackIsolation(targetId, label);
                      }}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      Rollback Isolation
                    </button>
                  );
                }

                return (
                  <button
                    disabled={isProcessingAction}
                    onClick={() => {
                      setSelectedThreat(null);
                      handleIsolateClick(targetId, label);
                    }}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    Execute Surgical Containment
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Vulnerability Advisory Modal */}
      {selectedVuln && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">{selectedVuln.cve}</h3>
              </div>
              <button
                onClick={() => setSelectedVuln(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-500 text-[10px]">CVSS 3.1 BASE SCORE</span>
                  <div className="text-2xl font-bold font-mono text-rose-400">{selectedVuln.cvss_score}</div>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 text-[10px]">SEVERITY RATING</span>
                  <div className="text-sm font-bold text-rose-400">{selectedVuln.severity}</div>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 text-[10px]">AFFECTED HOSTS</span>
                  <div className="text-sm font-bold text-white font-mono">{selectedVuln.affected_assets} Devices</div>
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                <h5 className="font-bold text-white">Recommended Remediation:</h5>
                <p className="text-slate-300 leading-relaxed">
                  Update Apache HTTP Server to version 2.4.60 or later using the automated playbook. Restrict untrusted
                  proxy headers and verify reverse-proxy configurations.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setSelectedVuln(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setSelectedVuln(null);
                  setFeedback(`Scheduled automated patch playbook for ${selectedVuln.cve} across ${selectedVuln.affected_assets} affected devices.`);
                  setTimeout(() => setFeedback(null), 5000);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors"
              >
                Schedule Fleet Patch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Surgical Network Isolation Confirmation (Rule 19 & 20) */}
      {showIsolationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400 pb-3 border-b border-slate-800">
              <div className="p-2 rounded-xl bg-rose-500/20 border border-rose-500/30">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Confirm Surgical Isolation</h3>
                <p className="text-xs text-slate-400">Rule 19: Non-Reboot Network Packet Containment</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <p>
                You are executing surgical isolation for target{" "}
                <code className="text-rose-400 font-mono font-bold">
                  {isolationTargetLabel || "Selected Host"}
                </code>
                {isolationTargetId && (
                  <span className="block text-[10px] text-slate-500 font-mono mt-0.5">
                    UUID: {isolationTargetId}
                  </span>
                )}.
              </p>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Method:</span>
                  <span className="text-white">OS Kernel Packet Filter (iptables/WFP)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Host Reboot:</span>
                  <span className="text-emerald-400 font-bold">None (State Preserved)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Management Port:</span>
                  <span className="text-blue-400">Allowed (SSH/Agent Telemetry)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Audit Logging:</span>
                  <span className="text-white">Enabled (Admin Authorized)</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/50 text-amber-200 text-[11px]">
                <strong>Researcher Protection Notice:</strong> If this node belongs to an active research workload,
                in-memory experiment state will remain intact while untrusted network egress is severed.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowIsolationModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium"
              >
                Cancel
              </button>
              <button
                disabled={isProcessingAction}
                onClick={handleConfirmIsolation}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
              >
                {isProcessingAction ? "Executing..." : "Confirm Surgical Containment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
