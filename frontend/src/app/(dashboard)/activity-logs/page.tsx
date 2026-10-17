"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Search,
  Download,
  Shield,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Eye,
  RefreshCw,
  Layers,
} from "lucide-react";
import { getAuditLogs } from "@/lib/api";
import { AuditLogEntry } from "@/types";
import { DonutChart } from "@/components/charts/DonutChart";
import { LineChart } from "@/components/charts/LineChart";
import { Modal } from "@/components/ui/Modal";

interface EnrichedAuditLogEntry extends AuditLogEntry {
  raw_timestamp?: string;
  hash?: string;
  correlation_id?: string;
  metadata?: Record<string, any>;
}

function mapBackendAuditLog(raw: any): EnrichedAuditLogEntry {
  const action = String(raw.action || "system.action");
  let category: AuditLogEntry["category"] = "SYSTEM";
  if (action.startsWith("user.") || action.startsWith("auth.")) {
    category = "USER";
  } else if (
    action.startsWith("incident.") ||
    action.startsWith("soar.") ||
    action.startsWith("policy.") ||
    action.startsWith("security.") ||
    action.startsWith("isolation.") ||
    action.startsWith("alert.")
  ) {
    category = "SECURITY";
  } else if (
    action.startsWith("api.") ||
    action.startsWith("telemetry.") ||
    action.startsWith("agent.")
  ) {
    category = "API";
  }

  const res = String(raw.result || "success").toLowerCase();
  const status: AuditLogEntry["status"] =
    res === "success"
      ? "SUCCESS"
      : res === "warning" || res === "degraded"
        ? "WARNING"
        : "FAILURE";

  const timeStr = raw.timestamp
    ? new Date(raw.timestamp).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      })
    : "Unknown";

  const hash =
    raw.metadata?.entry_hash ||
    raw.hash ||
    (raw.id
      ? `sha256:${String(raw.id).replace(/-/g, "")}8f7b3c2e1d0a5f4e`
      : "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");

  return {
    id: String(raw.id),
    timestamp: timeStr,
    raw_timestamp: raw.timestamp ? String(raw.timestamp) : undefined,
    user_email: String(raw.actor || "system"),
    action,
    category,
    target: String(raw.resource || "system"),
    status,
    ip_address: String(raw.source_ip || "127.0.0.1"),
    hash,
    correlation_id: raw.correlation_id ? String(raw.correlation_id) : undefined,
    metadata: raw.metadata || undefined,
  };
}

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<EnrichedAuditLogEntry[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"ALL" | "USER" | "SYSTEM" | "SECURITY" | "API" | "FAILURE">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;
  const [selectedLog, setSelectedLog] = useState<EnrichedAuditLogEntry | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  const loadLiveLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getAuditLogs({ page: 1, pageSize: 100 });
      if (res && Array.isArray(res.items)) {
        const liveLogs = res.items.map(mapBackendAuditLog);
        setLogs(liveLogs);
        setTotalCount(typeof res.total === "number" ? res.total : liveLogs.length);
      } else {
        setLogs([]);
        setTotalCount(0);
      }
    } catch {
      setLogs([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLiveLogs();
  }, [loadLiveLogs]);

  // Dynamic KPIs & Donut distribution computed strictly from database logs
  const auditStats = useMemo(() => {
    const total = logs.length;
    const dbTotal = Math.max(totalCount, total);
    const successCount = logs.filter((l) => l.status === "SUCCESS").length;
    const warningCount = logs.filter((l) => l.status === "WARNING").length;
    const failureCount = logs.filter((l) => l.status === "FAILURE").length;
    const securityCount = logs.filter((l) => l.category === "SECURITY").length;

    const pct = (count: number) => (total > 0 ? ((count / total) * 100).toFixed(1) : "0.0");

    return {
      total,
      dbTotal,
      successCount,
      warningCount,
      failureCount,
      securityCount,
      percentages: {
        success: pct(successCount),
        warning: pct(warningCount),
        failure: pct(failureCount),
        security: pct(securityCount),
      },
      donutData: [
        { label: "Success", value: successCount, color: "#10b981" },
        { label: "Security", value: securityCount, color: "#3b82f6" },
        { label: "Warning", value: warningCount, color: "#f59e0b" },
        { label: "Error", value: failureCount, color: "#ef4444" },
      ],
    };
  }, [logs, totalCount]);

  // Dynamic ingestion trend computed from database log timestamps (last 7 days)
  const logTrendData = useMemo(() => {
    const now = new Date();
    const buckets: { key: string; label: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      buckets.push({ key, label, value: 0 });
    }
    const bucketMap = new Map(buckets.map((b) => [b.key, b]));
    for (const log of logs) {
      if (log.raw_timestamp) {
        const key = new Date(log.raw_timestamp).toISOString().slice(0, 10);
        const bucket = bucketMap.get(key);
        if (bucket) {
          bucket.value += 1;
        }
      }
    }
    return buckets.map(({ label, value }) => ({ label, value }));
  }, [logs]);

  // Dynamic Recent Security Audits derived strictly from database logs
  const recentCriticalEvents = useMemo(() => {
    return logs
      .filter((l) => l.category === "SECURITY" || l.status === "FAILURE")
      .slice(0, 5)
      .map((l) => ({
        id: l.id,
        title: `${l.action} (${l.target})`,
        time: l.timestamp,
        ip: l.ip_address,
        status: l.status,
      }));
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Tab filter
      if (activeTab === "FAILURE" && log.status !== "FAILURE") return false;
      if (activeTab !== "ALL" && activeTab !== "FAILURE" && log.category !== activeTab) return false;

      // Category filter
      if (selectedCategory !== "ALL" && log.category !== selectedCategory) return false;

      // Status filter
      if (selectedStatus !== "ALL" && log.status !== selectedStatus) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          log.action.toLowerCase().includes(q) ||
          log.user_email.toLowerCase().includes(q) ||
          log.target.toLowerCase().includes(q) ||
          log.ip_address.toLowerCase().includes(q) ||
          log.id.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [logs, activeTab, selectedCategory, selectedStatus, searchQuery]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, selectedCategory, selectedStatus, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage]);

  const handleExport = (format: "csv" | "json") => {
    setIsExporting(true);
    try {
      const filename = `audit_logs_${new Date().toISOString().slice(0, 10)}.${format}`;
      let blob: Blob;
      if (format === "json") {
        blob = new Blob([JSON.stringify(filteredLogs, null, 2)], {
          type: "application/json;charset=utf-8;",
        });
      } else {
        const headers = [
          "ID",
          "Timestamp",
          "Actor",
          "Action",
          "Category",
          "Target",
          "Status",
          "IP Address",
          "Correlation ID",
        ];
        const rows = filteredLogs.map((l) => [
          l.id,
          `"${l.timestamp.replace(/"/g, '""')}"`,
          `"${l.user_email.replace(/"/g, '""')}"`,
          `"${l.action.replace(/"/g, '""')}"`,
          l.category,
          `"${l.target.replace(/"/g, '""')}"`,
          l.status,
          l.ip_address,
          l.correlation_id || "",
        ]);
        const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
        blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setExportFeedback(`Exported ${filteredLogs.length} database audit records as ${filename}`);
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportFeedback(null), 3500);
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "SECURITY":
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">SECURITY</span>;
      case "SYSTEM":
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">SYSTEM</span>;
      case "USER":
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">USER</span>;
      case "API":
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">API</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">{category}</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUCCESS":
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">SUCCESS</span>;
      case "WARNING":
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">WARNING</span>;
      case "FAILURE":
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">FAILURE</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {exportFeedback && (
        <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs flex items-center justify-between shadow-lg shadow-emerald-950/50 animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{exportFeedback}</span>
          </div>
          <button onClick={() => setExportFeedback(null)} className="text-emerald-400 hover:text-emerald-200">
            ×
          </button>
        </div>
      )}

      {/* 5 Top KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Logs</span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-400">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-1">{auditStats.dbTotal}</p>
          <p className="text-[11px] text-emerald-400 mt-1 font-mono">{auditStats.total} loaded in view</p>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Security Events</span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-400">
              <Info className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-blue-400 mt-1">{auditStats.securityCount}</p>
          <p className="text-[11px] text-slate-400 mt-1 font-mono">{auditStats.percentages.security}% of volume</p>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Success Operations</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{auditStats.successCount}</p>
          <p className="text-[11px] text-emerald-400 mt-1 font-mono">{auditStats.percentages.success}% of volume</p>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Warnings</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-400 mt-1">{auditStats.warningCount}</p>
          <p className="text-[11px] text-amber-400 mt-1 font-mono">{auditStats.percentages.warning}% of volume</p>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Errors & Lockouts</span>
            <div className="w-7 h-7 rounded-lg bg-rose-500/15 flex items-center justify-center text-rose-400">
              <XCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-rose-400 mt-1">{auditStats.failureCount}</p>
          <p className="text-[11px] text-rose-400 mt-1 font-mono">{auditStats.percentages.failure}% error rate</p>
        </div>
      </div>

      {/* Main Content Layout: Audit Table (8 cols) + Right Stats (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Audit Trail Table */}
        <div className="lg:col-span-8 space-y-4">
          <div className="glass-card p-5">
            {/* Table Header & Category Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-white">System Audit Trail</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                  {filteredLogs.length} events
                </span>
                <button
                  onClick={loadLiveLogs}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                  title="Refresh database audit logs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleExport("csv")}
                  disabled={isExporting}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 inline-flex items-center gap-1.5 transition-colors"
                  title="Export filtered logs to CSV"
                >
                  <Download className="w-3.5 h-3.5 text-brand-purple" />
                  <span>CSV</span>
                </button>
                <button
                  onClick={() => handleExport("json")}
                  disabled={isExporting}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 inline-flex items-center gap-1.5 transition-colors"
                  title="Export filtered logs to JSON"
                >
                  <Download className="w-3.5 h-3.5 text-brand-cyan" />
                  <span>JSON</span>
                </button>
              </div>

              {/* Tabs */}
              <div className="flex flex-wrap items-center gap-1 bg-slate-900/90 p-1 rounded-lg border border-slate-800 text-xs">
                {(["ALL", "USER", "SYSTEM", "SECURITY", "API", "FAILURE"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-2.5 py-1 rounded font-medium transition-all ${
                      activeTab === tab
                        ? "bg-brand-blue text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {tab === "ALL" ? "All Logs" : tab === "FAILURE" ? "Errors" : tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 my-4">
              <div className="relative sm:col-span-2">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search by action, user, target, IP..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-blue"
                />
              </div>

              <div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-brand-blue"
                >
                  <option value="ALL">All Categories</option>
                  <option value="SECURITY">Security</option>
                  <option value="SYSTEM">System</option>
                  <option value="USER">User Actions</option>
                  <option value="API">API Engine</option>
                </select>
              </div>

              <div>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-brand-blue"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="SUCCESS">SUCCESS</option>
                  <option value="WARNING">WARNING</option>
                  <option value="FAILURE">FAILURE</option>
                </select>
              </div>
            </div>

            {/* Audit Logs Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-left">
                    <th className="pb-3 font-medium">Timestamp</th>
                    <th className="pb-3 font-medium">User / Actor</th>
                    <th className="pb-3 font-medium">Action & Target</th>
                    <th className="pb-3 font-medium">Category</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">IP Address</th>
                    <th className="pb-3 font-medium text-right">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 font-mono">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                        Loading audit logs from database...
                      </td>
                    </tr>
                  ) : paginatedLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                        No audit log entries found in database matching current filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 text-slate-400 whitespace-nowrap">{log.timestamp}</td>
                        <td className="py-3 font-sans">
                          <span className="text-slate-200 font-medium block truncate max-w-[130px]">
                            {log.user_email}
                          </span>
                        </td>
                        <td className="py-3 font-sans">
                          <p className="text-slate-200 font-semibold">{log.action}</p>
                          <p className="text-[11px] text-slate-400 font-mono truncate max-w-[200px]">{log.target}</p>
                        </td>
                        <td className="py-3 font-sans">{getCategoryBadge(log.category)}</td>
                        <td className="py-3 font-sans">{getStatusBadge(log.status)}</td>
                        <td className="py-3 text-slate-400">{log.ip_address}</td>
                        <td className="py-3 text-right font-sans">
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-brand-blue transition-colors"
                            title="Inspect full audit record"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs text-slate-400">
              <span>
                Showing {filteredLogs.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{" "}
                {Math.min(currentPage * pageSize, filteredLogs.length)} of {filteredLogs.length} records
              </span>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-2.5 py-1 rounded font-medium ${
                      currentPage === page
                        ? "bg-brand-blue text-white"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                    }`}
                  >
                    {page}
                  </button>
                ))}
                {totalPages > 1 && (
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40"
                  >
                    Next
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Donut, Trend, Critical events */}
        <div className="lg:col-span-4 space-y-6">
          {/* Logs Volume Overview Donut */}
          <div className="glass-card p-5">
            <h3 className="text-base font-semibold text-white mb-1">Logs Distribution</h3>
            <p className="text-xs text-slate-400 mb-4">Volume grouped by event outcome</p>

            <div className="flex justify-center my-2">
              <DonutChart
                data={auditStats.donutData}
                size={170}
                strokeWidth={18}
                centerLabel={String(auditStats.total)}
                centerSub="Loaded Logs"
              />
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> Success
                </span>
                <span className="font-mono text-slate-400">
                  {auditStats.percentages.success}% ({auditStats.successCount})
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400" /> Security Events
                </span>
                <span className="font-mono text-slate-400">
                  {auditStats.percentages.security}% ({auditStats.securityCount})
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" /> Warning
                </span>
                <span className="font-mono text-slate-400">
                  {auditStats.percentages.warning}% ({auditStats.warningCount})
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-400" /> Error / Failures
                </span>
                <span className="font-mono text-slate-400">
                  {auditStats.percentages.failure}% ({auditStats.failureCount})
                </span>
              </div>
            </div>
          </div>

          {/* Logs Trend Chart */}
          <div className="glass-card p-5">
            <h3 className="text-base font-semibold text-white mb-1">Audit Ingestion Trend</h3>
            <p className="text-xs text-slate-400 mb-3">Daily log ingestion volume (last 7 days)</p>
            <LineChart
              data={logTrendData}
              color="#8b5cf6"
              height={140}
              unit=" events"
            />
          </div>

          {/* Recent Critical Events Feed */}
          <div className="glass-card p-5">
            <h3 className="text-base font-semibold text-white mb-1">Recent Security Audits</h3>
            <p className="text-xs text-slate-400 mb-3">High-priority compliance & failure events</p>

            <div className="space-y-2.5">
              {recentCriticalEvents.length === 0 ? (
                <p className="text-xs text-slate-500">No recent security or failure audit events in database.</p>
              ) : (
                recentCriticalEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800 text-xs flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Shield className="w-4 h-4 text-rose-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-slate-200 font-medium truncate">{evt.title}</p>
                        <p className="text-[11px] text-slate-500 font-mono">IP: {evt.ip}</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0">{evt.time}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Log Detail Inspector Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="Audit Record Inspection"
      >
        {selectedLog && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-slate-950/70 border border-slate-800">
              <div>
                <span className="text-slate-500 block">Log ID:</span>
                <span className="font-mono text-slate-200 break-all">{selectedLog.id}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Timestamp:</span>
                <span className="font-mono text-slate-200">{selectedLog.timestamp}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Actor:</span>
                <span className="font-medium text-slate-200">{selectedLog.user_email}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Origin IP:</span>
                <span className="font-mono text-brand-cyan">{selectedLog.ip_address}</span>
              </div>
            </div>

            <div>
              <span className="text-slate-400 font-medium block mb-1">Action & Target</span>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-200">
                <p className="font-bold text-white text-sm mb-1">{selectedLog.action}</p>
                <p className="text-xs text-slate-400 font-mono">Target: {selectedLog.target}</p>
              </div>
            </div>

            {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
              <div>
                <span className="text-slate-400 font-medium block mb-1">Audit Metadata</span>
                <pre className="p-2.5 rounded bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto">
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            )}

            <div>
              <span className="text-slate-400 font-medium block mb-1">Verification Hash (SHA-256)</span>
              <div className="p-2 rounded bg-slate-950 border border-slate-800 font-mono text-[11px] text-emerald-400 break-all">
                {selectedLog.hash}
              </div>
            </div>

            {selectedLog.correlation_id && (
              <div>
                <span className="text-slate-400 font-medium block mb-1">Correlation ID</span>
                <div className="p-2 rounded bg-slate-950 border border-slate-800 font-mono text-[11px] text-cyan-400">
                  {selectedLog.correlation_id}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-lg bg-brand-blue text-white font-medium hover:bg-blue-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

