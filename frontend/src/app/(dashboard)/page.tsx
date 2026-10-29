"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  Monitor,
  Activity,
  AlertTriangle,
  AlertCircle,
  ShieldAlert,
  ShieldCheck,
  ChevronRight,
  Clock,
  Shield,
  Info,
  RotateCw,
  Zap,
} from "lucide-react";
import { DonutChart, DonutSegment } from "@/components/charts/DonutChart";
import {
  getDashboardKpis,
  getWorkstations,
  getAlerts,
} from "@/lib/api";
import { DashboardKpis, Workstation, Alert } from "@/types";

function formatRelativeTime(date?: string | Date): string {
  if (!date) return "Just now";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "Just now";
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 60) return `${Math.max(1, diffSec)}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function formatAlertSourceType(rawType?: string): { label: string; color: string } {
  const norm = (rawType || "TECHNICAL_ANOMALY").toUpperCase();
  if (norm.includes("CYBER") || norm.includes("MALWARE") || norm.includes("ATTACK")) {
    return {
      label: "Cyber Threat",
      color: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    };
  }
  if (norm.includes("MAINT") || norm.includes("PREDICTIVE")) {
    return {
      label: "Predictive Maint",
      color: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
    };
  }
  if (norm.includes("HUMAN") || norm.includes("APPROVAL")) {
    return {
      label: "Human Review",
      color: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    };
  }
  return {
    label: "Technical",
    color: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  };
}

function formatPlaybook(rawPlaybook?: string): { label: string; color: string } {
  const pb = (rawPlaybook || "").toUpperCase();
  if (pb.includes("03") || pb.includes("SURGICAL") || pb.includes("ISOLATION")) {
    return {
      label: "Surgical Isolation (PB-03)",
      color: "bg-purple-950/40 text-purple-300 border-purple-500/40",
    };
  }
  if (pb.includes("02") || pb.includes("CONTAINMENT") || pb.includes("PROCESS")) {
    return {
      label: "Process Containment (PB-02)",
      color: "bg-rose-950/40 text-rose-300 border-rose-500/40",
    };
  }
  if (pb.includes("04") || pb.includes("MAINTENANCE")) {
    return {
      label: "Maintenance Advisory (PB-04)",
      color: "bg-blue-950/40 text-blue-300 border-blue-500/40",
    };
  }
  if (pb.includes("01") || pb.includes("ALERT_ONLY")) {
    return {
      label: "Alert Notification (PB-01)",
      color: "bg-slate-900/60 text-slate-300 border-slate-700/50",
    };
  }
  if (pb) {
    const clean = pb.replace(/^PLAYBOOK_\d+_?/, "").replace(/_/g, " ").toLowerCase();
    const formatted = clean.charAt(0).toUpperCase() + clean.slice(1);
    return {
      label: formatted,
      color: "bg-cyan-950/40 text-cyan-300 border-cyan-500/40",
    };
  }
  return {
    label: "Autonomous Triage",
    color: "bg-emerald-950/40 text-emerald-300 border-emerald-500/40",
  };
}

function MiniGauge({
  label,
  value,
  strokeColor,
  statusLabel,
  statusColorClass,
}: {
  label: string;
  value: number;
  strokeColor: string;
  statusLabel: string;
  statusColorClass: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  const strokeDashoffset = 251.32 * (1 - clamped / 100);

  return (
    <div className="flex flex-col items-center">
      <span className="text-[11px] font-medium text-slate-400 mb-2">{label}</span>
      <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" stroke="#1e293b" strokeWidth="8" fill="none" />
          <circle
            cx="50"
            cy="50"
            r="40"
            stroke={strokeColor}
            strokeWidth="8"
            strokeDasharray="251.32"
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="none"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs sm:text-sm font-bold text-white">{clamped}%</span>
        </div>
      </div>
      <span className={`mt-2 text-[10px] font-medium ${statusColorClass}`}>{statusLabel}</span>
    </div>
  );
}

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<Date>(new Date());
  const [selectedResource, setSelectedResource] = useState<"CPU" | "Memory" | "Disk">("CPU");

  const [kpi, setKpi] = useState<DashboardKpis>({
    total_workstations: 0,
    online_workstations: 0,
    warning_workstations: 0,
    critical_workstations: 0,
    isolated_workstations: 0,
    offline_workstations: 0,
    active_threats: 0,
    active_alerts: 0,
    security_posture: 100.0,
    system_resilience_score: 100.0,
    average_cpu: 0,
    average_ram: 0,
    average_disk: 0,
  });
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const isSyncingRef = useRef(false);
  const initialLoadedRef = useRef(false);

  const loadLiveData = async (isManual = false) => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    if (isManual) setIsRefreshing(true);
    try {
      const isInitialOrManual = isManual || !initialLoadedRef.current;
      initialLoadedRef.current = true;

      const [liveKpiRes, liveWsRes, liveAlertsRes] = await Promise.allSettled([
        getDashboardKpis(),
        getWorkstations({ pageSize: 50 }),
        isInitialOrManual ? getAlerts({ limit: 50 }) : Promise.resolve(null),
      ]);

      if (liveKpiRes.status === "fulfilled" && liveKpiRes.value) {
        setKpi(liveKpiRes.value);
      }
      if (liveWsRes.status === "fulfilled" && liveWsRes.value?.items) {
        setWorkstations(liveWsRes.value.items);
      }
      if (isInitialOrManual && liveAlertsRes.status === "fulfilled" && Array.isArray(liveAlertsRes.value)) {
        setAlerts(liveAlertsRes.value);
      }

      setLastUpdatedTime(new Date());
    } catch (err) {
      console.error("Dashboard failed to sync live data:", err);
    } finally {
      setIsLoadingInitial(false);
      if (isManual) setIsRefreshing(false);
      isSyncingRef.current = false;
    }
  };

  useEffect(() => {
    setMounted(true);
    loadLiveData(true);

    const handleAlertsUpdated = (e: Event) => {
      const customEvent = e as CustomEvent;
      const detail = customEvent.detail;
      if (detail && detail.data) {
        const raw = detail.data;
        if (detail.event === "ALERT_CREATED") {
          setAlerts((prev) => [raw, ...prev.filter((a) => a.id !== raw.id)]);
          setKpi((prev) => ({
            ...prev,
            active_alerts: (prev.active_alerts || 0) + 1,
          }));
        } else if (detail.event === "ALERT_RESOLVED") {
          setAlerts((prev) =>
            prev.map((a) => (a.id === raw.id ? { ...a, status: "RESOLVED" } : a))
          );
          setKpi((prev) => ({
            ...prev,
            active_alerts: Math.max(0, (prev.active_alerts || 0) - 1),
          }));
        } else if (detail.event === "ALERT_ACKNOWLEDGED") {
          setAlerts((prev) =>
            prev.map((a) => (a.id === raw.id ? { ...a, status: "ACKNOWLEDGED" } : a))
          );
        }
      }
    };
    window.addEventListener("alerts-updated", handleAlertsUpdated);

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      loadLiveData(false);
    }, 30000);

    return () => {
      window.removeEventListener("alerts-updated", handleAlertsUpdated);
      clearInterval(interval);
    };
  }, []);

  const total = kpi.total_workstations || workstations.length;
  const healthyCount = kpi.online_workstations;
  const warningCount = kpi.warning_workstations;
  const criticalCount = kpi.critical_workstations;
  const isolatedCount =
    kpi.isolated_workstations ??
    workstations.filter((w) => w.is_isolated || w.status === "ISOLATED").length;
  const offlineCount = kpi.offline_workstations;

  const healthyPct = total > 0 ? ((healthyCount / total) * 100).toFixed(1) : "0.0";
  const warningPct = total > 0 ? ((warningCount / total) * 100).toFixed(1) : "0.0";
  const criticalPct = total > 0 ? ((criticalCount / total) * 100).toFixed(1) : "0.0";
  const isolatedPct = total > 0 ? ((isolatedCount / total) * 100).toFixed(1) : "0.0";
  const offlinePct = total > 0 ? ((offlineCount / total) * 100).toFixed(1) : "0.0";

  const isAlertActive = (a: any): boolean => {
    const st = String(a.status || "OPEN").toUpperCase();
    return st !== "RESOLVED";
  };

  const formatSeverityDelta = (active: number, resolved: number): string => {
    if (active > 0 && resolved > 0) return `${active} active · ${resolved} resolved`;
    if (active > 0) return `${active} active signals`;
    if (resolved > 0) return `0 active · ${resolved} resolved`;
    return "0 critical alerts";
  };

  const safeAlerts = Array.isArray(alerts) ? alerts : [];
  const activeAlertsCount = useMemo(() => ({
    ALL: safeAlerts.filter(isAlertActive).length,
    Critical: safeAlerts.filter((a) => (a.severity || "").toUpperCase() === "CRITICAL" && isAlertActive(a)).length,
    High: safeAlerts.filter((a) => (a.severity || "").toUpperCase() === "HIGH" && isAlertActive(a)).length,
    Medium: safeAlerts.filter((a) => (a.severity || "").toUpperCase() === "MEDIUM" && isAlertActive(a)).length,
    Low: safeAlerts.filter((a) => (a.severity || "").toUpperCase() === "LOW" && isAlertActive(a)).length,
  }), [safeAlerts]);

  const resolvedAlertsCount = useMemo(() => ({
    ALL: safeAlerts.filter((a) => !isAlertActive(a)).length,
    Critical: safeAlerts.filter((a) => (a.severity || "").toUpperCase() === "CRITICAL" && !isAlertActive(a)).length,
    High: safeAlerts.filter((a) => (a.severity || "").toUpperCase() === "HIGH" && !isAlertActive(a)).length,
    Medium: safeAlerts.filter((a) => (a.severity || "").toUpperCase() === "MEDIUM" && !isAlertActive(a)).length,
    Low: safeAlerts.filter((a) => (a.severity || "").toUpperCase() === "LOW" && !isAlertActive(a)).length,
  }), [safeAlerts]);

  const totalAlertsCount = safeAlerts.length;
  const securityPosturePct = Math.round(
    kpi.system_resilience_score ?? kpi.security_posture ?? 100
  );

  const kpiCards = [
    {
      title: "Total Workstations",
      value: String(total),
      delta: `${total} enrolled workstations`,
      deltaColor: "text-blue-400",
      icon: <Monitor className="w-5 h-5 text-blue-400" />,
      iconBg: "bg-blue-600/20 border-blue-500/30",
      href: "/devices",
    },
    {
      title: "Online & Healthy",
      value: String(healthyCount),
      delta: `${healthyPct}% normal operations`,
      deltaColor: "text-emerald-400",
      icon: <Activity className="w-5 h-5 text-emerald-400" />,
      iconBg: "bg-emerald-600/20 border-emerald-500/30",
      href: "/devices?status=ONLINE",
    },
    {
      title: "Surgically Isolated",
      value: String(isolatedCount),
      delta: isolatedCount > 0 ? "Contained by automated SOAR" : "0 contained endpoints",
      deltaColor: isolatedCount > 0 ? "text-purple-400" : "text-slate-400",
      icon: <ShieldCheck className="w-5 h-5 text-purple-400" />,
      iconBg: "bg-purple-600/20 border-purple-500/30",
      href: "/devices?status=ISOLATED",
    },
    {
      title: "Critical Alerts",
      value: String(activeAlertsCount.Critical),
      delta: formatSeverityDelta(activeAlertsCount.Critical, resolvedAlertsCount.Critical),
      deltaColor: activeAlertsCount.Critical > 0 ? "text-rose-400" : "text-emerald-400",
      icon: <AlertCircle className="w-5 h-5 text-rose-400" />,
      iconBg: "bg-rose-600/20 border-rose-500/30",
      href: "/alerts?severity=CRITICAL",
    },
    {
      title: "Resilience Posture",
      value: `${securityPosturePct}%`,
      delta: securityPosturePct >= 90 ? "Optimal security posture" : "Impacted by active threats",
      deltaColor: securityPosturePct >= 90 ? "text-emerald-400" : "text-amber-400",
      icon: <Shield className="w-5 h-5 text-cyan-400" />,
      iconBg: "bg-cyan-600/20 border-cyan-500/30",
      href: "/alerts",
    },
  ];

  const deviceStatus = [
    { label: "Online", count: healthyCount, percent: `${healthyPct}%`, color: "#10b981", bg: "bg-emerald-500", href: "/devices?status=ONLINE" },
    { label: "Warning", count: warningCount, percent: `${warningPct}%`, color: "#f59e0b", bg: "bg-amber-500", href: "/devices?status=WARNING" },
    { label: "Critical", count: criticalCount, percent: `${criticalPct}%`, color: "#ef4444", bg: "bg-rose-500", href: "/devices?status=CRITICAL" },
    { label: "Isolated (SOAR)", count: isolatedCount, percent: `${isolatedPct}%`, color: "#a855f7", bg: "bg-purple-500", href: "/devices?status=ISOLATED" },
    { label: "Offline", count: offlineCount, percent: `${offlinePct}%`, color: "#64748b", bg: "bg-slate-500", href: "/devices?status=OFFLINE" },
  ];

  const deviceStatusDonutData: DonutSegment[] = [
    { label: "Online", value: healthyCount || (total === 0 ? 1 : 0), color: "#10b981" },
    { label: "Warning", value: warningCount, color: "#f59e0b" },
    { label: "Critical", value: criticalCount, color: "#ef4444" },
    { label: "Isolated", value: isolatedCount, color: "#a855f7" },
    { label: "Offline", value: offlineCount, color: "#64748b" },
  ];

  const alertsSummary = [
    { title: "Critical", count: activeAlertsCount.Critical, resolvedCount: resolvedAlertsCount.Critical, color: "text-rose-400", icon: <AlertCircle className="w-4 h-4 text-rose-400" />, href: "/alerts?severity=CRITICAL" },
    { title: "High", count: activeAlertsCount.High, resolvedCount: resolvedAlertsCount.High, color: "text-orange-400", icon: <AlertTriangle className="w-4 h-4 text-orange-400" />, href: "/alerts?severity=HIGH" },
    { title: "Medium", count: activeAlertsCount.Medium, resolvedCount: resolvedAlertsCount.Medium, color: "text-amber-300", icon: <AlertTriangle className="w-4 h-4 text-amber-300" />, href: "/alerts?severity=MEDIUM" },
    { title: "Low", count: activeAlertsCount.Low, resolvedCount: resolvedAlertsCount.Low, color: "text-cyan-400", icon: <Info className="w-4 h-4 text-cyan-400" />, href: "/alerts?severity=LOW" },
  ];

  const recentAlerts = useMemo(() => {
    if (!safeAlerts || safeAlerts.length === 0) return [];
    return safeAlerts.slice(0, 6).map((a: any) => {
      const sev = (a.severity || "MEDIUM").toUpperCase();
      const severity = sev === "CRITICAL" ? "Critical" : sev === "HIGH" ? "High" : sev === "LOW" ? "Low" : "Medium";
      const severityColor =
        severity === "Critical"
          ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
          : severity === "High"
            ? "bg-orange-500/15 text-orange-400 border-orange-500/30"
            : severity === "Medium"
              ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
              : "bg-cyan-500/15 text-cyan-400 border-cyan-500/30";

      const sourceInfo = formatAlertSourceType(a.source_type || a.source);
      const playbookInfo = formatPlaybook(a.playbook_initiated || a.playbook_executed || a.playbook);

      const matchedWs = workstations.find(
        (w) => w.id === a.workstation_id || w.hostname === a.workstation_id
      );
      const deviceName = matchedWs?.hostname || a.workstation_hostname || a.device || "Workstation Node";
      const deviceId = matchedWs?.id || a.workstation_id || deviceName;

      return {
        id: String(a.id),
        severity,
        severityColor,
        sourceLabel: sourceInfo.label,
        sourceColor: sourceInfo.color,
        playbookLabel: playbookInfo.label,
        playbookColor: playbookInfo.color,
        title: a.title || "System Alert",
        description: a.description || "Alert registered in monitoring stream",
        deviceName,
        deviceId,
        time: formatRelativeTime(a.created_at || a.timestamp),
      };
    });
  }, [safeAlerts, workstations]);

  const currentTopDevices = useMemo(() => {
    if (!workstations || workstations.length === 0) return [];

    const sorted = [...workstations].sort((a, b) => {
      if (selectedResource === "CPU") return (b.cpu_usage ?? 0) - (a.cpu_usage ?? 0);
      if (selectedResource === "Memory") return (b.memory_usage ?? 0) - (a.memory_usage ?? 0);
      return (b.disk_usage ?? 0) - (a.disk_usage ?? 0);
    });

    return sorted.slice(0, 5).map((w) => {
      const rawVal =
        (selectedResource === "CPU"
          ? w.cpu_usage
          : selectedResource === "Memory"
            ? w.memory_usage
            : w.disk_usage) ?? 0;
      const usage = Math.round(rawVal);
      const barColor = usage >= 80 ? "bg-rose-500" : usage >= 60 ? "bg-amber-500" : "bg-emerald-500";

      const rawStatus = (w.status || "ONLINE").toUpperCase();
      const status =
        rawStatus === "ISOLATED"
          ? "Isolated"
          : rawStatus === "CRITICAL"
            ? "Critical"
            : rawStatus === "WARNING"
              ? "Warning"
              : rawStatus === "OFFLINE"
                ? "Offline"
                : "Online";
      const statusDot =
        rawStatus === "ISOLATED"
          ? "bg-purple-500"
          : rawStatus === "CRITICAL"
            ? "bg-rose-500"
            : rawStatus === "WARNING"
              ? "bg-amber-500"
              : rawStatus === "OFFLINE"
                ? "bg-slate-500"
                : "bg-emerald-500";

      return { id: w.id, name: w.hostname, usage, barColor, status, statusDot };
    });
  }, [workstations, selectedResource]);

  const liveAvgCpu = Math.round(kpi.average_cpu || 0);
  const liveAvgRam = Math.round(kpi.average_ram || 0);
  const liveAvgDisk = Math.round(kpi.average_disk || 0);

  if (isLoadingInitial && !mounted) {
    return (
      <div className="space-y-6 font-sans animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="glass-card p-4 h-24 border-slate-800 bg-[#091124]/90 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 glass-card p-5 h-64 border-slate-800 bg-[#091124]/90 rounded-2xl" />
          <div className="lg:col-span-4 glass-card p-5 h-64 border-slate-800 bg-[#091124]/90 rounded-2xl" />
          <div className="lg:col-span-4 glass-card p-5 h-64 border-slate-800 bg-[#091124]/90 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Live Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-800/60">
        <p className="text-xs text-slate-400">
          Real-time workstation telemetry, ML anomaly classification, and automated SOAR response across campus endpoints.
        </p>

        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/50 border border-emerald-500/30 px-2.5 py-1 rounded-xl flex items-center gap-1.5 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live Sync ({total} Enrolled)
          </span>

          <button
            type="button"
            onClick={() => loadLiveData(true)}
            disabled={isRefreshing}
            className="px-3 py-1 rounded-xl border border-slate-700/80 bg-slate-900/60 hover:bg-slate-800 text-xs font-medium text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 text-slate-400 ${isRefreshing ? "animate-spin text-blue-400" : ""}`} />
            <span>{isRefreshing ? "Syncing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* Row 1: Top 5 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpiCards.map((card, i) => (
          <Link
            key={i}
            href={card.href}
            className="glass-card p-4 flex items-center justify-between border-slate-800/80 bg-[#091124]/90 hover:border-slate-700 hover:scale-[1.01] transition-all shadow-lg group cursor-pointer"
          >
            <div>
              <p className="text-xs font-medium text-slate-400 tracking-wide group-hover:text-slate-300">
                {card.title}
              </p>
              <h3 className="text-2xl font-bold text-white mt-1 tracking-tight font-sans">
                {card.value}
              </h3>
              <p className={`text-[11px] font-medium mt-1 ${card.deltaColor}`}>{card.delta}</p>
            </div>
            <div className={`w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0 ${card.iconBg}`}>
              {card.icon}
            </div>
          </Link>
        ))}
      </div>

      {/* Section 1: Workstation Infrastructure & Telemetry */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-bold text-white tracking-tight">
              Workstation Infrastructure &amp; Live Telemetry
            </h2>
          </div>
          <Link
            href="/devices"
            className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 group"
          >
            <span>Workstation Inventory ({total})</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Col 1: Telemetry Gauges (CPU, Memory, Disk) */}
          <div className="lg:col-span-4 glass-card p-5 border-slate-800/80 bg-[#091124]/90 flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-bold text-white tracking-tight">System Telemetry Gauges</h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
                Live Average
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 py-4 text-center">
              <MiniGauge
                label="CPU"
                value={liveAvgCpu}
                strokeColor={liveAvgCpu >= 80 ? "#ef4444" : liveAvgCpu >= 60 ? "#f59e0b" : "#3b82f6"}
                statusLabel={liveAvgCpu >= 80 ? "High Load" : liveAvgCpu >= 60 ? "Moderate" : "Normal"}
                statusColorClass={liveAvgCpu >= 80 ? "text-rose-400" : liveAvgCpu >= 60 ? "text-amber-400" : "text-blue-400"}
              />
              <MiniGauge
                label="Memory"
                value={liveAvgRam}
                strokeColor="#10b981"
                statusLabel={liveAvgRam >= 85 ? "High Load" : liveAvgRam >= 70 ? "Elevated" : "Healthy"}
                statusColorClass="text-emerald-400"
              />
              <MiniGauge
                label="Disk"
                value={liveAvgDisk}
                strokeColor="#8b5cf6"
                statusLabel={liveAvgDisk >= 85 ? "Low Space" : liveAvgDisk >= 70 ? "Moderate" : "Healthy"}
                statusColorClass="text-purple-400"
              />
            </div>

            <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span>Telemetry Snapshot</span>
              <span className="font-mono text-slate-300">{workstations.length} Active Nodes</span>
            </div>
          </div>

          {/* Col 2: Workstations Operational Distribution */}
          <div className="lg:col-span-4 glass-card p-5 border-slate-800/80 bg-[#091124]/90 flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <h3 className="text-xs font-bold text-white tracking-tight">Devices Status Distribution</h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
                {total} Total
              </span>
            </div>

            <div className="flex items-center justify-between gap-4 py-3">
              <div className="flex items-center justify-center flex-shrink-0">
                <DonutChart
                  data={deviceStatusDonutData}
                  size={120}
                  strokeWidth={12}
                  centerLabel={String(total)}
                  centerSub="Total"
                  showLegend={false}
                />
              </div>

              <div className="space-y-1.5 flex-1 text-xs">
                {deviceStatus.filter((item) => item.count > 0).map((item, idx) => (
                  <Link
                    key={idx}
                    href={item.href}
                    className="flex items-center justify-between hover:bg-slate-800/40 p-1.5 rounded-lg transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${item.bg}`} />
                      <span className="text-slate-300 font-medium group-hover:text-white">
                        {item.label}
                      </span>
                    </div>
                    <span className="text-slate-300 font-mono text-[11px] group-hover:text-white font-semibold">
                      {item.count} ({item.percent})
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-500" />
                <span>Updated {formatRelativeTime(lastUpdatedTime)}</span>
              </div>
              <Link href="/devices" className="text-blue-400 hover:text-blue-300 font-medium">
                Manage Devices →
              </Link>
            </div>
          </div>

          {/* Col 3: Top Workstations by Resource Usage */}
          <div className="lg:col-span-4 glass-card p-5 border-slate-800/80 bg-[#091124]/90 shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <h3 className="text-xs font-bold text-white tracking-tight">Top Workstations by Resource</h3>
              <select
                value={selectedResource}
                onChange={(e) => setSelectedResource(e.target.value as "CPU" | "Memory" | "Disk")}
                className="text-[11px] bg-slate-900 border border-slate-700/80 text-slate-300 rounded-lg px-2 py-0.5 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="CPU">CPU</option>
                <option value="Memory">Memory</option>
                <option value="Disk">Disk</option>
              </select>
            </div>

            <div className="overflow-x-auto my-2">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="text-[11px] text-slate-400 border-b border-slate-800/80 font-medium">
                    <th className="py-2 px-1 font-normal">Device</th>
                    <th className="py-2 px-1 font-normal">{selectedResource}</th>
                    <th className="py-2 px-1 font-normal">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {currentTopDevices.length > 0 ? (
                    currentTopDevices.map((device) => (
                      <tr key={device.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-2 px-1 font-mono text-[11px] text-white whitespace-nowrap">
                          <Link
                            href={`/devices/${device.id}`}
                            className="flex items-center gap-1.5 hover:text-blue-400 hover:underline transition-colors"
                          >
                            <Monitor className="w-3.5 h-3.5 text-slate-400" />
                            <span>{device.name}</span>
                          </Link>
                        </td>
                        <td className="py-2 px-1">
                          <div className="flex items-center gap-2">
                            <div className="w-16 sm:w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${device.barColor}`}
                                style={{ width: `${Math.min(100, Math.max(5, device.usage))}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-mono text-slate-300">{device.usage}%</span>
                          </div>
                        </td>
                        <td className="py-2 px-1 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-300">
                            <span className={`w-1.5 h-1.5 rounded-full ${device.statusDot}`} />
                            {device.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-xs text-slate-400">
                        No enrolled workstations reporting telemetry.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span>Telemetry Ranking</span>
              <span className="font-mono text-slate-300">Ranked by {selectedResource}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Security Incidents & SOAR Automated Response */}
      <div className="space-y-3 pt-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-bold text-white tracking-tight">
              Security Incidents &amp; SOAR Response
            </h2>
          </div>
          <Link
            href="/alerts"
            className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 group"
          >
            <span>All Incidents &amp; Alerts ({totalAlertsCount})</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Col 1: Alerts by Severity */}
          <div className="lg:col-span-4 glass-card p-5 border-slate-800/80 bg-[#091124]/90 flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <h3 className="text-xs font-bold text-white tracking-tight">Alerts by Severity</h3>
              <Link href="/alerts" className="text-xs text-blue-400 hover:text-blue-300 font-medium">
                View all ({totalAlertsCount})
              </Link>
            </div>

            <div className="divide-y divide-slate-800/60 my-2">
              {alertsSummary.map((alert, idx) => (
                <Link
                  key={idx}
                  href={alert.href}
                  className="py-2.5 flex items-center justify-between hover:bg-slate-800/30 px-2 rounded-lg transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex-shrink-0">{alert.icon}</span>
                    <span className="text-xs font-medium text-slate-200 group-hover:text-white transition-colors">
                      {alert.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white font-mono">
                    <span className={alert.count > 0 ? alert.color : "text-slate-400"}>
                      {alert.count}
                    </span>
                    {alert.resolvedCount > 0 && (
                      <span className="text-[10px] text-slate-500 font-normal">
                        ({alert.resolvedCount} res)
                      </span>
                    )}
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>

            <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Active vs Total</span>
              <Link
                href="/alerts"
                className="font-mono font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                {activeAlertsCount.ALL} Active ({totalAlertsCount} Total) →
              </Link>
            </div>
          </div>

          {/* Col 2: Recent Alerts & SOAR Execution Table */}
          <div className="lg:col-span-8 glass-card p-5 border-slate-800/80 bg-[#091124]/90 shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <AlertCircle className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-xs font-bold text-white tracking-tight">
                  Recent Alerts &amp; Autonomous SOAR Playbooks
                </h3>
              </div>
              <Link href="/alerts" className="text-xs text-blue-400 hover:text-blue-300 font-medium">
                View stream ({alerts.length})
              </Link>
            </div>

            <div className="overflow-x-auto my-2">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[11px] text-slate-400 border-b border-slate-800/80 font-medium">
                    <th className="py-2 px-2 font-normal">Severity</th>
                    <th className="py-2 px-2 font-normal">Source</th>
                    <th className="py-2 px-2 font-normal">Alert Details</th>
                    <th className="py-2 px-2 font-normal">Device</th>
                    <th className="py-2 px-2 font-normal">SOAR Playbook</th>
                    <th className="py-2 px-2 font-normal">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {recentAlerts.length > 0 ? (
                    recentAlerts.map((alert) => (
                      <tr key={alert.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-2.5 px-2 whitespace-nowrap">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${alert.severityColor}`}>
                            {alert.severity}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 whitespace-nowrap">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${alert.sourceColor}`}>
                            {alert.sourceLabel}
                          </span>
                        </td>
                        <td className="py-2.5 px-2">
                          <Link
                            href="/alerts"
                            className="font-semibold text-white tracking-tight hover:text-blue-400 transition-colors block"
                          >
                            {alert.title}
                          </Link>
                          <div className="text-[11px] text-slate-400 line-clamp-1">
                            {alert.description}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                          <Link
                            href={`/devices/${alert.deviceId}`}
                            className="hover:text-blue-400 hover:underline transition-colors"
                          >
                            {alert.deviceName}
                          </Link>
                        </td>
                        <td className="py-2.5 px-2 whitespace-nowrap">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md border inline-flex items-center gap-1 ${alert.playbookColor}`}>
                            <Zap className="w-2.5 h-2.5" />
                            <span>{alert.playbookLabel}</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-[11px] text-slate-400 whitespace-nowrap">
                          {alert.time}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-slate-400">
                        No active alerts registered in database. All monitored endpoints operating normally.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span>Automated SOAR Triage</span>
              <Link href="/alerts" className="text-blue-400 hover:text-blue-300 font-medium">
                Open Full Alert Operations Center →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
