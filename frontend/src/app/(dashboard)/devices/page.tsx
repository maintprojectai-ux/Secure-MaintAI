"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Server,
  Monitor,
  Network,
  HardDrive,
  Download,
  Search,
  RotateCw,
  Eye,
  Edit,
  Shield,
  RotateCcw,
  AlertTriangle,
  AlertCircle,
  Power,
  CheckCircle2,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import {
  getWorkstations,
  updateWorkstation,
  isolateWorkstation,
  rollbackWorkstationIsolation,
} from "@/lib/api";

interface DeviceItem {
  id: string;
  name: string;
  model: string;
  category: "server" | "desktop" | "switch" | "storage";
  ip: string;
  type: string;
  department: string;
  lab: string;
  location: string;
  rack: string;
  status: "Online" | "Warning" | "Critical" | "Isolated" | "Offline" | "Maintenance" | "Decommissioned";
  rawStatus: string;
  cpu: number | null;
  memory: number | null;
  disk: number | null;
  lastSeen: string;
  is_isolated?: boolean;
  mac_address?: string | null;
  asset_tag?: string | null;
  hardware_specs?: Record<string, unknown> | null;
}

interface EditFormState {
  id: string;
  name: string;
  ip: string;
  type: string;
  department: string;
  lab: string;
  asset_tag: string;
  status: string;
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [totalDevicesCount, setTotalDevicesCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState(() => {
    if (typeof window !== "undefined") {
      const statusParam = (new URLSearchParams(window.location.search).get("status") || "").toUpperCase();
      if (
        ["ONLINE", "WARNING", "CRITICAL", "ISOLATED", "OFFLINE", "MAINTENANCE", "DECOMMISSIONED"].includes(
          statusParam
        )
      ) {
        return statusParam;
      }
    }
    return "ALL";
  });
  const [selectedType, setSelectedType] = useState("ALL");
  const [selectedLocation, setSelectedLocation] = useState("ALL");
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const statusParam = (new URLSearchParams(window.location.search).get("status") || "").toUpperCase();
      if (
        ["ONLINE", "WARNING", "CRITICAL", "ISOLATED", "OFFLINE", "MAINTENANCE", "DECOMMISSIONED"].includes(
          statusParam
        )
      ) {
        setSelectedStatus(statusParam);
      }
    }
  }, []);

  // Action & Modal States
  const [isolationTarget, setIsolationTarget] = useState<DeviceItem | null>(null);
  const [isIsolating, setIsIsolating] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<EditFormState | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const loadLiveWorkstations = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getWorkstations({
        page: currentPage,
        pageSize,
        search: searchQuery.trim() || undefined,
        status: selectedStatus !== "ALL" ? selectedStatus : undefined,
      });

      if (res && res.items) {
        const mapped: DeviceItem[] = res.items.map((w) => {
          const isServer =
            (w.operating_system || "").toLowerCase().includes("server") ||
            (w.hostname || "").toLowerCase().includes("srv") ||
            (w.hostname || "").toLowerCase().includes("hpc");

          const statusMap: Record<
            string,
            "Online" | "Warning" | "Critical" | "Isolated" | "Offline" | "Maintenance" | "Decommissioned"
          > = {
            ONLINE: "Online",
            OFFLINE: "Offline",
            WARNING: "Warning",
            CRITICAL: "Critical",
            ISOLATED: "Isolated",
            MAINTENANCE: "Maintenance",
            DECOMMISSIONED: "Decommissioned",
          };
          const mappedStatus = statusMap[w.status] || "Online";

          let lastSeenStr = "Active";
          if (w.last_seen_at) {
            const diffMs = Date.now() - new Date(w.last_seen_at).getTime();
            const diffSec = Math.floor(diffMs / 1000);
            if (diffSec < 60) lastSeenStr = `${diffSec}s ago`;
            else if (diffSec < 3600) lastSeenStr = `${Math.floor(diffSec / 60)}m ago`;
            else if (diffSec < 86400) lastSeenStr = `${Math.floor(diffSec / 3600)}h ago`;
            else lastSeenStr = `${Math.floor(diffSec / 86400)}d ago`;
          }

          const dept = w.department || "Academic Infrastructure";
          const lab = w.lab || "Main Bay";
          const loc = `${dept} • ${lab}`;

          return {
            id: w.id,
            name: w.hostname,
            model:
              (w.hardware_specs?.processor as string) ||
              (isServer ? "HPC / Compute Node" : "Standard Workstation"),
            category: isServer ? "server" : "desktop",
            ip: w.ip_address,
            type: w.operating_system || "Linux Workstation",
            department: w.department || "",
            lab: w.lab || "",
            location: loc,
            rack: w.asset_tag || "Standard Asset",
            status: mappedStatus,
            rawStatus: w.status,
            cpu: w.cpu_usage ?? 0,
            memory: w.memory_usage ?? 0,
            disk: w.disk_usage ?? 0,
            lastSeen: lastSeenStr,
            is_isolated: w.status === "ISOLATED",
            mac_address: w.mac_address,
            asset_tag: w.asset_tag,
            hardware_specs: w.hardware_specs as Record<string, unknown> | null,
          };
        });

        setDevices(mapped);
        setTotalDevicesCount(res.total);
        setTotalPages(res.total_pages || 1);
      }
    } catch (err) {
      console.error("Failed to load workstations:", err);
    } finally {
      setIsLoading(false);
      setInitialLoading(false);
    }
  }, [currentPage, pageSize, searchQuery, selectedStatus]);

  useEffect(() => {
    loadLiveWorkstations();
  }, [loadLiveWorkstations, refreshIndex]);

  // Derived KPI metrics
  const total = totalDevicesCount || devices.length;
  const onlineCount = devices.filter((d) => d.rawStatus === "ONLINE").length;
  const warningCount = devices.filter((d) => d.rawStatus === "WARNING").length;
  const criticalCount = devices.filter(
    (d) => d.rawStatus === "CRITICAL" || d.rawStatus === "ISOLATED" || d.rawStatus === "COMPROMISED"
  ).length;
  const offlineCount = devices.filter(
    (d) => d.rawStatus === "OFFLINE" || d.rawStatus === "MAINTENANCE" || d.rawStatus === "DECOMMISSIONED"
  ).length;

  const kpiCards = [
    {
      title: "Total Workstations",
      value: total,
      delta: `${total} enrolled workstations`,
      deltaColor: "text-blue-400",
      icon: <Monitor className="w-5 h-5 text-blue-400" />,
      iconBg: "bg-blue-600/20 border-blue-500/30",
    },
    {
      title: "Online & Healthy",
      value: onlineCount,
      delta: "Normal operational telemetry",
      deltaColor: "text-emerald-400",
      icon: (
        <div className="relative flex items-center justify-center">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>
      ),
      iconBg: "bg-emerald-600/20 border-emerald-500/30",
    },
    {
      title: "Warning",
      value: warningCount,
      delta: "Elevated compute or disk load",
      deltaColor: "text-amber-400",
      icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
      iconBg: "bg-amber-600/20 border-amber-500/30",
    },
    {
      title: "Critical / Isolated",
      value: criticalCount,
      delta: "Automated SOAR quarantine active",
      deltaColor: "text-rose-400",
      icon: <AlertCircle className="w-5 h-5 text-rose-400" />,
      iconBg: "bg-rose-600/20 border-rose-500/30",
    },
    {
      title: "Offline / Maint",
      value: offlineCount,
      delta: "Unreachable / servicing",
      deltaColor: "text-slate-400",
      icon: <Power className="w-5 h-5 text-slate-400" />,
      iconBg: "bg-slate-700/30 border-slate-600/40",
    },
  ];

  const availableLocations = useMemo(() => {
    const locs = new Set<string>();
    devices.forEach((d) => {
      if (d.department) locs.add(d.department);
      if (d.lab) locs.add(d.lab);
    });
    return Array.from(locs);
  }, [devices]);

  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      if (selectedType !== "ALL" && !d.type.toLowerCase().includes(selectedType.toLowerCase())) {
        return false;
      }
      if (
        selectedLocation !== "ALL" &&
        !d.location.toLowerCase().includes(selectedLocation.toLowerCase()) &&
        !d.department.toLowerCase().includes(selectedLocation.toLowerCase()) &&
        !d.lab.toLowerCase().includes(selectedLocation.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [devices, selectedType, selectedLocation]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedDevices(filteredDevices.map((d) => d.id));
    } else {
      setSelectedDevices([]);
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedDevices((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleOpenEditModal = (device: DeviceItem) => {
    setEditingDevice({
      id: device.id,
      name: device.name,
      ip: device.ip,
      type: device.type,
      department: device.department,
      lab: device.lab,
      asset_tag: device.asset_tag || "",
      status: device.rawStatus || "ONLINE",
    });
    setEditError(null);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDevice) return;

    setIsSubmittingEdit(true);
    setEditError(null);

    try {
      await updateWorkstation(editingDevice.id, {
        department: editingDevice.department || null,
        lab: editingDevice.lab || null,
        asset_tag: editingDevice.asset_tag || null,
        status: editingDevice.status || null,
      });

      setActionSuccessMessage(
        `Workstation ${editingDevice.name} configuration updated successfully!`
      );
      setIsEditModalOpen(false);
      setEditingDevice(null);
      setRefreshIndex((p) => p + 1);

      setTimeout(() => setActionSuccessMessage(null), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update workstation configuration";
      setEditError(msg);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const confirmIsolation = async () => {
    if (!isolationTarget) return;

    setIsIsolating(true);
    try {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(isolationTarget.id);

      if (isUuid) {
        if (isolationTarget.is_isolated) {
          await rollbackWorkstationIsolation(isolationTarget.id);
        } else {
          await isolateWorkstation(isolationTarget.id);
        }
      }

      setDevices((prev) =>
        prev.map((d) =>
          d.id === isolationTarget.id
            ? {
                ...d,
                is_isolated: !d.is_isolated,
                status: !d.is_isolated ? "Isolated" : "Online",
                rawStatus: !d.is_isolated ? "ISOLATED" : "ONLINE",
              }
            : d
        )
      );

      const actionText = isolationTarget.is_isolated
        ? `Surgical network isolation rolled back for ${isolationTarget.name}. Normal telemetry restored.`
        : `Surgical network containment enforced on ${isolationTarget.name}. Host OS kept running; unauthorized C2 sockets severed.`;

      setActionSuccessMessage(actionText);
      setIsolationTarget(null);
      setTimeout(() => setActionSuccessMessage(null), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      setActionSuccessMessage(`Isolation action failed: ${msg}`);
      setTimeout(() => setActionSuccessMessage(null), 5000);
    } finally {
      setIsIsolating(false);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      "ID",
      "Name",
      "Model",
      "Type",
      "IP Address",
      "Location",
      "Asset Tag",
      "Status",
      "CPU",
      "Memory",
      "Disk",
      "Last Seen",
    ];
    const rows = filteredDevices.map((d) => [
      d.id,
      d.name,
      `"${d.model}"`,
      d.type,
      d.ip,
      `"${d.location}"`,
      `"${d.rack}"`,
      d.status,
      d.cpu ?? "N/A",
      d.memory ?? "N/A",
      d.disk ?? "N/A",
      d.lastSeen,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `workstations_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderCategoryIcon = (category: string) => {
    switch (category) {
      case "server":
        return <Server className="w-4 h-4 text-blue-400 flex-shrink-0" />;
      case "switch":
        return <Network className="w-4 h-4 text-cyan-400 flex-shrink-0" />;
      case "storage":
        return <HardDrive className="w-4 h-4 text-purple-400 flex-shrink-0" />;
      default:
        return <Monitor className="w-4 h-4 text-blue-400 flex-shrink-0" />;
    }
  };

  const renderProgressBar = (value: number | null, colorTheme?: "amber" | "rose") => {
    if (value === null) {
      return <span className="text-slate-500 font-mono">—</span>;
    }

    let barColor = "bg-blue-500";
    if (colorTheme === "rose" || value > 85) barColor = "bg-rose-500";
    else if (colorTheme === "amber" || value > 60) barColor = "bg-amber-500";

    return (
      <div className="space-y-1 w-20">
        <span className="text-xs font-mono text-slate-300">{value}%</span>
        <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${value}%` }} />
        </div>
      </div>
    );
  };

  if (initialLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="glass-card p-4 h-24 border-slate-800 bg-[#091124]/90 rounded-2xl" />
          ))}
        </div>
        <div className="glass-card p-6 h-96 border-slate-800 bg-[#091124]/90 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Toast Feedback */}
      {actionSuccessMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between shadow-lg shadow-emerald-950/50 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{actionSuccessMessage}</span>
          </div>
          <button
            onClick={() => setActionSuccessMessage(null)}
            className="text-emerald-400 hover:text-emerald-200 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* Row 1: Top 5 Health KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {kpiCards.map((card, i) => (
          <div
            key={i}
            className="glass-card p-4 flex items-center justify-between border-slate-800/80 bg-[#091124]/90 shadow-lg"
          >
            <div>
              <p className="text-xs font-medium text-slate-400 tracking-wide">
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
          </div>
        ))}
      </div>

      {/* Row 2: Unified Filter Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-2 border-b border-slate-800/80">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search bar */}
          <div className="relative w-64 sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search hostname, IP, model..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-blue"
            />
          </div>

          {/* Status selector */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5 text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="ONLINE">Online</option>
            <option value="WARNING">Warning</option>
            <option value="CRITICAL">Critical</option>
            <option value="ISOLATED">Isolated</option>
            <option value="OFFLINE">Offline</option>
          </select>

          {/* OS/Type filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="text-xs bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5 text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="ALL">All Operating Systems</option>
            <option value="Linux">Linux</option>
            <option value="Windows">Windows</option>
            <option value="Ubuntu">Ubuntu</option>
            <option value="Server">Server</option>
          </select>

          {/* Location filter */}
          {availableLocations.length > 0 && (
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="text-xs bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5 text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="ALL">All Locations</option>
              {availableLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          )}

          {/* CSV Export */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3 py-1.5 rounded-xl border border-slate-700/80 bg-slate-900/60 hover:bg-slate-800 text-xs font-medium text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Export filtered records to CSV"
          >
            <Download className="w-3.5 h-3.5 text-purple-400" />
            <span>CSV</span>
          </button>
        </div>

        {/* Live sync pill & Refresh */}
        <div className="flex items-center gap-2.5 self-end lg:self-auto">
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/50 border border-emerald-500/30 px-2.5 py-1 rounded-xl flex items-center gap-1.5 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live Workstations ({total} Enrolled)
          </span>

          <button
            type="button"
            onClick={() => setRefreshIndex((p) => p + 1)}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-xl border border-slate-700/80 bg-slate-900/60 hover:bg-slate-800 text-xs font-medium text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 text-slate-400 ${isLoading ? "animate-spin text-blue-400" : ""}`} />
            <span>{isLoading ? "Syncing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* Row 3: Workstation Inventory Table */}
      <div className="glass-card border-slate-800/80 bg-[#091124]/90 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[11px] text-slate-400 border-b border-slate-800/80 bg-slate-900/40 select-none">
                <th className="py-3 px-3 w-8">
                  <input
                    type="checkbox"
                    checked={
                      filteredDevices.length > 0 &&
                      selectedDevices.length === filteredDevices.length
                    }
                    onChange={handleSelectAll}
                    className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-3 font-semibold text-slate-300">Hostname</th>
                <th className="py-3 px-3 font-semibold text-slate-300">IP Address</th>
                <th className="py-3 px-3 font-semibold text-slate-300">OS / Specs</th>
                <th className="py-3 px-3 font-semibold text-slate-300">Department &amp; Lab</th>
                <th className="py-3 px-3 font-semibold text-slate-300">Status</th>
                <th className="py-3 px-3 font-semibold text-slate-300">CPU Usage</th>
                <th className="py-3 px-3 font-semibold text-slate-300">Memory Usage</th>
                <th className="py-3 px-3 font-semibold text-slate-300">Disk Usage</th>
                <th className="py-3 px-3 font-semibold text-slate-300">Last Seen</th>
                <th className="py-3 px-3 font-semibold text-slate-300 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredDevices.map((device) => {
                const isSelected = selectedDevices.includes(device.id);
                return (
                  <tr
                    key={device.id}
                    className={`hover:bg-slate-800/30 transition-colors ${
                      isSelected ? "bg-blue-600/5" : ""
                    }`}
                  >
                    <td className="py-3 px-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectRow(device.id)}
                        className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0 cursor-pointer"
                      />
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-center flex-shrink-0">
                          {renderCategoryIcon(device.category)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/devices/${device.id}`}
                              className="font-bold text-white hover:text-blue-400 font-mono transition-colors"
                            >
                              {device.name}
                            </Link>
                            {device.is_isolated && (
                              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold">
                                ISOLATED
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 truncate max-w-[160px]">
                            {device.model}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                      {device.ip}
                    </td>

                    <td className="py-3 px-3 text-slate-300 whitespace-nowrap text-xs font-medium">
                      {device.type}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="text-xs text-slate-200 font-medium">{device.location}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{device.rack}</div>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            device.status === "Online"
                              ? "bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                              : device.status === "Warning"
                                ? "bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                                : device.status === "Critical"
                                  ? "bg-rose-400 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                                  : device.status === "Isolated" || device.status === "Maintenance"
                                    ? "bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.5)]"
                                    : "bg-slate-500"
                          }`}
                        />
                        <span
                          className={
                            device.status === "Online"
                              ? "text-emerald-400"
                              : device.status === "Warning"
                                ? "text-amber-400"
                                : device.status === "Critical"
                                  ? "text-rose-400"
                                  : device.status === "Isolated" || device.status === "Maintenance"
                                    ? "text-purple-400"
                                    : "text-slate-400"
                          }
                        >
                          {device.status}
                        </span>
                      </span>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      {renderProgressBar(
                        device.cpu,
                        device.status === "Critical"
                          ? "rose"
                          : device.status === "Warning"
                            ? "amber"
                            : undefined
                      )}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      {renderProgressBar(
                        device.memory,
                        device.status === "Critical"
                          ? "rose"
                          : device.status === "Warning"
                            ? "amber"
                            : undefined
                      )}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      {renderProgressBar(
                        device.disk,
                        device.status === "Critical"
                          ? "rose"
                          : device.status === "Warning"
                            ? "amber"
                            : undefined
                      )}
                    </td>

                    <td className="py-3 px-3 text-[11px] text-slate-400 whitespace-nowrap font-mono">
                      {device.lastSeen}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <Link
                          href={`/devices/${device.id}`}
                          title="Inspect Workstation Telemetry & Specs"
                          className="p-1.5 rounded-lg border border-slate-700/80 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-blue-400 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>

                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(device)}
                          title="Edit Configuration"
                          className="p-1.5 rounded-lg border border-slate-700/80 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsolationTarget(device)}
                          title={
                            device.is_isolated
                              ? "Rollback Surgical Isolation"
                              : "Execute Surgical Containment"
                          }
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                            device.is_isolated
                              ? "border-emerald-500/40 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30"
                              : "border-slate-700/80 bg-slate-900/60 text-slate-400 hover:text-rose-400 hover:border-rose-500/40"
                          }`}
                        >
                          {device.is_isolated ? (
                            <RotateCcw className="w-3.5 h-3.5" />
                          ) : (
                            <Shield className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {filteredDevices.length === 0 && (
          <div className="text-center py-16 px-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/70 border border-slate-700/60 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <Monitor className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-white">No workstations found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              {searchQuery || selectedStatus !== "ALL" || selectedLocation !== "ALL"
                ? "No workstations match the selected filters or search criteria. Try resetting filters."
                : "No workstations are enrolled in the platform yet. Deploy monitoring agents to begin streaming telemetry."}
            </p>
            {(searchQuery || selectedStatus !== "ALL" || selectedLocation !== "ALL") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedStatus("ALL");
                  setSelectedLocation("ALL");
                  setSelectedType("ALL");
                }}
                className="mt-4 px-3.5 py-1.5 rounded-xl border border-slate-700 bg-slate-800 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

        {/* Pagination Bar */}
        <div className="p-3.5 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 select-none">
          <div className="flex items-center gap-3">
            <span>
              Showing {filteredDevices.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{" "}
              {Math.min(currentPage * pageSize, totalDevicesCount)} of {totalDevicesCount} workstations
            </span>

            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-[11px] text-slate-500">Page size:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="text-[11px] bg-slate-900 border border-slate-800 rounded-lg px-2 py-0.5 text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value={10}>10 per page</option>
                <option value={20}>20 per page</option>
                <option value={50}>50 per page</option>
              </select>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white disabled:opacity-40 cursor-pointer"
              >
                &lt;
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCurrentPage(p)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                    p === currentPage
                      ? "bg-blue-600 text-white"
                      : "border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white disabled:opacity-40 cursor-pointer"
              >
                &gt;
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Edit Workstation Modal */}
      {isEditModalOpen && editingDevice && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingDevice(null);
          }}
          title={`Edit Configuration: ${editingDevice.name}`}
          subtitle="Update department routing, lab placement, asset identification, and operational state"
          maxWidth="lg"
        >
          <form onSubmit={handleSaveEdit} className="space-y-4 text-xs font-sans">
            {editError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60 flex items-center justify-between text-slate-400 font-mono text-[11px]">
              <div>
                <span className="text-slate-500">IP: </span>
                <span className="text-white">{editingDevice.ip}</span>
              </div>
              <div>
                <span className="text-slate-500">OS: </span>
                <span className="text-white">{editingDevice.type}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Department Assignment
                </label>
                <input
                  type="text"
                  list="department-options"
                  value={editingDevice.department}
                  onChange={(e) =>
                    setEditingDevice({ ...editingDevice, department: e.target.value })
                  }
                  placeholder="e.g. College of Computer Science"
                  className="w-full px-3 py-2 rounded-xl bg-[#091124] border border-slate-800 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 font-sans"
                />
                <datalist id="department-options">
                  <option value="College of Computer Science" />
                  <option value="College of Engineering" />
                  <option value="College of Science" />
                  <option value="Central IT Administration" />
                  <option value="University Data Center" />
                </datalist>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Lab / Room Location
                </label>
                <input
                  type="text"
                  value={editingDevice.lab}
                  onChange={(e) =>
                    setEditingDevice({ ...editingDevice, lab: e.target.value })
                  }
                  placeholder="e.g. AI Lab 3 or Room 204"
                  className="w-full px-3 py-2 rounded-xl bg-[#091124] border border-slate-800 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 font-sans"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Asset Tag (University Inventory)
                </label>
                <input
                  type="text"
                  value={editingDevice.asset_tag}
                  onChange={(e) =>
                    setEditingDevice({ ...editingDevice, asset_tag: e.target.value })
                  }
                  placeholder="e.g. KKU-ASSET-2026-042"
                  className="w-full px-3 py-2 rounded-xl bg-[#091124] border border-slate-800 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Operational Status
                </label>
                <select
                  value={editingDevice.status}
                  onChange={(e) =>
                    setEditingDevice({ ...editingDevice, status: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[#091124] border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="ONLINE">ONLINE (Active Telemetry)</option>
                  <option value="WARNING">WARNING (Telemetry threshold warning)</option>
                  <option value="CRITICAL">CRITICAL (System or security distress)</option>
                  <option value="OFFLINE">OFFLINE (Unreachable)</option>
                  <option value="MAINTENANCE">MAINTENANCE (Scheduled service)</option>
                  <option value="DECOMMISSIONED">DECOMMISSIONED (Retired hardware)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingDevice(null);
                }}
                disabled={isSubmittingEdit}
                className="px-3.5 py-2 rounded-xl border border-slate-700/80 bg-[#091124] hover:bg-slate-800 text-xs font-medium text-slate-300 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingEdit}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSubmittingEdit && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{isSubmittingEdit ? "Saving Changes..." : "Save Configuration"}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Surgical Isolation Confirmation Modal (Rule 19 & 20) */}
      {isolationTarget && (
        <Modal
          isOpen={true}
          onClose={() => setIsolationTarget(null)}
          title={
            isolationTarget.is_isolated
              ? `Confirm Network Isolation Rollback: ${isolationTarget.name}`
              : `Confirm Surgical Network Isolation: ${isolationTarget.name}`
          }
          subtitle={`Target IP: ${isolationTarget.ip} • Location: ${isolationTarget.location}`}
          footer={
            <>
              <button
                type="button"
                onClick={() => setIsolationTarget(null)}
                disabled={isIsolating}
                className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmIsolation}
                disabled={isIsolating}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold text-white shadow-lg cursor-pointer flex items-center gap-2 disabled:opacity-50 ${
                  isolationTarget.is_isolated
                    ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20"
                    : "bg-rose-600 hover:bg-rose-500 shadow-rose-600/20"
                }`}
              >
                {isIsolating && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {isolationTarget.is_isolated
                    ? "Rollback Isolation"
                    : "Execute Surgical Containment"}
                </span>
              </button>
            </>
          }
        >
          <div className="space-y-3 font-sans">
            <p className="text-xs text-slate-300">
              {isolationTarget.is_isolated
                ? "Rolling back surgical isolation will restore normal inbound and outbound network connectivity to this workstation. The telemetry monitoring agent will remain active."
                : "Enforcing surgical network isolation severs all unauthorized socket connections and drops inbound/outbound packets to prevent lateral movement and C2 beaconing. The host operating system will NOT reboot, and active research workload states are preserved."}
            </p>

            <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/80 text-xs font-mono space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Workstation Classification:</span>
                <span className="text-white font-bold">{isolationTarget.type}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Current CPU / RAM Strain:</span>
                <span className="text-white">
                  {isolationTarget.cpu ?? "—"}% / {isolationTarget.memory ?? "—"}%
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Policy Engine Target:</span>
                <span className="text-cyan-400">Playbook 3: Surgical Network Isolation</span>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
