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
  MoreVertical,
  PieChart,
  BarChart2,
  Clock,
  Shield,
  Info,
  RotateCw,
} from "lucide-react";
import { DonutChart, DonutSegment } from "@/components/charts/DonutChart";
import {
  getDashboardKpis,
  getWorkstations,
  getAlerts,
  getSecurityEvents,
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

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<Date>(new Date());

  const [selectedResource, setSelectedResource] = useState<"CPU" | "Memory" | "Disk">("CPU");

  // Dynamic live state from backend APIs
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
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);

  const isSyncingRef = useRef(false);
  const initialLoadedRef = useRef(false);

  const loadLiveData = async (isManual = false) => {
    // Prevent overlapping concurrent sync requests
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    if (isManual) setIsRefreshing(true);
    try {
      // Only fetch alerts and security events once on initial load or manual refresh.
      // Background interval only syncs KPIs and device telemetry, alerts are pushed in real time via SSE.
      const isInitialOrManual = isManual || !initialLoadedRef.current;
      initialLoadedRef.current = true;

      const [liveKpiRes, liveWsRes, liveAlertsRes, liveEventsRes] = await Promise.allSettled([
        getDashboardKpis(),
        getWorkstations({ pageSize: 50 }),
        isInitialOrManual ? getAlerts({ limit: 50 }) : Promise.resolve(null),
        isInitialOrManual ? getSecurityEvents({ limit: 50 }) : Promise.resolve(null),
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
      if (isInitialOrManual && liveEventsRes.status === "fulfilled" && Array.isArray(liveEventsRes.value)) {
        setSecurityEvents(liveEventsRes.value);
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
    // Initial load on mount
    loadLiveData(true);

    // Real-time alert stream updates (SSE via AlertContext)
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
            critical_workstations:
              (raw.severity || "").toUpperCase() === "CRITICAL"
                ? (prev.critical_workstations || 0) + 1
                : prev.critical_workstations,
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

    // Background telemetry polling every 30 seconds when active
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      loadLiveData(false);
    }, 30000);

    return () => {
      window.removeEventListener("alerts-updated", handleAlertsUpdated);
      clearInterval(interval);
    };
  }, []);

  // Compute dynamic derived metrics from live state
  const total = kpi.total_workstations || workstations.length;
  const healthyCount = kpi.online_workstations;
  const warningCount = kpi.warning_workstations;
  const criticalCount = kpi.critical_workstations;
  const isolatedCount =
    kpi.isolated_workstations ??
    workstations.filter((w) => w.is_isolated || w.status === "ISOLATED").length;
  const offlineCount = kpi.offline_workstations;
  const threatCount = kpi.active_threats;

  const healthyPct = total > 0 ? ((healthyCount / total) * 100).toFixed(1) : "0.0";
  const warningPct = total > 0 ? ((warningCount / total) * 100).toFixed(1) : "0.0";
  const criticalPct = total > 0 ? ((criticalCount / total) * 100).toFixed(1) : "0.0";
  const isolatedPct = total > 0 ? ((isolatedCount / total) * 100).toFixed(1) : "0.0";
  const offlinePct = total > 0 ? ((offlineCount / total) * 100).toFixed(1) : "0.0";

  // Top KPI metrics
  const kpiCards = [
    {
      title: "Total Devices",
      value: String(total),
      delta: `${workstations.length} visible in fleet`,
      deltaColor: "text-blue-400",
      icon: <Monitor className="w-5 h-5 text-blue-400" />,
      iconBg: "bg-blue-600/20 border-blue-500/30",
      href: "/devices",
    },
    {
      title: "Online Devices",
      value: String(healthyCount),
      delta: `${healthyPct}% of fleet`,
      deltaColor: "text-emerald-400",
      icon: <Activity className="w-5 h-5 text-emerald-400" />,
      iconBg: "bg-emerald-600/20 border-emerald-500/30",
      href: "/devices?status=ONLINE",
    },
    {
      title: "Warning Devices",
      value: String(warningCount),
      delta: `${warningPct}% of fleet`,
      deltaColor: "text-amber-400",
      icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
      iconBg: "bg-amber-600/20 border-amber-500/30",
      href: "/devices?status=WARNING",
    },
    {
      title: "Critical Devices",
      value: String(criticalCount),
      delta: `${criticalPct}% of fleet`,
      deltaColor: "text-rose-400",
      icon: <AlertCircle className="w-5 h-5 text-rose-400" />,
      iconBg: "bg-rose-600/20 border-rose-500/30",
      href: "/devices?status=CRITICAL",
    },
    {
      title: "Active Threats",
      value: String(threatCount),
      delta: `${isolatedCount} isolated • ${Math.round(kpi.system_resilience_score ?? kpi.security_posture ?? 100)}% posture`,
      deltaColor: "text-purple-400",
      icon: <ShieldAlert className="w-5 h-5 text-purple-400" />,
      iconBg: "bg-purple-600/20 border-purple-500/30",
      href: "/alerts",
    },
  ];

  // Devices health distribution for donut chart (all 5 operational states)
  const deviceStatus = [
    {
      label: "Online",
      count: healthyCount,
      percent: `${healthyPct}%`,
      color: "#10b981",
      bg: "bg-emerald-500",
      href: "/devices?status=ONLINE",
    },
    {
      label: "Warning",
      count: warningCount,
      percent: `${warningPct}%`,
      color: "#f59e0b",
      bg: "bg-amber-500",
      href: "/devices?status=WARNING",
    },
    {
      label: "Critical",
      count: criticalCount,
      percent: `${criticalPct}%`,
      color: "#ef4444",
      bg: "bg-rose-500",
      href: "/devices?status=CRITICAL",
    },
    {
      label: "Isolated (SOAR)",
      count: isolatedCount,
      percent: `${isolatedPct}%`,
      color: "#a855f7",
      bg: "bg-purple-500",
      href: "/devices?status=ISOLATED",
    },
    {
      label: "Offline",
      count: offlineCount,
      percent: `${offlinePct}%`,
      color: "#64748b",
      bg: "bg-slate-500",
      href: "/devices?status=OFFLINE",
    },
  ];

  const deviceStatusDonutData: DonutSegment[] = [
    { label: "Online", value: healthyCount || (total === 0 ? 1 : 0), color: "#10b981" },
    { label: "Warning", value: warningCount, color: "#f59e0b" },
    { label: "Critical", value: criticalCount, color: "#ef4444" },
    { label: "Isolated", value: isolatedCount, color: "#a855f7" },
    { label: "Offline", value: offlineCount, color: "#64748b" },
  ];

  // Alerts Summary rows strictly matching the 4 canonical AlertSeverity values (CRITICAL, HIGH, MEDIUM, LOW)
  const safeAlerts = Array.isArray(alerts) ? alerts : [];
  const criticalAlertsCount = safeAlerts.filter(
    (a) => (a.severity || "").toUpperCase() === "CRITICAL"
  ).length;
  const highAlertsCount = safeAlerts.filter(
    (a) => (a.severity || "").toUpperCase() === "HIGH"
  ).length;
  const mediumAlertsCount = safeAlerts.filter(
    (a) => (a.severity || "").toUpperCase() === "MEDIUM"
  ).length;
  const lowAlertsCount = safeAlerts.filter(
    (a) => (a.severity || "").toUpperCase() === "LOW"
  ).length;
  const totalAlertsCount = safeAlerts.length;

  const alertsSummary = [
    {
      title: "Critical",
      count: criticalAlertsCount,
      color: "text-rose-400",
      icon: <AlertCircle className="w-4 h-4 text-rose-400" />,
      href: "/alerts?severity=CRITICAL",
    },
    {
      title: "High",
      count: highAlertsCount,
      color: "text-orange-400",
      icon: <AlertTriangle className="w-4 h-4 text-orange-400" />,
      href: "/alerts?severity=HIGH",
    },
    {
      title: "Medium",
      count: mediumAlertsCount,
      color: "text-amber-300",
      icon: <AlertTriangle className="w-4 h-4 text-amber-300" />,
      href: "/alerts?severity=MEDIUM",
    },
    {
      title: "Low",
      count: lowAlertsCount,
      color: "text-cyan-400",
      icon: <Info className="w-4 h-4 text-cyan-400" />,
      href: "/alerts?severity=LOW",
    },
  ];

  // Recent Alerts list derived from live alerts (preserving canonical severities)
  const recentAlerts = useMemo(() => {
    if (!safeAlerts || safeAlerts.length === 0) {
      return [];
    }
    return safeAlerts.slice(0, 5).map((a: any) => {
      const sev = (a.severity || "MEDIUM").toUpperCase();
      const severity =
        sev === "CRITICAL"
          ? "Critical"
          : sev === "HIGH"
            ? "High"
            : sev === "LOW"
              ? "Low"
              : "Medium";
      const severityColor =
        severity === "Critical"
          ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
          : severity === "High"
            ? "bg-orange-500/15 text-orange-400 border-orange-500/30"
            : severity === "Medium"
              ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
              : "bg-cyan-500/15 text-cyan-400 border-cyan-500/30";

      const matchedWs = workstations.find(
        (w) => w.id === a.workstation_id || w.hostname === a.workstation_id
      );
      const deviceName = matchedWs?.hostname || a.workstation_hostname || a.device || "Fleet Node";
      const deviceId = matchedWs?.id || a.workstation_id || deviceName;

      return {
        id: String(a.id),
        severity,
        severityColor,
        title: a.title || "System Alert",
        description: a.description || "Alert registered in monitoring stream",
        deviceName,
        deviceId,
        time: formatRelativeTime(a.created_at || a.timestamp),
      };
    });
  }, [safeAlerts, workstations]);

  // Top Devices by Resource Usage (sorted dynamically from live workstations, showing real workstation status)
  const currentTopDevices = useMemo(() => {
    if (!workstations || workstations.length === 0) return [];

    const sorted = [...workstations].sort((a, b) => {
      if (selectedResource === "CPU") {
        return (b.cpu_usage ?? 0) - (a.cpu_usage ?? 0);
      } else if (selectedResource === "Memory") {
        return (b.memory_usage ?? 0) - (a.memory_usage ?? 0);
      } else {
        return (b.disk_usage ?? 0) - (a.disk_usage ?? 0);
      }
    });

    return sorted.slice(0, 5).map((w) => {
      const rawVal =
        (selectedResource === "CPU"
          ? w.cpu_usage
          : selectedResource === "Memory"
            ? w.memory_usage
            : w.disk_usage) ?? 0;
      const usage = Math.round(rawVal);
      const barColor =
        usage >= 80 ? "bg-rose-500" : usage >= 60 ? "bg-amber-500" : "bg-emerald-500";

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

      return {
        id: w.id,
        name: w.hostname,
        usage,
        barColor,
        status,
        statusDot,
      };
    });
  }, [workstations, selectedResource]);

  // System gauges values based on live KPI
  const liveAvgCpu = Math.round(kpi.average_cpu || 0);
  const liveAvgRam = Math.round(kpi.average_ram || 0);
  const liveAvgDisk = Math.round(kpi.average_disk || 0);

  // Security & SOAR Containment Summary values derived from live security events & workstations
  const safeEvents = Array.isArray(securityEvents) ? securityEvents : [];

  const malwareCount = safeEvents.filter(
    (e) =>
      (e.event_type || "").toUpperCase().includes("MALWARE") ||
      (e.event_type || "").toUpperCase().includes("CRYPTO") ||
      (e.description || "").toLowerCase().includes("cryptojack")
  ).length;

  const unauthorizedAccessCount = safeEvents.filter(
    (e) =>
      (e.event_type || "").toUpperCase().includes("PORT") ||
      (e.event_type || "").toUpperCase().includes("ACCESS") ||
      (e.event_type || "").toUpperCase().includes("AUTH") ||
      (e.event_type || "").toUpperCase().includes("PRIVILEGE")
  ).length;

  const securityPosturePct = Math.round(
    kpi.system_resilience_score ?? kpi.security_posture ?? 100
  );

  // Shimmer loading skeleton screen
  if (isLoadingInitial && !mounted) {
    return (
      <div className="space-y-6 font-sans animate-pulse">
        {/* Row 1: KPI Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="glass-card p-4 h-24 border-slate-800 bg-[#091124]/90 rounded-2xl" />
          ))}
        </div>

        {/* Row 2: Middle Section Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 glass-card p-5 h-64 border-slate-800 bg-[#091124]/90 rounded-2xl" />
          <div className="lg:col-span-4 glass-card p-5 h-64 border-slate-800 bg-[#091124]/90 rounded-2xl" />
          <div className="lg:col-span-3 glass-card p-5 h-64 border-slate-800 bg-[#091124]/90 rounded-2xl" />
        </div>

        {/* Row 3: Recent Alerts Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 glass-card p-5 h-72 border-slate-800 bg-[#091124]/90 rounded-2xl" />
          <div className="lg:col-span-5 glass-card p-5 h-72 border-slate-800 bg-[#091124]/90 rounded-2xl" />
        </div>

        {/* Row 4: Threat Summary Skeleton */}
        <div className="glass-card p-5 h-48 border-slate-800 bg-[#091124]/90 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Top Header Live Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-800/60">
        <div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time telemetry, anomaly classification, and SOAR automated response across campus fleet
          </p>
        </div>

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
            <RotateCw
              className={`w-3.5 h-3.5 text-slate-400 ${isRefreshing ? "animate-spin text-blue-400" : ""}`}
            />
            <span>{isRefreshing ? "Syncing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* Row 1: Top 5 Stat KPI Cards */}
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
              <h3 className="text-2xl font-bold text-white mt-1 font-sans tracking-tight">
                {card.value}
              </h3>
              <p className={`text-[11px] font-medium mt-1 ${card.deltaColor}`}>{card.delta}</p>
            </div>
            <div
              className={`w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0 ${card.iconBg}`}
            >
              {card.icon}
            </div>
          </Link>
        ))}
      </div>

      {/* Row 2: 3-Column Middle Section (System Overview, Devices Status Overview, Alerts Summary) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Col 1: System Overview (Radial Progress Gauges) */}
        <div className="lg:col-span-5 glass-card p-5 border-slate-800/80 bg-[#091124]/90 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-bold text-white tracking-tight">System Overview</h2>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
              Live Fleet Average
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-4 py-4 text-center">
            {/* CPU Gauge */}
            <div className="flex flex-col items-center">
              <span className="text-xs font-medium text-slate-400 mb-2">CPU Usage</span>
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" stroke="#1e293b" strokeWidth="8" fill="none" />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#3b82f6"
                    strokeWidth="8"
                    strokeDasharray="251.32"
                    strokeDashoffset={251.32 * (1 - liveAvgCpu / 100)}
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-sm sm:text-base font-bold text-white">
                    {liveAvgCpu}%
                  </span>
                  <span className="text-[9px] text-slate-400">Average</span>
                </div>
              </div>
              <span className="mt-2.5 text-[11px] text-blue-400 font-medium">
                {liveAvgCpu >= 80 ? "High Load" : liveAvgCpu >= 60 ? "Moderate" : "Normal"}
              </span>
              <span className="text-[9px] text-slate-500">Fleet telemetry</span>
            </div>

            {/* Memory Gauge */}
            <div className="flex flex-col items-center">
              <span className="text-xs font-medium text-slate-400 mb-2">Memory Usage</span>
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" stroke="#1e293b" strokeWidth="8" fill="none" />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#10b981"
                    strokeWidth="8"
                    strokeDasharray="251.32"
                    strokeDashoffset={251.32 * (1 - liveAvgRam / 100)}
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-sm sm:text-base font-bold text-white">
                    {liveAvgRam}%
                  </span>
                  <span className="text-[9px] text-slate-400">Average</span>
                </div>
              </div>
              <span className="mt-2.5 text-[11px] text-emerald-400 font-medium">
                {liveAvgRam >= 85 ? "High Load" : liveAvgRam >= 70 ? "Elevated" : "Healthy"}
              </span>
              <span className="text-[9px] text-slate-500">Fleet telemetry</span>
            </div>

            {/* Disk Gauge */}
            <div className="flex flex-col items-center">
              <span className="text-xs font-medium text-slate-400 mb-2">Disk Usage</span>
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" stroke="#1e293b" strokeWidth="8" fill="none" />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#8b5cf6"
                    strokeWidth="8"
                    strokeDasharray="251.32"
                    strokeDashoffset={251.32 * (1 - liveAvgDisk / 100)}
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-sm sm:text-base font-bold text-white">
                    {liveAvgDisk}%
                  </span>
                  <span className="text-[9px] text-slate-400">Average</span>
                </div>
              </div>
              <span className="mt-2.5 text-[11px] text-purple-400 font-medium">
                {liveAvgDisk >= 85 ? "Low Space" : liveAvgDisk >= 70 ? "Moderate" : "Ample Space"}
              </span>
              <span className="text-[9px] text-slate-500">Fleet telemetry</span>
            </div>
          </div>
        </div>

        {/* Col 2: Devices Status Overview (Donut Chart & Legend) */}
        <div className="lg:col-span-4 glass-card p-5 border-slate-800/80 bg-[#091124]/90 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-white tracking-tight">Devices Status Overview</h2>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 py-3">
            {/* Donut graphic using reusable DonutChart */}
            <div className="flex items-center justify-center flex-shrink-0">
              <DonutChart
                data={deviceStatusDonutData}
                size={135}
                strokeWidth={14}
                centerLabel={String(total)}
                centerSub="Total"
                showLegend={false}
              />
            </div>

            {/* Legend Breakdown */}
            <div className="space-y-1.5 flex-1 text-xs">
              {deviceStatus.map((item, idx) => (
                <Link
                  key={idx}
                  href={item.href}
                  className="flex items-center justify-between hover:bg-slate-800/40 p-1 rounded transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-sm ${item.bg}`} />
                    <span className="text-slate-300 font-medium group-hover:text-white">
                      {item.label}
                    </span>
                  </div>
                  <span className="text-slate-400 font-mono text-[11px] group-hover:text-slate-200">
                    {item.count} ({item.percent})
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div className="pt-2.5 border-t border-slate-800/80 flex items-center gap-1.5 text-[10px] text-slate-400">
            <Clock className="w-3 h-3 text-slate-500" />
            <span>Updated {formatRelativeTime(lastUpdatedTime)}</span>
          </div>
        </div>

        {/* Col 3: Alerts Summary Card (4 Canonical Severities: Critical, High, Medium, Low) */}
        <div className="lg:col-span-3 glass-card p-5 border-slate-800/80 bg-[#091124]/90 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <h2 className="text-sm font-bold text-white tracking-tight">Alerts by Severity</h2>
            <Link href="/alerts" className="text-xs text-blue-400 hover:text-blue-300 font-medium">
              View all ({totalAlertsCount})
            </Link>
          </div>

          <div className="divide-y divide-slate-800/60 my-1">
            {alertsSummary.map((alert, idx) => (
              <Link
                key={idx}
                href={alert.href}
                className="py-2.5 flex items-center justify-between hover:bg-slate-800/30 px-1 rounded-lg transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex-shrink-0">{alert.icon}</span>
                  <span className="text-xs font-medium text-slate-200 group-hover:text-white transition-colors">
                    {alert.title}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-white font-mono">
                  <span>{alert.count}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-colors" />
                </div>
              </Link>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Total Registered</span>
            <Link
              href="/alerts"
              className="font-mono font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              {totalAlertsCount} Alerts →
            </Link>
          </div>
        </div>
      </div>

      {/* Row 3: Recent Alerts Table & Top Devices by Resource Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Recent Alerts Table */}
        <div className="lg:col-span-7 glass-card p-5 border-slate-800/80 bg-[#091124]/90 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <AlertCircle className="w-3.5 h-3.5" />
              </div>
              <h2 className="text-sm font-bold text-white tracking-tight">Recent Alerts</h2>
            </div>
            <Link href="/alerts" className="text-xs text-blue-400 hover:text-blue-300 font-medium">
              View all ({alerts.length})
            </Link>
          </div>

          <div className="overflow-x-auto my-2">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[11px] text-slate-400 border-b border-slate-800/80 font-medium">
                  <th className="py-2.5 px-2 font-normal">Severity</th>
                  <th className="py-2.5 px-2 font-normal">Alert</th>
                  <th className="py-2.5 px-2 font-normal">Device</th>
                  <th className="py-2.5 px-2 font-normal">Time</th>
                  <th className="py-2.5 px-1 font-normal text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {recentAlerts.length > 0 ? (
                  recentAlerts.map((alert) => (
                    <tr key={alert.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-2 whitespace-nowrap">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${alert.severityColor}`}
                        >
                          {alert.severity}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <Link
                          href="/alerts"
                          className="font-semibold text-white tracking-tight hover:text-blue-400 transition-colors"
                        >
                          {alert.title}
                        </Link>
                        <div className="text-[11px] text-slate-400 line-clamp-1">
                          {alert.description}
                        </div>
                      </td>
                      <td className="py-3 px-2 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                        <Link
                          href={`/devices/${alert.deviceId}`}
                          className="hover:text-blue-400 hover:underline transition-colors"
                        >
                          {alert.deviceName}
                        </Link>
                      </td>
                      <td className="py-3 px-2 text-[11px] text-slate-400 whitespace-nowrap">
                        {alert.time}
                      </td>
                      <td className="py-3 px-1 text-right">
                        <Link
                          href="/alerts"
                          className="p-1 rounded text-slate-500 hover:text-slate-300 transition-colors inline-block"
                          title="View alert"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-slate-400">
                      No active alerts registered in database. All monitored endpoints operating normally.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Top Devices by Resource Usage */}
        <div className="lg:col-span-5 glass-card p-5 border-slate-800/80 bg-[#091124]/90 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-white tracking-tight">Top Devices by Resource Usage</h2>
            </div>
            <select
              value={selectedResource}
              onChange={(e) => setSelectedResource(e.target.value as "CPU" | "Memory" | "Disk")}
              className="text-[11px] bg-slate-900 border border-slate-700/80 text-slate-300 rounded-lg px-2.5 py-1 focus:outline-none focus:border-blue-500 cursor-pointer"
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
                  <th className="py-2.5 px-2 font-normal">Device</th>
                  <th className="py-2.5 px-2 font-normal">{selectedResource} Usage</th>
                  <th className="py-2.5 px-2 font-normal">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {currentTopDevices.length > 0 ? (
                  currentTopDevices.map((device) => (
                    <tr key={device.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-2 font-mono text-[11px] text-white whitespace-nowrap">
                        <Link
                          href={`/devices/${device.id}`}
                          className="flex items-center gap-2 hover:text-blue-400 hover:underline transition-colors"
                        >
                          <Monitor className="w-3.5 h-3.5 text-slate-400" />
                          <span>{device.name}</span>
                        </Link>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-3">
                          <div className="w-24 sm:w-32 h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${device.barColor}`}
                              style={{ width: `${Math.min(100, Math.max(5, device.usage))}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-mono text-slate-300 w-8">
                            {device.usage}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-2 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
                          <span className={`w-1.5 h-1.5 rounded-full ${device.statusDot}`} />
                          {device.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-xs text-slate-400">
                      No enrolled workstations reporting telemetry.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Row 4: Security & SOAR Containment Summary (Bottom Full-Width Card) */}
      <div className="glass-card p-5 border-slate-800/80 bg-[#091124]/90 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-bold text-white tracking-tight">
              Security &amp; SOAR Containment Summary
            </h2>
          </div>
          <Link
            href="/alerts"
            className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
          >
            <span>Open Incident &amp; Alert Triage</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
          <Link
            href="/alerts"
            className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/50 hover:border-rose-500/40 hover:bg-slate-800/40 transition-all group"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-400 group-hover:text-slate-200">
                Malware / Cryptojacking
              </p>
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-2xl font-bold text-white font-sans mt-1.5">{malwareCount}</p>
            <p className="text-[11px] font-medium text-rose-400 mt-1">
              {malwareCount > 0 ? `${malwareCount} signals detected` : "No active malware signals"}
            </p>
          </Link>

          <Link
            href="/alerts"
            className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/50 hover:border-amber-500/40 hover:bg-slate-800/40 transition-all group"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-400 group-hover:text-slate-200">
                Unauthorized Access Events
              </p>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-bold text-white font-sans mt-1.5">
              {unauthorizedAccessCount}
            </p>
            <p className="text-[11px] font-medium text-amber-400 mt-1">
              Auth, brute-force &amp; port probes
            </p>
          </Link>

          <Link
            href="/alerts"
            className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/50 hover:border-blue-500/40 hover:bg-slate-800/40 transition-all group"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-400 group-hover:text-slate-200">
                Total Security Events
              </p>
              <Shield className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-white font-sans mt-1.5">{safeEvents.length}</p>
            <p className="text-[11px] font-medium text-blue-400 mt-1">
              {threatCount} active incidents • {securityPosturePct}% posture
            </p>
          </Link>

          <Link
            href="/devices?status=ISOLATED"
            className="p-4 rounded-xl border border-purple-500/30 bg-purple-950/15 hover:border-purple-500/60 hover:bg-purple-950/25 transition-all group"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-purple-200 group-hover:text-white">
                Isolated Devices (SOAR)
              </p>
              <ShieldCheck className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-2xl font-bold text-white font-sans mt-1.5">{isolatedCount}</p>
            <p className="text-[11px] font-medium text-purple-300 mt-1">
              Host OS running • Sockets blocked →
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
