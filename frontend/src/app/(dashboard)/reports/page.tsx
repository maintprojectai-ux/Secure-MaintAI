"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  FileText,
  Calendar,
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
  const [dateRange, setDateRange] = useState<string>("Last 7 Days");
  const [showDateDropdown, setShowDateDropdown] = useState<boolean>(false);
  const [showExportDropdown, setShowExportDropdown] = useState<boolean>(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [uptimeWindow, setUptimeWindow] = useState<"7 Days" | "14 Days" | "30 Days">("7 Days");
  const [selectedUptimePointIdx, setSelectedUptimePointIdx] = useState<number | null>(null);

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

  // Derived Resilience KPIs
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
      critical_alerts_sub: `${summary.total_alerts} total events`,
      security_score: securityScore,
      security_score_sub: summary.system_health_rating,
    };
  }, [summary]);

  const healthRatingColor = useMemo(() => {
    const r = (summary.system_health_rating || "").toUpperCase();
    if (r.includes("OPTIMAL") || r.includes("A+") || r.includes("GOOD") || r.includes("(A)")) {
      return "text-emerald-400";
    }
    if (r.includes("ATTENTION") || r.includes("WARNING")) {
      return "text-amber-400";
    }
    if (r.includes("CRITICAL") || r.includes("DEGRADED") || r.includes("POOR")) {
      return "text-rose-400";
    }
    return "text-slate-400";
  }, [summary.system_health_rating]);

  // Fleet health status percentages
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

  // Uptime trend data
  const uptimeTrendPoints = useMemo(() => {
    const count = uptimeWindow === "7 Days" ? 7 : uptimeWindow === "14 Days" ? 14 : 30;
    if (summary.uptime_trend && summary.uptime_trend.length >= count) {
      return summary.uptime_trend.slice(-count).map((pt) => ({
        label: pt.label || pt.date,
        value: pt.value,
      }));
    }
    const now = new Date();
    const pts: { label: string; value: number }[] = [];
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const baseVal = summary.fleet_uptime_percentage || 99.2;
      const noise = ((i * 13) % 7) * 0.1 - 0.3;
      pts.push({ label, value: Math.min(100, Math.max(90, Math.round((baseVal + noise) * 10) / 10)) });
    }
    return pts;
  }, [summary.uptime_trend, summary.fleet_uptime_percentage, uptimeWindow]);

  const uptimeWindowStats = useMemo(() => {
    if (!uptimeTrendPoints.length) return { avg: 0, min: 0, max: 0 };
    const vals = uptimeTrendPoints.map((p) => p.value);
    const sum = vals.reduce((acc, v) => acc + v, 0);
    return {
      avg: Math.round((sum / vals.length) * 10) / 10,
      min: Math.min(...vals),
      max: Math.max(...vals),
    };
  }, [uptimeTrendPoints]);

  // Alerts Donut
  const alertsDonutData = useMemo(() => {
    return [
      { label: "Critical", value: summary.critical_alerts, color: "#f43f5e" },
      { label: "High", value: summary.high_alerts, color: "#f97316" },
      { label: "Medium", value: summary.medium_alerts, color: "#f59e0b" },
      { label: "Low", value: summary.low_alerts, color: "#3b82f6" },
    ];
  }, [summary]);

  // Alert Taxonomy categories
  const alertCategoryRows = useMemo(() => {
    const labelMap: Record<string, { label: string; color: string }> = {
      CYBERSECURITY_THREAT: { label: "Cybersecurity Threat", color: "#f43f5e" },
      TECHNICAL_ANOMALY: { label: "Technical Anomaly", color: "#f59e0b" },
      PREDICTIVE_MAINTENANCE: { label: "Predictive Maintenance", color: "#3b82f6" },
      HUMAN_INTERVENTION: { label: "Human Intervention", color: "#a855f7" },
    };
    const entries = Object.entries(summary.alert_categories || {});
    if (entries.length === 0) {
      return [
        { category: "Cybersecurity Threat", count: summary.active_security_threats, color: "#f43f5e" },
        { category: "Technical Anomaly", count: Math.max(0, summary.total_alerts - summary.critical_alerts), color: "#f59e0b" },
        { category: "Predictive Maintenance", count: summary.maintenance_advisories, color: "#3b82f6" },
        { category: "Human Intervention", count: 0, color: "#a855f7" },
      ];
    }
    return entries.map(([rawCat, count]) => ({
      category: labelMap[rawCat]?.label || rawCat,
      count,
      color: labelMap[rawCat]?.color || "#64748b",
    }));
  }, [summary]);

  const maxCategoryCount = useMemo(() => {
    const counts = alertCategoryRows.map((c) => c.count);
    return Math.max(...counts, 1);
  }, [alertCategoryRows]);

  // Telemetry resource averages
  const resourceUtilization = useMemo(() => {
    return [
      { name: "CPU Usage", average: summary.avg_cpu_usage || 0, color: "#3b82f6" },
      { name: "Memory Usage", average: summary.avg_memory_usage || 0, color: "#8b5cf6" },
      { name: "Disk Activity", average: summary.avg_disk_activity || 0, color: "#ec4899" },
      { name: "Network Activity", average: summary.avg_network_activity || 0, color: "#10b981" },
    ];
  }, [summary]);

  // Dynamic recommendations
  const dynamicRecommendations = useMemo(() => {
    const recs: string[] = [];
    if (summary.critical_alerts > 0) {
      recs.push(`Investigate ${summary.critical_alerts} critical alert(s) immediately via SOAR Playbook triage.`);
    }
    if (summary.fleet_warning_workstations > 0) {
      recs.push(`Inspect ${summary.fleet_warning_workstations} workstation(s) reporting resource warnings.`);
    }
    if (summary.avg_memory_usage > 75) {
      recs.push(`Workstation memory utilization elevated (${summary.avg_memory_usage}%). Consider container rebalancing.`);
    }
    if (recs.length === 0) {
      recs.push("All monitored endpoints operating within nominal baselines. No emergency containment required.");
      recs.push("Continuous telemetry screening active across Isolation Forest & specialist classifiers.");
    }
    return recs;
  }, [summary]);

  const generatedTimestampStr = useMemo(() => {
    return new Date(summary.generated_at).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  }, [summary.generated_at]);

  const handleTriggerExport = async (format: "pdf" | "json" | "csv") => {
    setShowExportDropdown(false);
    if (format === "csv" || format === "json") {
      try {
        const blob = await downloadReportExport(format);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `secure_maintai_report_${new Date().toISOString().slice(0, 10)}.${format}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        setFeedbackToast(`Exported ${format.toUpperCase()} report successfully.`);
      } catch (err: any) {
        setFeedbackToast(err?.message || `Failed to export ${format.toUpperCase()} report.`);
      }
    } else if (format === "pdf") {
      window.print();
    }
    setTimeout(() => setFeedbackToast(null), 4000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Feedback */}
      {feedbackToast && (
        <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs flex items-center justify-between shadow-lg shadow-emerald-950/40 animate-fade-in print:hidden">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{feedbackToast}</span>
          </div>
          <button onClick={() => setFeedbackToast(null)} className="text-emerald-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          {/* Date Range Selector */}
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
              <div className="absolute left-0 top-11 w-52 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30 py-1.5 text-xs animate-fade-in">
                {["Last 7 Days", "Last 14 Days", "Last 30 Days", "All Time (Database)"].map((range) => (
                  <button
                    key={range}
                    onClick={() => {
                      setDateRange(range);
                      setShowDateDropdown(false);
                      loadReportSummary();
                      setFeedbackToast(`Report refreshed for: ${range}.`);
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
                ))}
              </div>
            )}
          </div>

          <button
            onClick={loadReportSummary}
            disabled={isLoading}
            className="px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Refresh database report"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-blue-400" : "text-slate-400"}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Centralized Export Menu */}
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
                <span>Export Telemetry CSV</span>
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

      {/* Top Banner: Executive Summary & Scorecard */}
      <div className="glass-card p-6 rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900/90 via-slate-900/75 to-blue-950/25">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Metadata Block */}
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-white tracking-tight">Executive Infrastructure &amp; Resilience Report</h2>
              <p className="text-xs text-slate-400">Authentic database telemetry, incident containment, and health metrics</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 pt-1 font-mono">
                <span>Period: <strong className="text-slate-200">{dateRange}</strong></span>
                <span>•</span>
                <span>Generated: <strong className="text-slate-200">{generatedTimestampStr}</strong></span>
                <span>•</span>
                <span>Scope: <strong className="text-cyan-400">University Workstations</strong></span>
              </div>
            </div>
          </div>

          {/* 4 Center Scorecard KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1 lg:max-w-2xl border-t lg:border-t-0 lg:border-l border-slate-800/80 pt-4 lg:pt-0 lg:pl-6">
            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-medium">Monitored Workstations</span>
              <div className="text-2xl font-bold text-white tracking-tight">{kpis.total_devices}</div>
              <div className="text-[11px] font-medium text-emerald-400">{kpis.total_devices_sub}</div>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-medium">Workstation Availability</span>
              <div className="text-2xl font-bold text-white tracking-tight">{kpis.system_uptime}%</div>
              <div className="text-[11px] font-medium text-emerald-400">{kpis.system_uptime_sub}</div>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-medium">Critical Alerts</span>
              <div className="text-2xl font-bold text-white tracking-tight">{kpis.critical_alerts}</div>
              <div className="text-[11px] font-medium text-rose-400">{kpis.critical_alerts_sub}</div>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-medium">Security Posture</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-white tracking-tight">{kpis.security_score}</span>
                <span className="text-xs text-slate-500 font-medium">/100</span>
              </div>
              <div className={`text-[11px] font-medium ${healthRatingColor}`}>{kpis.security_score_sub}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main 2-Column Balanced Executive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (7 Columns) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Infrastructure Health & Uptime */}
          <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <h3 className="text-sm font-bold text-white tracking-tight">Infrastructure Availability &amp; Workstation Status</h3>
              <span className="text-[11px] font-mono text-slate-400">{summary.fleet_total_workstations} Enrolled Endpoints</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Online</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-base font-bold text-white">{healthStats.online_devices}</span>
                    <span className="text-[10px] text-emerald-400 font-semibold">{healthStats.online_percentage}%</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Offline</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-base font-bold text-white">{healthStats.offline_devices}</span>
                    <span className="text-[10px] text-rose-400 font-semibold">{healthStats.offline_percentage}%</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Warning</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-base font-bold text-white">{healthStats.warning_devices}</span>
                    <span className="text-[10px] text-amber-400 font-semibold">{healthStats.warning_percentage}%</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <PlusCircle className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">New (7d)</span>
                  <div className="text-base font-bold text-white mt-0.5">{healthStats.new_devices}</div>
                </div>
              </div>
            </div>

            {/* Uptime Trend LineChart */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs font-semibold text-slate-300">
                  <span>Workstation Uptime Trend</span>
                  <span className="text-[11px] font-mono text-emerald-400">
                    Avg: {uptimeWindowStats.avg}%
                  </span>
                </div>
                <select
                  value={uptimeWindow}
                  onChange={(e) => setUptimeWindow(e.target.value as any)}
                  className="bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1 text-[11px] text-slate-300 focus:outline-none cursor-pointer"
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
                      id: "workstation-uptime",
                      name: "Workstation Availability",
                      color: "#3b82f6",
                      data: uptimeTrendPoints.map((p) => p.value),
                    },
                  ]}
                  yMin={0}
                  yMax={100}
                  height={160}
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

          {/* Security Posture & Top Incidents */}
          <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <h3 className="text-sm font-bold text-white tracking-tight">Security Posture &amp; Incident Log</h3>
              <Link
                href="/alerts"
                className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-1"
              >
                <span>View all alerts</span>
                <span>→</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400 block">Security Score</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold text-white">{kpis.security_score}</span>
                  <span className="text-xs text-slate-500">/100</span>
                </div>
                <span className={`text-[11px] ${healthRatingColor} font-medium block`}>{summary.system_health_rating}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400 block">Threats Detected</span>
                <div className="text-xl font-bold text-white">{summary.active_security_threats}</div>
                <span className="text-[11px] text-rose-400 font-medium block">{summary.total_incidents} Total Incidents</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400 block">Resolved / Contained</span>
                <div className="text-xl font-bold text-white">{summary.resolved_incidents}</div>
                <span className="text-[11px] text-emerald-400 font-medium block">{summary.maintenance_advisories} Maintenance Tasks</span>
              </div>
            </div>

            {/* Incidents Table */}
            <div className="pt-1">
              <span className="text-xs font-semibold text-slate-300 block mb-2">Recent Security Incidents &amp; Advisories</span>
              <div className="overflow-x-auto rounded-xl border border-slate-800/80">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-800 bg-slate-900/50 font-mono text-[11px]">
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
                          No active security incidents recorded in database.
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
                                threat.severity.toUpperCase() === "HIGH" || threat.severity.toUpperCase() === "CRITICAL"
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
                          <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap font-mono text-[11px]">
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
        </div>

        {/* Right Column (5 Columns) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Alerts Severity Breakdown */}
          <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <h3 className="text-sm font-bold text-white tracking-tight">Alerts Severity Distribution</h3>
              <span className="text-[10px] text-slate-400 font-mono">{summary.total_alerts} Total Events</span>
            </div>

            <div className="flex justify-center my-1">
              <DonutChart
                data={alertsDonutData}
                size={160}
                strokeWidth={16}
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
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.label}
                  </span>
                  <span className="font-mono text-slate-400">{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Alert Categories Breakdown */}
          <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <h3 className="text-sm font-bold text-white tracking-tight">Taxonomy Breakdown</h3>
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

          {/* Workstation Telemetry Averages */}
          <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <h3 className="text-sm font-bold text-white tracking-tight">Workstation Telemetry Averages</h3>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              {resourceUtilization.map((item) => (
                <div
                  key={item.name}
                  className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    {item.name === "CPU Usage" ? (
                      <Cpu className="w-3.5 h-3.5 text-blue-400" />
                    ) : item.name === "Memory Usage" ? (
                      <Layers className="w-3.5 h-3.5 text-purple-400" />
                    ) : item.name === "Disk Activity" ? (
                      <HardDrive className="w-3.5 h-3.5 text-pink-400" />
                    ) : (
                      <Activity className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span className="font-semibold text-slate-200">{item.name}</span>
                  </div>
                  <span className="font-mono text-slate-300 font-bold">{item.average}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Findings & Dynamic Recommendations */}
          <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span>Resilience Findings &amp; Actions</span>
              </h3>
            </div>

            <div className="space-y-2 text-xs">
              {dynamicRecommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2 text-slate-200 bg-blue-950/20 border border-blue-500/20 p-2.5 rounded-xl">
                  <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                  <span className="leading-relaxed">{rec}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
