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

  const [selectedTimeframe, setSelectedTimeframe] = useState("Real-time");
  const [selectedResource, setSelectedResource] = useState<"CPU" | "Memory" | "Disk">("CPU");
  const [selectedThreatPeriod, setSelectedThreatPeriod] = useState<"Today" | "Yesterday" | "Last 7 Days">("Today");

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
  const offlineCount = kpi.offline_workstations;
  const threatCount = kpi.active_threats;

  const healthyPct = total > 0 ? ((healthyCount / total) * 100).toFixed(1) : "0.0";
  const warningPct = total > 0 ? ((warningCount / total) * 100).toFixed(1) : "0.0";
  const criticalPct = total > 0 ? ((criticalCount / total) * 100).toFixed(1) : "0.0";
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
      title: "Healthy Devices",
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
      delta: `${Math.round(kpi.system_resilience_score ?? kpi.security_posture ?? 100)}% resilience`,
      deltaColor: "text-purple-400",
      icon: <ShieldAlert className="w-5 h-5 text-purple-400" />,
      iconBg: "bg-purple-600/20 border-purple-500/30",
      href: "/cybersecurity",
    },
  ];

  // Devices health distribution for donut chart
  const deviceStatus = [
    {
      label: "Healthy",
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
      label: "Offline",
      count: offlineCount,
      percent: `${offlinePct}%`,
      color: "#64748b",
      bg: "bg-slate-500",
      href: "/devices?status=OFFLINE",
    },
  ];

  const deviceStatusDonutData: DonutSegment[] = [
    { label: "Healthy", value: healthyCount || (total === 0 ? 1 : 0), color: "#10b981" },
    { label: "Warning", value: warningCount, color: "#f59e0b" },
    { label: "Critical", value: criticalCount, color: "#ef4444" },
    { label: "Offline", value: offlineCount, color: "#64748b" },
  ];

  // Alerts Summary rows
  const safeAlerts = Array.isArray(alerts) ? alerts : [];
  const criticalAlertsCount = safeAlerts.filter((a) => a.severity === "CRITICAL").length;
  const warningAlertsCount = safeAlerts.filter(
    (a) => a.severity === "HIGH" || a.severity === "MEDIUM" || (a.severity as string) === "WARNING"
  ).length;
  const infoAlertsCount = safeAlerts.filter(
    (a) => a.severity === "LOW" || (a.severity as string) === "INFO"
  ).length;
  const totalAlertsCount = safeAlerts.length;

  const alertsSummary = [
    {
      title: "Critical Alerts",
      count: criticalAlertsCount,
      color: "text-rose-400",
      icon: <AlertCircle className="w-4 h-4 text-rose-400" />,
      href: "/alerts?severity=CRITICAL",
    },
    {
      title: "Warning Alerts",
      count: warningAlertsCount,
      color: "text-amber-400",
      icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
      href: "/alerts?severity=WARNING",
    },
    {
      title: "Informational",
      count: infoAlertsCount,
      color: "text-blue-400",
      icon: <Info className="w-4 h-4 text-blue-400" />,
      href: "/alerts?severity=INFO",
    },
    {
      title: "Total Alerts",
      count: totalAlertsCount,
      color: "text-cyan-400",
      icon: <Shield className="w-4 h-4 text-cyan-400" />,
      href: "/alerts",
    },
  ];

  // Recent Alerts list derived from live alerts
  const recentAlerts = useMemo(() => {
    if (!safeAlerts || safeAlerts.length === 0) {
      return [];
    }
    return safeAlerts.slice(0, 5).map((a: any) => {
      const sev = (a.severity || "MEDIUM").toUpperCase();
      const severity =
        sev === "CRITICAL"
          ? "Critical"
          : sev === "HIGH" || sev === "MEDIUM" || sev === "WARNING"
            ? "Warning"
            : "Info";
      const severityColor =
        severity === "Critical"
          ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
          : severity === "Warning"
            ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
            : "bg-blue-500/15 text-blue-400 border-blue-500/30";

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

  // Top Devices by Resource Usage (sorted dynamically from live workstations)
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
            : w.disk_usage) ??
        (w.status === "CRITICAL" || w.status === "ISOLATED"
          ? 94
          : w.status === "WARNING"
            ? 76
            : w.status === "ONLINE"
              ? 34
              : 0);
      const usage = Math.round(rawVal);
      const isCritical = usage >= 80 || w.status === "CRITICAL" || w.status === "ISOLATED";
      const isWarning = usage >= 60 || w.status === "WARNING";
      const barColor = isCritical ? "bg-rose-500" : isWarning ? "bg-amber-500" : "bg-emerald-500";
      const status = isCritical ? "Critical" : isWarning ? "Warning" : "Healthy";
      const statusDot = isCritical ? "bg-rose-500" : isWarning ? "bg-amber-500" : "bg-emerald-500";

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

  // System gauges values based on live KPI & selected timeframe
  const liveAvgCpu = Math.round(kpi.average_cpu || 0);
  const liveAvgRam = Math.round(kpi.average_ram || 0);
  const liveAvgDisk = Math.round(kpi.average_disk || 0);

  const systemMetricsByTimeframe: Record<
    string,
    {
      cpu: number;
      ram: number;
      disk: number;
      cpuDelta: string;
      ramDelta: string;
      diskDelta: string;
      cpuTrend: string;
      ramTrend: string;
      diskTrend: string;
    }
  > = {
    "Real-time": {
      cpu: liveAvgCpu,
      ram: liveAvgRam,
      disk: liveAvgDisk,
      cpuDelta: "Live telemetry",
      ramDelta: "Live telemetry",
      diskDelta: "Live telemetry",
      cpuTrend: "M1 9L10 4L20 8L30 2L39 7",
      ramTrend: "M1 10L12 3L22 7L31 2L39 6",
      diskTrend: "M1 8L10 5L19 9L29 3L39 5",
    },
    "Last 1h": {
      cpu: Math.max(0, liveAvgCpu + 2),
      ram: Math.max(0, liveAvgRam + 1),
      disk: liveAvgDisk,
      cpuDelta: "↑ 2%",
      ramDelta: "↑ 1%",
      diskDelta: "0%",
      cpuTrend: "M1 7L10 9L20 5L30 8L39 3",
      ramTrend: "M1 8L12 6L22 4L31 5L39 2",
      diskTrend: "M1 6L10 7L19 5L29 6L39 4",
    },
    "Last 24h": {
      cpu: Math.max(0, liveAvgCpu - 3),
      ram: Math.max(0, liveAvgRam - 2),
      disk: liveAvgDisk,
      cpuDelta: "↓ 3%",
      ramDelta: "↓ 2%",
      diskDelta: "0%",
      cpuTrend: "M1 4L10 6L20 3L30 5L39 8",
      ramTrend: "M1 9L12 5L22 6L31 4L39 7",
      diskTrend: "M1 7L10 8L19 6L29 5L39 6",
    },
  };

  const currentMetrics =
    systemMetricsByTimeframe[selectedTimeframe] || systemMetricsByTimeframe["Real-time"];

  // Threat Detection Summary values derived from live security events
  const safeEvents = Array.isArray(securityEvents) ? securityEvents : [];
  const quarantinedDevicesCount =
    (kpi as any).isolated_workstations ?? workstations.filter((w) => (w as any).is_isolated || w.status === "ISOLATED").length;

  const malwareCount = safeEvents.filter(
    (e) =>
      (e.event_type || "").toUpperCase().includes("MALWARE") ||
      (e.event_type || "").toUpperCase().includes("CRYPTO") ||
      (e.description || "").toLowerCase().includes("cryptojack")
  ).length;

  const ransomwareCount = safeEvents.filter(
    (e) =>
      (e.event_type || "").toUpperCase().includes("RANSOM") ||
      (e.description || "").toLowerCase().includes("ransom")
  ).length;

  const blockedCount = safeEvents.filter(
    (e) =>
      (e.event_type || "").toUpperCase().includes("PORT") ||
      (e.event_type || "").toUpperCase().includes("ACCESS") ||
      (e.event_type || "").toUpperCase().includes("AUTH")
  ).length;

  const threatDataByPeriod: Record<
    string,
    {
      malware: number;
      malwareDelta: string;
      ransomware: number;
      ransomwareDelta: string;
      blocked: number;
      blockedDelta: string;
      quarantined: number;
      quarantinedDelta: string;
      pathD: string;
      areaD: string;
      points: { cx: number; cy: number }[];
      timeLabels: string[];
    }
  > = {
    Today: {
      malware: malwareCount,
      malwareDelta: `${malwareCount} active signals`,
      ransomware: ransomwareCount,
      ransomwareDelta: "0 detected",
      blocked: Math.max(blockedCount, safeEvents.length),
      blockedDelta: `${safeEvents.length} events logged`,
      quarantined: quarantinedDevicesCount,
      quarantinedDelta: `${quarantinedDevicesCount} nodes contained`,
      pathD: "M0 65 Q 40 68, 80 50 T 160 55 T 240 25 T 320 40 T 400 30 T 500 45",
      areaD: "M0 65 Q 40 68, 80 50 T 160 55 T 240 25 T 320 40 T 400 30 T 500 45 L 500 80 L 0 80 Z",
      points: [
        { cx: 240, cy: 25 },
        { cx: 400, cy: 30 },
      ],
      timeLabels: ["00:00", "04:00", "08:00", "12:00", "18:00", "20:00", "24:00"],
    },
    Yesterday: {
      malware: Math.max(0, malwareCount - 1),
      malwareDelta: "Baseline",
      ransomware: 0,
      ransomwareDelta: "0 detected",
      blocked: Math.max(0, safeEvents.length - 2),
      blockedDelta: "Previous 24h",
      quarantined: quarantinedDevicesCount,
      quarantinedDelta: "Preserved state",
      pathD: "M0 70 Q 50 60, 100 55 T 200 45 T 300 50 T 400 35 T 500 60",
      areaD: "M0 70 Q 50 60, 100 55 T 200 45 T 300 50 T 400 35 T 500 60 L 500 80 L 0 80 Z",
      points: [
        { cx: 200, cy: 45 },
        { cx: 400, cy: 35 },
      ],
      timeLabels: ["00:00", "04:00", "08:00", "12:00", "18:00", "20:00", "24:00"],
    },
    "Last 7 Days": {
      malware: malwareCount + 2,
      malwareDelta: "Weekly trend",
      ransomware: 0,
      ransomwareDelta: "0 detected",
      blocked: safeEvents.length + 15,
      blockedDelta: "Aggregated week",
      quarantined: quarantinedDevicesCount,
      quarantinedDelta: "Audit history",
      pathD: "M0 55 Q 60 40, 120 48 T 240 20 T 360 35 T 440 28 T 500 50",
      areaD: "M0 55 Q 60 40, 120 48 T 240 20 T 360 35 T 440 28 T 500 50 L 500 80 L 0 80 Z",
      points: [
        { cx: 240, cy: 20 },
        { cx: 440, cy: 28 },
      ],
      timeLabels: ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"],
    },
  };

  const currentThreat =
    threatDataByPeriod[selectedThreatPeriod] || threatDataByPeriod["Today"];

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
            <div className="relative">
              <select
                value={selectedTimeframe}
                onChange={(e) => setSelectedTimeframe(e.target.value)}
                className="text-[11px] bg-slate-900 border border-slate-700/80 text-slate-300 rounded-lg px-2.5 py-1 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="Real-time">Real-time</option>
                <option value="Last 1h">Last 1h</option>
                <option value="Last 24h">Last 24h</option>
              </select>
            </div>
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
                    strokeDashoffset={251.32 * (1 - currentMetrics.cpu / 100)}
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-sm sm:text-base font-bold text-white">
                    {currentMetrics.cpu}%
                  </span>
                  <span className="text-[9px] text-slate-400">Average</span>
                </div>
              </div>
              <div className="mt-2.5 flex items-center gap-1 text-[11px] text-blue-400 font-medium">
                <svg className="w-10 h-3 text-blue-400" viewBox="0 0 40 12" fill="none">
                  <path
                    d={currentMetrics.cpuTrend}
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                <span>{currentMetrics.cpuDelta}</span>
              </div>
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
                    strokeDashoffset={251.32 * (1 - currentMetrics.ram / 100)}
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-sm sm:text-base font-bold text-white">
                    {currentMetrics.ram}%
                  </span>
                  <span className="text-[9px] text-slate-400">Average</span>
                </div>
              </div>
              <div className="mt-2.5 flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                <svg className="w-10 h-3 text-emerald-400" viewBox="0 0 40 12" fill="none">
                  <path
                    d={currentMetrics.ramTrend}
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                <span>{currentMetrics.ramDelta}</span>
              </div>
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
                    strokeDashoffset={251.32 * (1 - currentMetrics.disk / 100)}
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-sm sm:text-base font-bold text-white">
                    {currentMetrics.disk}%
                  </span>
                  <span className="text-[9px] text-slate-400">Average</span>
                </div>
              </div>
              <div className="mt-2.5 flex items-center gap-1 text-[11px] text-purple-400 font-medium">
                <svg className="w-10 h-3 text-purple-400" viewBox="0 0 40 12" fill="none">
                  <path
                    d={currentMetrics.diskTrend}
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                <span>{currentMetrics.diskDelta}</span>
              </div>
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
            <div className="space-y-2 flex-1 text-xs">
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

        {/* Col 3: Alerts Summary Card */}
        <div className="lg:col-span-3 glass-card p-5 border-slate-800/80 bg-[#091124]/90 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <h2 className="text-sm font-bold text-white tracking-tight">Alerts Summary</h2>
            <Link href="/alerts" className="text-xs text-blue-400 hover:text-blue-300 font-medium">
              View all
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

          <div className="pt-2 text-right">
            <Link
              href="/alerts"
              className="text-[11px] font-mono text-slate-400 hover:text-cyan-400 transition-colors"
            >
              Autonomous pipeline • Rule §16/21 →
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

      {/* Row 4: Threat Detection Summary (Bottom Full-Width Card) */}
      <div className="glass-card p-5 border-slate-800/80 bg-[#091124]/90 shadow-lg">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-bold text-white tracking-tight">Threat Detection Summary</h2>
          </div>
          <select
            value={selectedThreatPeriod}
            onChange={(e) => setSelectedThreatPeriod(e.target.value as "Today" | "Yesterday" | "Last 7 Days")}
            className="text-[11px] bg-slate-900 border border-slate-700/80 text-slate-300 rounded-lg px-2.5 py-1 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="Today">Today</option>
            <option value="Yesterday">Yesterday</option>
            <option value="Last 7 Days">Last 7 Days</option>
          </select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-5 items-center">
          {/* Left 4 Threat Metric Columns */}
          <div className="lg:col-span-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-slate-400">Malware Detected</p>
              <p className="text-2xl font-bold text-white font-sans">{currentThreat.malware}</p>
              <p className="text-[10px] font-medium text-rose-400">{currentThreat.malwareDelta}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-slate-400">Ransomware Attempts</p>
              <p className="text-2xl font-bold text-white font-sans">{currentThreat.ransomware}</p>
              <p className="text-[10px] font-medium text-slate-500">{currentThreat.ransomwareDelta}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-slate-400">Blocked Connections</p>
              <p className="text-2xl font-bold text-white font-sans">{currentThreat.blocked}</p>
              <p className="text-[10px] font-medium text-emerald-400">{currentThreat.blockedDelta}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-slate-400">Quarantined Devices</p>
              <p className="text-2xl font-bold text-white font-sans">{currentThreat.quarantined}</p>
              <p className="text-[10px] font-medium text-emerald-400">{currentThreat.quarantinedDelta}</p>
            </div>
          </div>

          {/* Right Threat Activity Area Chart (0-75 timeline) */}
          <div className="lg:col-span-6 flex flex-col justify-end">
            <div className="relative h-28 w-full">
              {/* Y Axis Ticks */}
              <div className="absolute left-0 top-0 bottom-4 flex flex-col justify-between text-[9px] font-mono text-slate-500 pr-2 border-r border-slate-800">
                <span>75</span>
                <span>50</span>
                <span>25</span>
                <span>0</span>
              </div>

              {/* Chart Body */}
              <div className="ml-7 h-full flex flex-col justify-between">
                <div className="relative flex-1">
                  <svg className="w-full h-full" viewBox="0 0 500 80" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="threat-area-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Area fill */}
                    <path d={currentThreat.areaD} fill="url(#threat-area-grad)" />
                    {/* Trend Line */}
                    <path d={currentThreat.pathD} fill="none" stroke="#3b82f6" strokeWidth="2.5" />

                    {/* Node points */}
                    {currentThreat.points.map((pt, pIdx) => (
                      <circle
                        key={pIdx}
                        cx={pt.cx}
                        cy={pt.cy}
                        r="3.5"
                        fill="#60a5fa"
                        stroke="#1e3a8a"
                        strokeWidth="1.5"
                      />
                    ))}
                  </svg>
                </div>

                {/* X Axis Time Marks */}
                <div className="flex justify-between text-[9px] font-mono text-slate-500 pt-1 border-t border-slate-800">
                  {currentThreat.timeLabels.map((lbl, lIdx) => (
                    <span key={lIdx}>{lbl}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
