"use client";

import React, { useState, useMemo } from "react";
import {
  FileCode,
  Search,
  Filter,
  Download,
  Shield,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Calendar,
  Eye,
  RefreshCw,
  Terminal,
  Activity,
  Layers,
  ArrowUpDown,
  ExternalLink,
} from "lucide-react";
import { MOCK_FULL_AUDIT_LOGS } from "@/lib/api";
import { AuditLogEntry } from "@/types";
import { DonutChart } from "@/components/charts/DonutChart";
import { LineChart } from "@/components/charts/LineChart";
import { Modal } from "@/components/ui/Modal";

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>(MOCK_FULL_AUDIT_LOGS);
  const [activeTab, setActiveTab] = useState<"ALL" | "USER" | "SYSTEM" | "SECURITY" | "API" | "FAILURE">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  const logTrendData = [
    { label: "Sep 10", value: 3200 },
    { label: "Sep 11", value: 3600 },
    { label: "Sep 12", value: 2900 },
    { label: "Sep 13", value: 4100 },
    { label: "Sep 14", value: 3400 },
    { label: "Sep 15", value: 3850 },
    { label: "Sep 16", value: 3510 },
  ];

  const logOverviewDonut = [
    { label: "Info", value: 15682, color: "#3b82f6" },
    { label: "Success", value: 6245, color: "#10b981" },
    { label: "Warning", value: 1983, color: "#f59e0b" },
    { label: "Error", value: 650, color: "#ef4444" },
  ];

  const recentCriticalEvents = [
    { title: "Failed Login Attempt (Brute Force)", time: "04:30 AM", ip: "194.26.29.112", status: "FAILURE" },
    { title: "Trigger Surgical Isolation", time: "09:28 AM", ip: "10.0.1.5", status: "SUCCESS" },
    { title: "Automated Process Containment", time: "09:22 AM", ip: "127.0.0.1", status: "SUCCESS" },
  ];

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

  const handleExport = (format: "csv" | "json") => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setExportFeedback(`Exported ${filteredLogs.length} audit records as audit_logs_${Date.now()}.${format}`);
      setTimeout(() => setExportFeedback(null), 3500);
    }, 800);
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
          <p className="text-2xl font-bold text-white mt-1">24,560</p>
          <p className="text-[11px] text-emerald-400 mt-1 font-mono">+1,240 last 7d</p>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Info Events</span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-400">
              <Info className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-blue-400 mt-1">15,682</p>
          <p className="text-[11px] text-slate-400 mt-1 font-mono">63.8% of volume</p>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Success Operations</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-1">6,245</p>
          <p className="text-[11px] text-emerald-400 mt-1 font-mono">25.4% of volume</p>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Warnings</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-400 mt-1">1,983</p>
          <p className="text-[11px] text-amber-400 mt-1 font-mono">8.1% of volume</p>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Errors & Lockouts</span>
            <div className="w-7 h-7 rounded-lg bg-rose-500/15 flex items-center justify-center text-rose-400">
              <XCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-rose-400 mt-1">650</p>
          <p className="text-[11px] text-rose-400 mt-1 font-mono">2.7% error rate</p>
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
                  {filteredLogs.map((log) => (
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
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs text-slate-400">
              <span>Showing 1 to {filteredLogs.length} of {filteredLogs.length} records</span>
              <div className="flex items-center gap-1">
                <button className="px-2.5 py-1 rounded bg-brand-blue text-white font-medium">1</button>
                <button className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300">2</button>
                <button className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300">3</button>
                <button className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300">Next</button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Donut, Trend, Critical events */}
        <div className="lg:col-span-4 space-y-6">
          {/* Logs Volume Overview Donut */}
          <div className="glass-card p-5">
            <h3 className="text-base font-semibold text-white mb-1">Logs Distribution</h3>
            <p className="text-xs text-slate-400 mb-4">Volume grouped by event level</p>

            <div className="flex justify-center my-2">
              <DonutChart
                data={logOverviewDonut}
                size={170}
                strokeWidth={18}
                centerLabel="24.5k"
                centerSub="Total Logs"
              />
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400" /> Info
                </span>
                <span className="font-mono text-slate-400">63.8% (15,682)</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> Success
                </span>
                <span className="font-mono text-slate-400">25.4% (6,245)</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" /> Warning
                </span>
                <span className="font-mono text-slate-400">8.1% (1,983)</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-400" /> Error / Failures
                </span>
                <span className="font-mono text-slate-400">2.7% (650)</span>
              </div>
            </div>
          </div>

          {/* Logs Trend Chart */}
          <div className="glass-card p-5">
            <h3 className="text-base font-semibold text-white mb-1">Audit Ingestion Trend</h3>
            <p className="text-xs text-slate-400 mb-3">Daily log ingestion volume</p>
            <LineChart
              data={logTrendData}
              color="#8b5cf6"
              height={140}
              unit=" msgs"
            />
          </div>

          {/* Recent Critical Events Feed */}
          <div className="glass-card p-5">
            <h3 className="text-base font-semibold text-white mb-1">Recent Security Audits</h3>
            <p className="text-xs text-slate-400 mb-3">High-priority compliance events</p>

            <div className="space-y-2.5">
              {recentCriticalEvents.map((evt, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800 text-xs flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-rose-400 shrink-0" />
                    <div>
                      <p className="text-slate-200 font-medium">{evt.title}</p>
                      <p className="text-[11px] text-slate-500 font-mono">IP: {evt.ip}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">{evt.time}</span>
                </div>
              ))}
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
                <span className="font-mono text-slate-200">{selectedLog.id}</span>
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

            <div>
              <span className="text-slate-400 font-medium block mb-1">Verification Hash (SHA-256)</span>
              <div className="p-2 rounded bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-400 break-all">
                e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
              </div>
            </div>

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
