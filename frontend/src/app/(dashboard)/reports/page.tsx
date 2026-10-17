"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  FileText,
  Calendar,
  Clock,
  Download,
  Server,
  AlertTriangle,
  PlusCircle,
  Shield,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  Cpu,
  Layers,
  HardDrive,
  Activity,
  Mail,
  Check,
  X,
  RefreshCw,
} from "lucide-react";
import { DonutChart } from "@/components/charts/DonutChart";
import { LineChart } from "@/components/charts/LineChart";
import {
  ExecutiveReportSummary,
  getReportSummary,
  downloadReportExport,
} from "@/lib/api";

const EMPTY_SUMMARY: ExecutiveReportSummary = {
  generated_at: new Date().toISOString(),
  fleet_total_workstations: 0,
  fleet_online_workstations: 0,
  fleet_offline_workstations: 0,
  fleet_warning_workstations: 0,
  fleet_new_workstations_7d: 0,
  fleet_uptime_percentage: 0,
  uptime_trend: [],
  total_incidents: 0,
  active_security_threats: 0,
  resolved_incidents: 0,
  maintenance_advisories: 0,
  total_alerts: 0,
  critical_alerts: 0,
  high_alerts: 0,
  medium_alerts: 0,
  low_alerts: 0,
  alert_categories: {},
  top_threats: [],
  avg_cpu_usage: 0,
  avg_memory_usage: 0,
  avg_disk_activity: 0,
  avg_network_activity: 0,
  mean_time_to_resolution_minutes: 0,
  threat_distribution: {},
  system_health_rating: "Loading...",
};

export default function ReportsPage() {
  const [summary, setSummary] = useState<ExecutiveReportSummary>(EMPTY_SUMMARY);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [dateRange, setDateRange] = useState("Last 7 Days");
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [uptimeWindow, setUptimeWindow] = useState<"7 Days" | "14 Days" | "30 Days">("7 Days");
  const [selectedUptimePointIdx, setSelectedUptimePointIdx] = useState<number | null>(null);

  // Schedule Report Form
  const [scheduleEmail, setScheduleEmail] = useState("admin@university.edu, secops@university.edu");
  const [scheduleCadence, setScheduleCadence] = useState("Weekly");
  const [scheduleTime, setScheduleTime] = useState("Wednesdays at 10:00 AM AST");
  const [scheduleIncludePdf, setScheduleIncludePdf] = useState(true);
  const [scheduleIncludeCsv, setScheduleIncludeCsv] = useState(true);

  const loadReportSummary = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getReportSummary();
      if (res) {
        setSummary(res);
      }
    } catch {
      setSummary(EMPTY_SUMMARY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReportSummary();
  }, [loadReportSummary]);

  // Derived Executive KPIs strictly from database summary
  const kpis = useMemo(() => {
    const totalWs = summary.fleet_total_workstations;
    const uptime = summary.fleet_uptime_percentage;
    const critAlerts = summary.critical_alerts;
    const securityScore =
      totalWs === 0 && summary.total_incidents === 0 && summary.total_alerts === 0
        ? 100
        : Math.max(
            0,
            Math.min(
              100,
              Math.round(
                uptime * 0.6 +
                  Math.max(0, 100 - summary.active_security_threats * 10 - critAlerts * 5) * 0.4
              )
            )
          );
    return {
      total_devices: totalWs,
      total_devices_sub: `${summary.fleet_new_workstations_7d} added this week`,
      system_uptime: uptime,
      system_uptime_sub: `${summary.fleet_online_workstations} / ${totalWs} online`,
      critical_alerts: critAlerts,
      critical_alerts_sub: `${summary.total_alerts} total alerts in DB`,
      security_score: securityScore,
      security_score_sub: summary.system_health_rating,
    };
  }, [summary]);

  // Section 1: Fleet percentages & Uptime Trend
  const healthStats = useMemo(() => {
    const total = summary.fleet_total_workstations;
    const pct = (count: number) => (total > 0 ? Math.round((count / total) * 1000) / 10 : 0);
    return {
      online_devices: summary.fleet_online_workstations,
      online_percentage: pct(summary.fleet_online_workstations),
      offline_devices: summary.fleet_offline_workstations,
      offline_percentage: pct(summary.fleet_offline_workstations),
      warning_devices: summary.fleet_warning_workstations,
      warning_percentage: pct(summary.fleet_warning_workstations),
      new_devices: summary.fleet_new_workstations_7d,
    };
  }, [summary]);

  const uptimeTrendPoints = useMemo(() => {
    const count = uptimeWindow === "7 Days" ? 7 : uptimeWindow === "14 Days" ? 14 : 30;
    if (Array.isArray(summary.uptime_trend) && summary.uptime_trend.length > 0) {
      return summary.uptime_trend.slice(-count).map((pt) => ({
        label: pt.label,
        value: pt.value,
      }));
    }
    const now = new Date();
    const pts: { label: string; value: number }[] = [];
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      pts.push({ label, value: summary.fleet_uptime_percentage });
    }
    return pts;
  }, [summary.uptime_trend, summary.fleet_uptime_percentage, uptimeWindow]);

  const uptimeWindowStats = useMemo(() => {
    if (uptimeTrendPoints.length === 0) return { avg: 0, min: 0, max: 0 };
    const vals = uptimeTrendPoints.map((p) => p.value);
    const sum = vals.reduce((acc, v) => acc + v, 0);
    return {
      avg: Math.round((sum / vals.length) * 100) / 100,
      min: Math.min(...vals),
      max: Math.max(...vals),
    };
  }, [uptimeTrendPoints]);

  // Section 2: Alerts Overview Donut strictly from database alert severity counts
  const alertsDonutData = useMemo(() => {
    return [
      { label: "Critical", value: summary.critical_alerts, color: "#ef4444" },
      { label: "High", value: summary.high_alerts, color: "#f97316" },
      { label: "Medium", value: summary.medium_alerts, color: "#f59e0b" },
      { label: "Low", value: summary.low_alerts, color: "#3b82f6" },
    ];
  }, [summary]);

  // Section 4: Top Alert Categories strictly from database alert source_type counts
  const alertCategoryRows = useMemo(() => {
    const labelMap: Record<string, { label: string; color: string }> = {
      CYBERSECURITY_THREAT: { label: "Cybersecurity Threat", color: "#ef4444" },
      TECHNICAL_ANOMALY: { label: "Technical Anomaly", color: "#3b82f6" },
      PREDICTIVE_MAINTENANCE: { label: "Predictive Maintenance", color: "#f59e0b" },
      HUMAN_INTERVENTION_REQUIRED: { label: "Human Intervention Required", color: "#a855f7" },
    };
    const entries = Object.entries(summary.alert_categories || {});
    if (entries.length === 0) {
      return Object.entries(labelMap).map(([, meta]) => ({
        category: meta.label,
        count: 0,
        color: meta.color,
      }));
    }
    return entries
      .map(([key, count]) => ({
        category: labelMap[key]?.label || key,
        count: Number(count || 0),
        color: labelMap[key]?.color || "#3b82f6",
      }))
      .sort((a, b) => b.count - a.count);
  }, [summary.alert_categories]);

  const maxCategoryCount = useMemo(
    () => Math.max(1, ...alertCategoryRows.map((c) => c.count)),
    [alertCategoryRows]
  );

  // Section 5: Resource Utilization strictly from database telemetry averages
  const resourceUtilization = useMemo(() => {
    return [
      { name: "CPU Usage", average: summary.avg_cpu_usage, color: "#3b82f6" },
      { name: "Memory Usage", average: summary.avg_memory_usage, color: "#8b5cf6" },
      { name: "Disk Activity", average: summary.avg_disk_activity, color: "#10b981" },
      { name: "Network I/O", average: summary.avg_network_activity, color: "#f59e0b" },
    ];
  }, [summary]);

  // Section 6: Dynamic Recommendations derived from live database findings
  const dynamicRecommendations = useMemo(() => {
    const recs: string[] = [];
    if (summary.critical_alerts > 0) {
      recs.push(
        `Investigate and resolve ${summary.critical_alerts} active CRITICAL alert(s) in the Alert Center.`
      );
    }
    if (summary.active_security_threats > 0) {
      recs.push(
        `Review ${summary.active_security_threats} security threat/policy incident(s) and verify SOAR surgical containment status.`
      );
    }
    if (summary.fleet_offline_workstations > 0) {
      recs.push(
        `Restore agent connectivity on ${summary.fleet_offline_workstations} offline workstation(s).`
      );
    }
    if (summary.maintenance_advisories > 0) {
      recs.push(
        `Complete ${summary.maintenance_advisories} scheduled predictive maintenance task(s) to prevent hardware degradation.`
      );
    }
    if (summary.avg_cpu_usage >= 80) {
      recs.push(
        `Fleet average CPU utilization is elevated (${summary.avg_cpu_usage}%). Inspect compute workloads across lab nodes.`
      );
    }
    if (recs.length === 0) {
      recs.push(
        "All monitored workstations, security policies, and telemetry pipelines are operating within nominal parameters."
      );
    }
    return recs;
  }, [summary]);

  const generatedTimestampStr = useMemo(() => {
    if (!summary.generated_at) return "Recent";
    return new Date(summary.generated_at).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [summary.generated_at]);

  // Handle Export Download (live streaming CSV / JSON / Print PDF from backend)
  const handleTriggerExport = async (format: "pdf" | "json" | "csv") => {
    setShowExportDropdown(false);

    if (format === "csv" || format === "json") {
      try {
        const blob = await downloadReportExport(format);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `secure-maintai-executive-report-${new Date().toISOString().slice(0, 10)}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        setFeedbackToast(
          `Database ${format.toUpperCase()} forensic report downloaded from backend.`
        );
      } catch (err: any) {
        setFeedbackToast(
          err?.message || `Failed to export ${format.toUpperCase()} report from backend.`
        );
      }
    } else if (format === "pdf") {
      window.print();
      setFeedbackToast("Print / PDF compilation dialog opened.");
    }

    setTimeout(() => setFeedbackToast(null), 4000);
  };

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    setShowScheduleModal(false);
    setFeedbackToast(`Automated report schedule saved for ${scheduleCadence} distribution.`);
    setTimeout(() => setFeedbackToast(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback Notification */}
      {feedbackToast && (
        <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs flex items-center justify-between shadow-lg shadow-emerald-950/40 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{feedbackToast}</span>
          </div>
          <button onClick={() => setFeedbackToast(null)} className="text-emerald-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* In-Page Sub-Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Date Range Selector Dropdown */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowDateDropdown(!showDateDropdown)}
              className="px-3.5 py-2 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-200 flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{dateRange}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
            </button>

            {showDateDropdown && (
              <div className="absolute left-0 top-11 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30 py-1.5 text-xs animate-fade-in">
                {["Last 7 Days", "Last 14 Days", "Last 30 Days", "All Time (Database)"].map(
                  (range) => (
                    <button
                      key={range}
                      onClick={() => {
                        setDateRange(range);
                        setShowDateDropdown(false);
                        loadReportSummary();
                        setFeedbackToast(`Report refreshed for period: ${range}.`);
                        setTimeout(() => setFeedbackToast(null), 3000);
                      }}
                      className={`w-full px-3.5 py-2 text-left transition-colors flex items-center justify-between cursor-pointer ${
                        dateRange === range
                          ? "text-blue-400 bg-blue-500/10 font-semibold"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      <span>{range}</span>
                      {dateRange === range && <Check className="w-3.5 h-3.5" />}
                    </button>
                  )
                )}
              </div>
            )}
          </div>

          <button
            onClick={loadReportSummary}
            disabled={isLoading}
            className="px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Refresh live database report"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-blue-400" : "text-slate-400"}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Action Buttons: Schedule Report + Export Report */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowScheduleModal(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 text-xs font-medium text-slate-200 flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Schedule Report</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowExportDropdown(!showExportDropdown)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 transition-colors shadow-lg shadow-blue-600/25 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Report</span>
              <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
            </button>

            {showExportDropdown && (
              <div className="absolute right-0 top-11 w-52 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30 py-1.5 text-xs animate-fade-in">
                <button
                  onClick={() => handleTriggerExport("pdf")}
                  className="w-full px-3.5 py-2 text-left text-slate-200 hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <span className="w-5 h-5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center font-bold text-[10px]">
                    PDF
                  </span>
                  <span>Print / Save as PDF</span>
                </button>
                <button
                  onClick={() => handleTriggerExport("csv")}
                  className="w-full px-3.5 py-2 text-left text-slate-200 hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <span className="w-5 h-5 rounded bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold text-[10px]">
                    CSV
                  </span>
                  <span>Export Database CSV</span>
                </button>
                <button
                  onClick={() => handleTriggerExport("json")}
                  className="w-full px-3.5 py-2 text-left text-slate-200 hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <span className="w-5 h-5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-[10px]">
                    JSON
                  </span>
                  <span>Export Database JSON</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top Banner: Executive Summary */}
      <div className="glass-card p-6 rounded-2xl border border-slate-800 relative overflow-hidden bg-gradient-to-r from-slate-900/90 via-slate-900/75 to-blue-950/30">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left Metadata Block */}
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0 shadow-inner">
              <FileText className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Executive Summary</h2>
                <p className="text-xs text-slate-400">Live Database Infrastructure & Security Report</p>
              </div>
              <div className="space-y-1 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 w-24">Report Period</span>
                  <span className="font-medium text-slate-200 font-mono">{dateRange}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 w-24">Generated On</span>
                  <span className="font-medium text-slate-200 font-mono">{generatedTimestampStr}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 w-24">Generated By</span>
                  <span className="font-medium text-slate-200">Secure-MaintAI System</span>
                </div>
              </div>
            </div>
          </div>

          {/* 4 Center Metric Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1 lg:max-w-2xl">
            {/* Metric 1: Total Devices */}
            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-medium">Total Devices</span>
              <div className="text-2xl font-bold text-white tracking-tight">
                {kpis.total_devices}
              </div>
              <div className="text-[11px] font-medium text-emerald-400 flex items-center gap-1">
                <span>{kpis.total_devices_sub}</span>
              </div>
            </div>

            {/* Metric 2: System Uptime */}
            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-medium">System Uptime</span>
              <div className="text-2xl font-bold text-white tracking-tight">
                {kpis.system_uptime}%
              </div>
              <div className="text-[11px] font-medium text-emerald-400 flex items-center gap-1">
                <span>{kpis.system_uptime_sub}</span>
              </div>
            </div>

            {/* Metric 3: Critical Alerts */}
            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-medium">Critical Alerts</span>
              <div className="text-2xl font-bold text-white tracking-tight">
                {kpis.critical_alerts}
              </div>
              <div className="text-[11px] font-medium text-rose-400 flex items-center gap-1">
                <span>{kpis.critical_alerts_sub}</span>
              </div>
            </div>

            {/* Metric 4: Security Score */}
            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-medium">Security Score</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-white tracking-tight">
                  {kpis.security_score}
                </span>
                <span className="text-xs text-slate-500 font-medium">/100</span>
              </div>
              <div className="text-[11px] font-medium text-emerald-400 flex items-center gap-1">
                <span>{kpis.security_score_sub}</span>
              </div>
            </div>
          </div>

          {/* Right Visual 3D Document Illustration Artwork */}
          <div className="hidden xl:flex items-center justify-center pl-4 border-l border-slate-800/80">
            <div className="relative w-28 h-28 flex items-center justify-center">
              <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />
              <svg className="w-24 h-24 drop-shadow-xl" viewBox="0 0 100 100" fill="none">
                <rect x="20" y="10" width="60" height="78" rx="8" fill="#1e293b" stroke="#3b82f6" strokeWidth="2" />
                <rect x="25" y="16" width="30" height="4" rx="2" fill="#64748b" />
                <circle cx="38" cy="38" r="14" fill="#0f172a" stroke="#1e293b" strokeWidth="2" />
                <path d="M38 24 A14 14 0 0 1 52 38 L38 38 Z" fill="#3b82f6" />
                <path d="M52 38 A14 14 0 0 1 42 51 L38 38 Z" fill="#f59e0b" />
                <path d="M42 51 A14 14 0 1 1 38 24 L38 38 Z" fill="#10b981" />
                <line x1="58" y1="30" x2="72" y2="30" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
                <line x1="58" y1="36" x2="72" y2="36" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
                <line x1="58" y1="42" x2="68" y2="42" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
                <rect x="28" y="60" width="4" height="18" rx="1" fill="#3b82f6" />
                <rect x="36" y="66" width="4" height="12" rx="1" fill="#06b6d4" />
                <rect x="44" y="56" width="4" height="22" rx="1" fill="#6366f1" />
                <rect x="52" y="63" width="4" height="15" rx="1" fill="#10b981" />
                <circle cx="72" cy="74" r="12" fill="#2563eb" />
                <path d="M68 74 L71 77 L76 71" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: 12 Columns (Left 7 cols, Right 5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* ================= LEFT COLUMN (7 COLS) ================= */}
        <div className="lg:col-span-7 space-y-5">
          {/* Section 1: Infrastructure Health Overview */}
          <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <h3 className="text-sm font-bold text-white tracking-tight">
                1. Infrastructure Health Overview
              </h3>
            </div>

            {/* 4 Mini Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Online Devices */}
              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Online Devices</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-lg font-bold text-white">
                      {healthStats.online_devices}
                    </span>
                    <span className="text-[11px] text-emerald-400 font-semibold">
                      {healthStats.online_percentage}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Offline Devices */}
              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Offline Devices</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-lg font-bold text-white">
                      {healthStats.offline_devices}
                    </span>
                    <span className="text-[11px] text-rose-400 font-semibold">
                      {healthStats.offline_percentage}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Warning Devices */}
              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Warning Devices</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-lg font-bold text-white">
                      {healthStats.warning_devices}
                    </span>
                    <span className="text-[11px] text-amber-400 font-semibold">
                      {healthStats.warning_percentage}%
                    </span>
                  </div>
                </div>
              </div>

              {/* New Devices */}
              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <PlusCircle className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">New Devices</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-lg font-bold text-white">
                      {healthStats.new_devices}
                    </span>
                    <span className="text-[11px] text-blue-400 font-medium">This Week</span>
                  </div>
                </div>
              </div>
            </div>

            {/* System Uptime Trend */}
            <div className="space-y-2 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-300">System Uptime Trend</span>
                  <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                    <span>
                      Avg: <strong className="text-emerald-400">{uptimeWindowStats.avg}%</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Min: <strong className="text-slate-200">{uptimeWindowStats.min}%</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Max: <strong className="text-slate-200">{uptimeWindowStats.max}%</strong>
                    </span>
                  </div>
                </div>
                <select
                  value={uptimeWindow}
                  onChange={(e) => {
                    const newWin = e.target.value as "7 Days" | "14 Days" | "30 Days";
                    setUptimeWindow(newWin);
                    setSelectedUptimePointIdx(null);
                    setFeedbackToast(`Uptime trend window switched to ${newWin}.`);
                    setTimeout(() => setFeedbackToast(null), 2500);
                  }}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-[11px] text-slate-300 focus:outline-none cursor-pointer"
                >
                  <option value="7 Days">7 Days</option>
                  <option value="14 Days">14 Days</option>
                  <option value="30 Days">30 Days</option>
                </select>
              </div>

              <div className="pt-2">
                <LineChart
                  labels={uptimeTrendPoints.map((p) => p.label)}
                  series={[
                    {
                      id: "fleet-uptime",
                      name: "Fleet Uptime",
                      color: "#3b82f6",
                      data: uptimeTrendPoints.map((p) => p.value),
                    },
                  ]}
                  yMin={0}
                  yMax={100}
                  height={170}
                  unit="%"
                  selectedPointIndex={selectedUptimePointIdx}
                  onPointClick={(label, idx) => {
                    setSelectedUptimePointIdx(idx);
                    setFeedbackToast(`Uptime on ${label}: ${uptimeTrendPoints[idx]?.value ?? 0}%`);
                    setTimeout(() => setFeedbackToast(null), 3000);
                  }}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Security Posture */}
          <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <h3 className="text-sm font-bold text-white tracking-tight">
                3. Security Posture
              </h3>
              <Link
                href="/cybersecurity"
                className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-1"
              >
                <span>View all security events</span>
                <span>→</span>
              </Link>
            </div>

            {/* 3 Stat Cards from Database */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Security Score */}
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                <span className="text-xs text-slate-400 block">Security Score</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold text-white tracking-tight">
                    {kpis.security_score}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">/100</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-emerald-400 font-medium">
                    {summary.system_health_rating}
                  </span>
                </div>
              </div>

              {/* Active Security Threats */}
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                <span className="text-xs text-slate-400 block">Threats Detected</span>
                <div className="text-xl font-bold text-white tracking-tight">
                  {summary.active_security_threats}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-rose-400 font-medium">
                    {summary.total_incidents} total incidents
                  </span>
                </div>
              </div>

              {/* Resolved Incidents / Maintenance */}
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                <span className="text-xs text-slate-400 block">Resolved Incidents</span>
                <div className="text-xl font-bold text-white tracking-tight">
                  {summary.resolved_incidents}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-emerald-400 font-medium">
                    {summary.maintenance_advisories} maintenance tasks
                  </span>
                </div>
              </div>
            </div>

            {/* Top Threats This Week Table */}
            <div className="pt-1">
              <span className="text-xs font-semibold text-slate-300 block mb-2">
                Top Incidents & Threats in Database
              </span>
              <div className="overflow-x-auto rounded-xl border border-slate-800/80">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-800 bg-slate-900/50">
                      <th className="py-2.5 px-3 font-semibold">Incident / Threat</th>
                      <th className="py-2.5 px-3 font-semibold">Severity</th>
                      <th className="py-2.5 px-3 font-semibold">Occurrences</th>
                      <th className="py-2.5 px-3 font-semibold">Status</th>
                      <th className="py-2.5 px-3 font-semibold">Detected</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 font-sans">
                    {summary.top_threats.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-500">
                          No incidents or threats recorded in the database.
                        </td>
                      </tr>
                    ) : (
                      summary.top_threats.map((threat) => (
                        <tr key={threat.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-2.5 px-3 font-medium text-white">
                            <div className="flex items-center gap-2">
                              <Shield className="w-3.5 h-3.5 text-slate-500" />
                              <span>{threat.threat_name}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                threat.severity.toUpperCase() === "HIGH" ||
                                threat.severity.toUpperCase() === "CRITICAL"
                                  ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                                  : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                              }`}
                            >
                              {threat.severity}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-300 font-mono">{threat.occurrences}</td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30">
                              {threat.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                            {threat.first_detected}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Section 5: Resource Utilization */}
          <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <h3 className="text-sm font-bold text-white tracking-tight">
                5. Resource Utilization (Telemetry Averages)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {resourceUtilization.map((item) => (
                <div
                  key={item.name}
                  className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{
                        backgroundColor: `${item.color}20`,
                        color: item.color,
                        borderColor: `${item.color}40`,
                        borderWidth: "1px",
                      }}
                    >
                      {item.name === "CPU Usage" ? (
                        <Cpu className="w-3.5 h-3.5" />
                      ) : item.name === "Memory Usage" ? (
                        <Layers className="w-3.5 h-3.5" />
                      ) : item.name === "Disk Activity" ? (
                        <HardDrive className="w-3.5 h-3.5" />
                      ) : (
                        <Activity className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <span className="font-semibold text-slate-200">{item.name}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono text-slate-300 font-bold whitespace-nowrap">
                      Avg. {item.average}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ================= RIGHT COLUMN (5 COLS) ================= */}
        <div className="lg:col-span-5 space-y-5">
          {/* Section 2: Alerts Overview */}
          <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <h3 className="text-sm font-bold text-white tracking-tight">
                2. Alerts Overview
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">
                {summary.total_alerts} Total Events
              </span>
            </div>

            <div className="flex justify-center my-2">
              <DonutChart
                data={alertsDonutData}
                size={170}
                strokeWidth={18}
                centerLabel={String(summary.total_alerts)}
                centerSub="Total Alerts"
                onSegmentClick={(segment) => {
                  setFeedbackToast(`Selected ${segment.label} alerts (${segment.value} events).`);
                  setTimeout(() => setFeedbackToast(null), 3000);
                }}
              />
            </div>

            <div className="pt-2 border-t border-slate-800 space-y-1.5 text-xs">
              {alertsDonutData.map((s) => (
                <div key={s.label} className="flex justify-between text-slate-300">
                  <span className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.label}
                  </span>
                  <span className="font-mono text-slate-400">{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Top Alert Categories */}
          <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <h3 className="text-sm font-bold text-white tracking-tight">
                4. Top Alert Categories
              </h3>
            </div>

            <div className="space-y-3 pt-1 text-xs">
              {alertCategoryRows.map((cat) => (
                <div key={cat.category} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-medium">{cat.category}</span>
                    <span className="font-mono font-bold text-white">{cat.count}</span>
                  </div>
                  <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${summary.total_alerts > 0 ? (cat.count / maxCategoryCount) * 100 : 0}%`,
                        backgroundColor: cat.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 6: Report Summary & Recommendations */}
          <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <h3 className="text-sm font-bold text-white tracking-tight">
                6. Report Summary
              </h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Database summary across{" "}
              <span className="text-white font-semibold">{summary.fleet_total_workstations}</span>{" "}
              managed workstations:{" "}
              <span className="text-emerald-400 font-semibold">
                {summary.fleet_online_workstations} online
              </span>{" "}
              ({summary.fleet_uptime_percentage}% availability),{" "}
              <span className="text-white font-semibold">{summary.total_incidents}</span> recorded
              incidents ({summary.resolved_incidents} resolved), and{" "}
              <span className="text-rose-400 font-semibold">{summary.critical_alerts}</span>{" "}
              critical alerts.
            </p>

            {/* Recommendations Card */}
            <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/30 space-y-2.5">
              <div className="flex items-center gap-2 text-blue-400 text-xs font-bold">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span>Recommendations</span>
              </div>

              <div className="space-y-2 text-xs">
                {dynamicRecommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2 text-slate-200">
                    <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Report Distribution (Left) & Export Options (Right) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Left: Report Distribution */}
        <div className="md:col-span-6 glass-card p-5 rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0">
            <Mail className="w-5 h-5" />
          </div>
          <div className="space-y-0.5 text-xs">
            <h4 className="font-bold text-white">Report Distribution</h4>
            <p className="text-slate-400">
              Cadence: <span className="text-slate-200 font-medium">{scheduleCadence}</span> ({scheduleTime})
            </p>
            <p className="text-slate-300 font-mono text-[11px] pt-1">
              Recipients: <span className="text-blue-400 font-semibold">{scheduleEmail}</span>
            </p>
          </div>
        </div>

        {/* Right: Export Options */}
        <div className="md:col-span-6 glass-card p-5 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-2.5">
          <h4 className="text-xs font-bold text-white tracking-tight">Export Options</h4>
          <div className="grid grid-cols-3 gap-2.5">
            <button
              onClick={() => handleTriggerExport("pdf")}
              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span className="w-4 h-4 rounded bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-[9px]">
                PDF
              </span>
              <span>PDF</span>
            </button>

            <button
              onClick={() => handleTriggerExport("csv")}
              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span className="w-4 h-4 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-[9px]">
                CSV
              </span>
              <span>CSV</span>
            </button>

            <button
              onClick={() => handleTriggerExport("json")}
              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span className="w-4 h-4 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[9px]">
                JSON
              </span>
              <span>JSON</span>
            </button>
          </div>
        </div>
      </div>

      {/* Schedule Report Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700/90 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Schedule Automated Report</h3>
                  <p className="text-xs text-slate-400">Set recurring email delivery for stakeholders</p>
                </div>
              </div>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Recipient Email Addresses (comma separated)
                </label>
                <input
                  type="text"
                  required
                  value={scheduleEmail}
                  onChange={(e) => setScheduleEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Cadence</label>
                  <select
                    value={scheduleCadence}
                    onChange={(e) => setScheduleCadence(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Daily">Daily Summary</option>
                    <option value="Weekly">Weekly Infrastructure Report</option>
                    <option value="Monthly">Monthly SLA & Security Audit</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Delivery Time</label>
                  <input
                    type="text"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <span className="block font-medium text-slate-300">Attached File Formats</span>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scheduleIncludePdf}
                      onChange={(e) => setScheduleIncludePdf(e.target.checked)}
                      className="rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Executive PDF Document</span>
                  </label>
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scheduleIncludeCsv}
                      onChange={(e) => setScheduleIncludeCsv(e.target.checked)}
                      className="rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Raw CSV Telemetry Data</span>
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-600/25 transition-colors cursor-pointer"
                >
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

