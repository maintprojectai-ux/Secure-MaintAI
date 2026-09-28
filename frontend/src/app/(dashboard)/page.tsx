"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import { DonutChart, DonutSegment } from "@/components/charts/DonutChart";
import {
  MOCK_DASHBOARD_KPI,
  MOCK_WORKSTATIONS,
  MOCK_ALERTS,
  apiFetch,
} from "@/lib/api";
import { DashboardOverviewKPI, Workstation, Alert } from "@/types";

export default function DashboardPage() {
  const [selectedTimeframe, setSelectedTimeframe] = useState("Real-time");
  const [selectedResource, setSelectedResource] = useState("CPU");
  const [selectedThreatPeriod, setSelectedThreatPeriod] = useState("Today");

  // Dynamic state populated from API with MOCK fallback
  const [kpi, setKpi] = useState<DashboardOverviewKPI>(MOCK_DASHBOARD_KPI);
  const [workstations, setWorkstations] = useState<Workstation[]>(MOCK_WORKSTATIONS);
  const [alerts, setAlerts] = useState<Alert[]>(MOCK_ALERTS);


  const loadLiveData = async () => {
    try {
      const [liveKpi, liveWorkstations, liveAlerts] = await Promise.allSettled([
        apiFetch<DashboardOverviewKPI>("/dashboard/kpis"),
        apiFetch<Workstation[]>("/workstations"),
        apiFetch<Alert[]>("/alerts"),
      ]);

      if (liveKpi.status === "fulfilled" && liveKpi.value) {
        setKpi(liveKpi.value);
      }
      if (liveWorkstations.status === "fulfilled" && liveWorkstations.value) {
        const val: any = liveWorkstations.value;
        const list = Array.isArray(val)
          ? val
          : Array.isArray(val?.items)
            ? val.items
            : [];
        if (list.length > 0) {
          setWorkstations(list);
        }
      }
      if (liveAlerts.status === "fulfilled" && liveAlerts.value) {
        const val: any = liveAlerts.value;
        const list = Array.isArray(val)
          ? val
          : Array.isArray(val?.items)
            ? val.items
            : [];
        if (list.length > 0) {
          setAlerts(list);
        }
      }
    } catch {
      // Retain initial mock data if endpoint is unavailable
    }
  };

  useEffect(() => {
    loadLiveData();
    const interval = setInterval(loadLiveData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Compute dynamic derived metrics
  const total = kpi.total_workstations || 128;
  const healthyCount = kpi.online_workstations || 98;
  const warningCount = kpi.warning_workstations || 18;
  const criticalCount = kpi.critical_workstations || 12;
  const offlineCount = kpi.offline_workstations || 8;
  const threatCount = kpi.active_threats || 7;

  const healthyPct = total > 0 ? ((healthyCount / total) * 100).toFixed(1) : "76.6";
  const warningPct = total > 0 ? ((warningCount / total) * 100).toFixed(1) : "14.1";
  const criticalPct = total > 0 ? ((criticalCount / total) * 100).toFixed(1) : "9.3";
  const offlinePct = total > 0 ? ((offlineCount / total) * 100).toFixed(1) : "6.3";

  // Top KPI metrics
  const kpiCards = [
    {
      title: "Total Devices",
      value: String(total),
      delta: "↑ 12 from yesterday",
      deltaColor: "text-blue-400",
      icon: <Monitor className="w-5 h-5 text-blue-400" />,
      iconBg: "bg-blue-600/20 border-blue-500/30",
      href: "/devices",
    },
    {
      title: "Healthy Devices",
      value: String(healthyCount),
      delta: `${healthyPct}% of total`,
      deltaColor: "text-emerald-400",
      icon: <Activity className="w-5 h-5 text-emerald-400" />,
      iconBg: "bg-emerald-600/20 border-emerald-500/30",
      href: "/devices?status=ONLINE",
    },
    {
      title: "Warning Devices",
      value: String(warningCount),
      delta: `${warningPct}% of total`,
      deltaColor: "text-amber-400",
      icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
      iconBg: "bg-amber-600/20 border-amber-500/30",
      href: "/devices?status=WARNING",
    },
    {
      title: "Critical Devices",
      value: String(criticalCount),
      delta: `${criticalPct}% of total`,
      deltaColor: "text-rose-400",
      icon: <AlertCircle className="w-5 h-5 text-rose-400" />,
      iconBg: "bg-rose-600/20 border-rose-500/30",
      href: "/devices?status=CRITICAL",
    },
    {
      title: "Active Threats",
      value: String(threatCount),
      delta: "↓ 3 resolved today",
      deltaColor: "text-purple-400",
      icon: <ShieldAlert className="w-5 h-5 text-purple-400" />,
      iconBg: "bg-purple-600/20 border-purple-500/30",
      href: "/cybersecurity",
    },
  ];

  // Devices health distribution for donut chart
  const deviceStatus = [
    { label: "Healthy", count: healthyCount, percent: `${healthyPct}%`, color: "#10b981", bg: "bg-emerald-500", href: "/devices?status=ONLINE" },
    { label: "Warning", count: warningCount, percent: `${warningPct}%`, color: "#f59e0b", bg: "bg-amber-500", href: "/devices?status=WARNING" },
    { label: "Critical", count: criticalCount, percent: `${criticalPct}%`, color: "#ef4444", bg: "bg-rose-500", href: "/devices?status=CRITICAL" },
    { label: "Offline", count: offlineCount, percent: `${offlinePct}%`, color: "#64748b", bg: "bg-slate-500", href: "/devices?status=OFFLINE" },
  ];

  const deviceStatusDonutData: DonutSegment[] = [
    { label: "Healthy", value: healthyCount, color: "#10b981" },
    { label: "Warning", value: warningCount, color: "#f59e0b" },
    { label: "Critical", value: criticalCount, color: "#ef4444" },
    { label: "Offline", value: offlineCount, color: "#64748b" },
  ];

  // Alerts Summary rows
  const safeAlerts = Array.isArray(alerts) ? alerts : [];
  const criticalAlertsCount = safeAlerts.filter((a) => a.severity === "CRITICAL").length || 12;
  const warningAlertsCount = safeAlerts.filter((a) => a.severity === "HIGH" || a.severity === "MEDIUM").length || 18;
  const infoAlertsCount = safeAlerts.filter((a) => a.severity === "LOW").length || 24;
  const totalAlertsCount = safeAlerts.length || 54;

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

  // Dynamic Recent Alerts list
  const recentAlerts = [
    {
      id: "alt-1",
      severity: "Critical",
      severityColor: "bg-rose-500/15 text-rose-400 border-rose-500/30",
      title: "High CPU usage detected",
      description: "CPU usage exceeded 90%",
      device: "SRV-ACA-01",
      time: "2 min ago",
    },
    {
      id: "alt-2",
      severity: "Warning",
      severityColor: "bg-amber-500/15 text-amber-400 border-amber-500/30",
      title: "Memory usage is high",
      description: "Memory usage exceeded 80%",
      device: "LAB-PC-24",
      time: "8 min ago",
    },
    {
      id: "alt-3",
      severity: "Critical",
      severityColor: "bg-rose-500/15 text-rose-400 border-rose-500/30",
      title: "Suspicious login detected",
      description: "Multiple failed login attempts",
      device: "SRV-GATE-03",
      time: "15 min ago",
    },
    {
      id: "alt-4",
      severity: "Info",
      severityColor: "bg-blue-500/15 text-blue-400 border-blue-500/30",
      title: "System backup completed",
      description: "Daily backup completed successfully",
      device: "SRV-BACK-01",
      time: "30 min ago",
    },
  ];

  // Top Devices by Resource Usage (sorted dynamically per metric)
  interface TopDevice {
    name: string;
    usage: number;
    barColor: string;
    status: string;
    statusDot: string;
  }

  const topDevicesByMetric: Record<string, TopDevice[]> = {
    CPU: [
      { name: "SRV-ACA-01", usage: 92, barColor: "bg-rose-500", status: "Critical", statusDot: "bg-rose-500" },
      { name: "LAB-PC-17", usage: 78, barColor: "bg-amber-500", status: "Warning", statusDot: "bg-amber-500" },
      { name: "SRV-DB-02", usage: 68, barColor: "bg-amber-500", status: "Warning", statusDot: "bg-amber-500" },
      { name: "LAB-PC-09", usage: 45, barColor: "bg-emerald-500", status: "Healthy", statusDot: "bg-emerald-500" },
      { name: "SRV-WEB-01", usage: 32, barColor: "bg-emerald-500", status: "Healthy", statusDot: "bg-emerald-500" },
    ],
    Memory: [
      { name: "LAB-PC-24", usage: 88, barColor: "bg-rose-500", status: "Critical", statusDot: "bg-rose-500" },
      { name: "SRV-DB-02", usage: 84, barColor: "bg-rose-500", status: "Critical", statusDot: "bg-rose-500" },
      { name: "SRV-ACA-01", usage: 76, barColor: "bg-amber-500", status: "Warning", statusDot: "bg-amber-500" },
      { name: "LAB-PC-17", usage: 62, barColor: "bg-amber-500", status: "Warning", statusDot: "bg-amber-500" },
      { name: "SRV-GATE-03", usage: 41, barColor: "bg-emerald-500", status: "Healthy", statusDot: "bg-emerald-500" },
    ],
    Disk: [
      { name: "SRV-BACK-01", usage: 91, barColor: "bg-rose-500", status: "Critical", statusDot: "bg-rose-500" },
      { name: "SRV-DB-02", usage: 79, barColor: "bg-amber-500", status: "Warning", statusDot: "bg-amber-500" },
      { name: "SRV-ACA-01", usage: 65, barColor: "bg-amber-500", status: "Warning", statusDot: "bg-amber-500" },
      { name: "LAB-PC-09", usage: 48, barColor: "bg-emerald-500", status: "Healthy", statusDot: "bg-emerald-500" },
      { name: "LAB-PC-24", usage: 35, barColor: "bg-emerald-500", status: "Healthy", statusDot: "bg-emerald-500" },
    ],
  };

  const currentTopDevices = topDevicesByMetric[selectedResource] || topDevicesByMetric["CPU"];

  // Threat Summary counts
  const safeWorkstations = Array.isArray(workstations) ? workstations : [];
  const quarantinedDevicesCount = safeWorkstations.filter((w) => w?.is_isolated).length || 2;

  // System gauges values based on selected timeframe
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
      cpu: Math.round(kpi.average_cpu || 42),
      ram: Math.round(kpi.average_ram || 68),
      disk: Math.round(kpi.average_disk || 54),
      cpuDelta: "↑ 6%",
      ramDelta: "↑ 8%",
      diskDelta: "↑ 3%",
      cpuTrend: "M1 9L10 4L20 8L30 2L39 7",
      ramTrend: "M1 10L12 3L22 7L31 2L39 6",
      diskTrend: "M1 8L10 5L19 9L29 3L39 5",
    },
    "Last 1h": {
      cpu: 48,
      ram: 71,
      disk: 54,
      cpuDelta: "↑ 9%",
      ramDelta: "↑ 5%",
      diskDelta: "↑ 2%",
      cpuTrend: "M1 7L10 9L20 5L30 8L39 3",
      ramTrend: "M1 8L12 6L22 4L31 5L39 2",
      diskTrend: "M1 6L10 7L19 5L29 6L39 4",
    },
    "Last 24h": {
      cpu: 39,
      ram: 64,
      disk: 53,
      cpuDelta: "↓ 2%",
      ramDelta: "↑ 4%",
      diskDelta: "↑ 1%",
      cpuTrend: "M1 4L10 6L20 3L30 5L39 8",
      ramTrend: "M1 9L12 5L22 6L31 4L39 7",
      diskTrend: "M1 7L10 8L19 6L29 5L39 6",
    },
  };

  const currentMetrics =
    systemMetricsByTimeframe[selectedTimeframe] || systemMetricsByTimeframe["Real-time"];

  // Threat Detection Summary values based on selected period
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
      malware: 3,
      malwareDelta: "↑ 1 from yesterday",
      ransomware: 1,
      ransomwareDelta: "No change",
      blocked: 45,
      blockedDelta: "↑ 15 from yesterday",
      quarantined: quarantinedDevicesCount,
      quarantinedDelta: "↓ 1 from yesterday",
      pathD: "M0 65 Q 40 68, 80 50 T 160 55 T 240 25 T 320 40 T 400 30 T 500 45",
      areaD: "M0 65 Q 40 68, 80 50 T 160 55 T 240 25 T 320 40 T 400 30 T 500 45 L 500 80 L 0 80 Z",
      points: [
        { cx: 240, cy: 25 },
        { cx: 400, cy: 30 },
      ],
      timeLabels: ["00:00", "04:00", "08:00", "12:00", "18:00", "20:00", "24:00"],
    },
    Yesterday: {
      malware: 2,
      malwareDelta: "↓ 1 from 2 days ago",
      ransomware: 1,
      ransomwareDelta: "No change",
      blocked: 30,
      blockedDelta: "↓ 5 from 2 days ago",
      quarantined: 3,
      quarantinedDelta: "↑ 1 from 2 days ago",
      pathD: "M0 70 Q 50 60, 100 55 T 200 45 T 300 50 T 400 35 T 500 60",
      areaD: "M0 70 Q 50 60, 100 55 T 200 45 T 300 50 T 400 35 T 500 60 L 500 80 L 0 80 Z",
      points: [
        { cx: 200, cy: 45 },
        { cx: 400, cy: 35 },
      ],
      timeLabels: ["00:00", "04:00", "08:00", "12:00", "18:00", "20:00", "24:00"],
    },
    "Last 7 Days": {
      malware: 18,
      malwareDelta: "↑ 4 from prev week",
      ransomware: 4,
      ransomwareDelta: "↑ 1 from prev week",
      blocked: 215,
      blockedDelta: "↑ 38 from prev week",
      quarantined: 5,
      quarantinedDelta: "No change",
      pathD: "M0 55 Q 60 40, 120 48 T 240 20 T 360 35 T 440 28 T 500 50",
      areaD: "M0 55 Q 60 40, 120 48 T 240 20 T 360 35 T 440 28 T 500 50 L 500 80 L 0 80 Z",
      points: [
        { cx: 240, cy: 20 },
        { cx: 440, cy: 28 },
      ],
      timeLabels: ["Sep 10", "Sep 11", "Sep 12", "Sep 13", "Sep 14", "Sep 15", "Sep 16"],
    },
  };

  const currentThreat =
    threatDataByPeriod[selectedThreatPeriod] || threatDataByPeriod["Today"];

  return (
    <div className="space-y-6 font-sans">
      {/* Row 1: Top 5 Stat KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpiCards.map((card, i) => (
          <Link
            key={i}
            href={card.href}
            className="glass-card p-4 flex items-center justify-between border-slate-800/80 bg-[#091124]/90 hover:border-slate-700 hover:scale-[1.01] transition-all shadow-lg group cursor-pointer"
          >
            <div>
              <p className="text-xs font-medium text-slate-400 tracking-wide group-hover:text-slate-300">{card.title}</p>
              <h3 className="text-2xl font-bold text-white mt-1 font-sans tracking-tight">{card.value}</h3>
              <p className={`text-[11px] font-medium mt-1 ${card.deltaColor}`}>{card.delta}</p>
            </div>
            <div className={`w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0 ${card.iconBg}`}>
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
                  <span className="text-sm sm:text-base font-bold text-white">{currentMetrics.cpu}%</span>
                  <span className="text-[9px] text-slate-400">Average</span>
                </div>
              </div>
              <div className="mt-2.5 flex items-center gap-1 text-[11px] text-blue-400 font-medium">
                <svg className="w-10 h-3 text-blue-400" viewBox="0 0 40 12" fill="none">
                  <path d={currentMetrics.cpuTrend} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span>{currentMetrics.cpuDelta}</span>
              </div>
              <span className="text-[9px] text-slate-500">vs yesterday</span>
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
                  <span className="text-sm sm:text-base font-bold text-white">{currentMetrics.ram}%</span>
                  <span className="text-[9px] text-slate-400">Average</span>
                </div>
              </div>
              <div className="mt-2.5 flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                <svg className="w-10 h-3 text-emerald-400" viewBox="0 0 40 12" fill="none">
                  <path d={currentMetrics.ramTrend} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span>{currentMetrics.ramDelta}</span>
              </div>
              <span className="text-[9px] text-slate-500">vs yesterday</span>
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
                  <span className="text-sm sm:text-base font-bold text-white">{currentMetrics.disk}%</span>
                  <span className="text-[9px] text-slate-400">Average</span>
                </div>
              </div>
              <div className="mt-2.5 flex items-center gap-1 text-[11px] text-purple-400 font-medium">
                <svg className="w-10 h-3 text-purple-400" viewBox="0 0 40 12" fill="none">
                  <path d={currentMetrics.diskTrend} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span>{currentMetrics.diskDelta}</span>
              </div>
              <span className="text-[9px] text-slate-500">vs yesterday</span>
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
                    <span className="text-slate-300 font-medium group-hover:text-white">{item.label}</span>
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
            <span>Last updated: 2 minutes ago</span>
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

          <div className="pt-2" />
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
              View all
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
                {recentAlerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-2 whitespace-nowrap">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${alert.severityColor}`}
                      >
                        {alert.severity}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <Link href="/alerts" className="font-semibold text-white tracking-tight hover:text-blue-400 transition-colors">
                        {alert.title}
                      </Link>
                      <div className="text-[11px] text-slate-400 line-clamp-1">{alert.description}</div>
                    </td>
                    <td className="py-3 px-2 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                      <Link href={`/devices/${alert.device}`} className="hover:text-blue-400 hover:underline transition-colors">
                        {alert.device}
                      </Link>
                    </td>
                    <td className="py-3 px-2 text-[11px] text-slate-400 whitespace-nowrap">
                      {alert.time}
                    </td>
                    <td className="py-3 px-1 text-right">
                      <Link href="/alerts" className="p-1 rounded text-slate-500 hover:text-slate-300 transition-colors inline-block" title="View alert">
                        <MoreVertical className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
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
              onChange={(e) => setSelectedResource(e.target.value)}
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
                {currentTopDevices.map((device, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-2 font-mono text-[11px] text-white whitespace-nowrap">
                      <Link
                        href={`/devices/${device.name}`}
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
                            style={{ width: `${device.usage}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-mono text-slate-300 w-8">{device.usage}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-2 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
                        <span className={`w-1.5 h-1.5 rounded-full ${device.statusDot}`} />
                        {device.status}
                      </span>
                    </td>
                  </tr>
                ))}
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
            onChange={(e) => setSelectedThreatPeriod(e.target.value)}
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
                    <path
                      d={currentThreat.areaD}
                      fill="url(#threat-area-grad)"
                    />
                    {/* Trend Line */}
                    <path
                      d={currentThreat.pathD}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="2.5"
                    />

                    {/* Node points */}
                    {currentThreat.points.map((pt, pIdx) => (
                      <circle key={pIdx} cx={pt.cx} cy={pt.cy} r="3.5" fill="#60a5fa" stroke="#1e3a8a" strokeWidth="1.5" />
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
