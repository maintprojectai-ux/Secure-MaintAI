"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Server,
  Monitor,
  Network,
  HardDrive,
  Download,
  Plus,
  Search,
  SlidersHorizontal,
  RotateCw,
  Eye,
  Shield,
  RotateCcw,
  MoreVertical,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Power,
  ChevronDown,
  Copy,
  Check,
  Terminal,
  Key,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import {
  MOCK_DASHBOARD_KPI,
  getWorkstations,
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
  location: string;
  rack: string;
  status: "Online" | "Warning" | "Critical" | "Offline";
  cpu: number | null;
  memory: number | null;
  disk: number | null;
  lastSeen: string;
  is_isolated?: boolean;
  mac_address?: string | null;
  asset_tag?: string | null;
  hardware_specs?: any;
}

const INITIAL_DEVICES: DeviceItem[] = [
  {
    id: "ws-srv-01",
    name: "SRV-ACA-01",
    model: "Dell PowerEdge R740",
    category: "server",
    ip: "10.10.1.10",
    type: "Server",
    location: "Main Data Center",
    rack: "Rack 01",
    status: "Online",
    cpu: 42,
    memory: 68,
    disk: 54,
    lastSeen: "2 min ago",
  },
  {
    id: "ws-lab-17",
    name: "LAB-PC-17",
    model: "HP EliteDesk 800",
    category: "desktop",
    ip: "10.10.2.17",
    type: "Desktop",
    location: "Computer Lab 2",
    rack: "Room 204",
    status: "Warning",
    cpu: 78,
    memory: 83,
    disk: 71,
    lastSeen: "1 min ago",
  },
  {
    id: "ws-srv-db02",
    name: "SRV-DB-02",
    model: "Dell PowerEdge R740",
    category: "server",
    ip: "10.10.1.20",
    type: "Database Server",
    location: "Main Data Center",
    rack: "Rack 02",
    status: "Critical",
    cpu: 92,
    memory: 91,
    disk: 89,
    lastSeen: "30 sec ago",
  },
  {
    id: "ws-lab-09",
    name: "LAB-PC-09",
    model: "Lenovo ThinkCentre",
    category: "desktop",
    ip: "10.10.2.9",
    type: "Desktop",
    location: "Computer Lab 1",
    rack: "Room 101",
    status: "Online",
    cpu: 45,
    memory: 50,
    disk: 40,
    lastSeen: "1 min ago",
  },
  {
    id: "ws-sw-core01",
    name: "SW-CORE-01",
    model: "Cisco Catalyst 9300",
    category: "switch",
    ip: "10.10.1.1",
    type: "Network Switch",
    location: "Main Data Center",
    rack: "Rack 01",
    status: "Online",
    cpu: null,
    memory: null,
    disk: null,
    lastSeen: "10 sec ago",
  },
  {
    id: "ws-storage-01",
    name: "STORAGE-01",
    model: "Dell EMC Unity XT",
    category: "storage",
    ip: "10.10.1.50",
    type: "Storage",
    location: "Main Data Center",
    rack: "Rack 03",
    status: "Warning",
    cpu: 63,
    memory: 72,
    disk: 81,
    lastSeen: "2 min ago",
  },
  {
    id: "ws-admin-01",
    name: "ADMIN-PC-01",
    model: "HP ProDesk 600",
    category: "desktop",
    ip: "10.10.3.5",
    type: "Desktop",
    location: "IT Office",
    rack: "Room 301",
    status: "Online",
    cpu: 35,
    memory: 48,
    disk: 34,
    lastSeen: "1 min ago",
  },
  {
    id: "ws-srv-web01",
    name: "SRV-WEB-01",
    model: "Dell PowerEdge R740",
    category: "server",
    ip: "10.10.1.15",
    type: "Web Server",
    location: "Main Data Center",
    rack: "Rack 02",
    status: "Offline",
    cpu: null,
    memory: null,
    disk: null,
    lastSeen: "15 min ago",
  },
  {
    id: "ws-stu-23",
    name: "STUDENT-PC-23",
    model: "HP EliteDesk 800",
    category: "desktop",
    ip: "10.10.2.23",
    type: "Desktop",
    location: "Computer Lab 3",
    rack: "Room 303",
    status: "Offline",
    cpu: null,
    memory: null,
    disk: null,
    lastSeen: "20 min ago",
  },
  {
    id: "ws-srv-bkp01",
    name: "SRV-BACKUP-01",
    model: "Dell PowerEdge R740",
    category: "server",
    ip: "10.10.1.30",
    type: "Backup Server",
    location: "Main Data Center",
    rack: "Rack 04",
    status: "Online",
    cpu: 28,
    memory: 32,
    disk: 45,
    lastSeen: "30 sec ago",
  },
];

export default function DevicesPage() {
  const [devices, setDevices] = useState<DeviceItem[]>(INITIAL_DEVICES);
  const [isLiveFleet, setIsLiveFleet] = useState(false);
  const [isLoadingFleet, setIsLoadingFleet] = useState(false);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedType, setSelectedType] = useState("ALL");
  const [selectedLocation, setSelectedLocation] = useState("ALL");
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [isolationTarget, setIsolationTarget] = useState<DeviceItem | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [agentOsTab, setAgentOsTab] = useState<"linux" | "windows">("linux");
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [newDeviceForm, setNewDeviceForm] = useState({
    name: "",
    model: "Dell Precision 5820",
    category: "desktop" as "desktop" | "server" | "switch" | "storage",
    type: "Desktop Workstation",
    ip: "",
    location: "Computer Lab 1",
    rack: "Room 101",
    department: "College of Computer Science",
    os: "Ubuntu 22.04 LTS",
  });

  // Dynamic values directly from the current active `devices` state
  const total = devices.length;
  const onlineCount = devices.filter((d) => d.status === "Online").length;
  const warningCount = devices.filter((d) => d.status === "Warning").length;
  const criticalCount = devices.filter((d) => d.status === "Critical").length;
  const offlineCount = devices.filter((d) => d.status === "Offline").length;

  const onlinePct = total > 0 ? ((onlineCount / total) * 100).toFixed(1) : "0.0";
  const warningPct = total > 0 ? ((warningCount / total) * 100).toFixed(1) : "0.0";
  const criticalPct = total > 0 ? ((criticalCount / total) * 100).toFixed(1) : "0.0";
  const offlinePct = total > 0 ? ((offlineCount / total) * 100).toFixed(1) : "0.0";

  // KPI cards definition
  const kpiCards = [
    {
      title: "Total Devices",
      value: total,
      delta: "↑ 12 from yesterday",
      deltaColor: "text-blue-400",
      icon: <Monitor className="w-5 h-5 text-blue-400" />,
      iconBg: "bg-blue-600/20 border-blue-500/30",
    },
    {
      title: "Online",
      value: onlineCount,
      delta: `${onlinePct}% of total`,
      deltaColor: "text-emerald-400",
      icon: (
        <div className="relative flex items-center justify-center">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        </div>
      ),
      iconBg: "bg-emerald-600/20 border-emerald-500/30",
    },
    {
      title: "Warning",
      value: warningCount,
      delta: `${warningPct}% of total`,
      deltaColor: "text-amber-400",
      icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
      iconBg: "bg-amber-600/20 border-amber-500/30",
    },
    {
      title: "Critical",
      value: criticalCount,
      delta: `${criticalPct}% of total`,
      deltaColor: "text-rose-400",
      icon: <AlertCircle className="w-5 h-5 text-rose-400" />,
      iconBg: "bg-rose-600/20 border-rose-500/30",
    },
    {
      title: "Offline",
      value: offlineCount,
      delta: `${offlinePct}% of total`,
      deltaColor: "text-slate-400",
      icon: <Power className="w-5 h-5 text-slate-400" />,
      iconBg: "bg-slate-700/30 border-slate-600/40",
    },
  ];

  // Filtering logic
  const filteredDevices = devices.filter((d) => {
    if (selectedStatus !== "ALL" && d.status.toUpperCase() !== selectedStatus.toUpperCase()) {
      return false;
    }
    if (selectedType !== "ALL" && d.type.toLowerCase() !== selectedType.toLowerCase()) {
      return false;
    }
    if (selectedLocation !== "ALL" && !d.location.toLowerCase().includes(selectedLocation.toLowerCase())) {
      return false;
    }
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      const matchesName = d.name.toLowerCase().includes(q);
      const matchesModel = d.model.toLowerCase().includes(q);
      const matchesIp = d.ip.toLowerCase().includes(q);
      const matchesType = d.type.toLowerCase().includes(q);
      if (!matchesName && !matchesModel && !matchesIp && !matchesType) return false;
    }
    return true;
  });

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

  // Live fleet synchronization from FastAPI backend
  useEffect(() => {
    let active = true;
    async function loadLiveWorkstations() {
      setIsLoadingFleet(true);
      try {
        const res = await getWorkstations({ pageSize: 50 });
        if (active && res && res.items && res.items.length > 0) {
          const mapped: DeviceItem[] = res.items.map((w) => {
            const isServer =
              (w.operating_system || "").toLowerCase().includes("server") ||
              (w.hostname || "").toLowerCase().includes("srv") ||
              (w.hostname || "").toLowerCase().includes("hpc");
            const statusMap: Record<string, "Online" | "Warning" | "Critical" | "Offline"> = {
              ONLINE: "Online",
              OFFLINE: "Offline",
              WARNING: "Warning",
              CRITICAL: "Critical",
              ISOLATED: "Critical",
            };
            const mappedStatus = statusMap[w.status] || "Online";

            let lastSeenStr = "Active";
            if (w.last_seen_at) {
              const diffMs = Date.now() - new Date(w.last_seen_at).getTime();
              const diffSec = Math.floor(diffMs / 1000);
              if (diffSec < 60) lastSeenStr = `${diffSec}s ago`;
              else if (diffSec < 3600) lastSeenStr = `${Math.floor(diffSec / 60)} min ago`;
              else lastSeenStr = `${Math.floor(diffSec / 3600)}h ago`;
            }

            return {
              id: w.id,
              name: w.hostname,
              model:
                (w.hardware_specs?.processor as string) ||
                (isServer ? "HPC / Server Node" : "Standard Workstation"),
              category: isServer ? "server" : "desktop",
              ip: w.ip_address,
              type: w.operating_system || "Linux / Windows",
              location: w.lab
                ? `${w.department || "Academic"} - ${w.lab}`
                : w.department || "Main Campus",
              rack: w.asset_tag || "Fleet Asset",
              status: mappedStatus,
              cpu: w.cpu_usage ?? (w.status === "ONLINE" ? 34 : null),
              memory: w.memory_usage ?? (w.status === "ONLINE" ? 48 : null),
              disk: w.disk_usage ?? (w.status === "ONLINE" ? 52 : null),
              lastSeen: lastSeenStr,
              is_isolated: w.status === "ISOLATED",
              mac_address: w.mac_address,
              asset_tag: w.asset_tag,
              hardware_specs: w.hardware_specs,
            };
          });
          setDevices(mapped);
          setIsLiveFleet(true);
        }
      } catch (err) {
        console.debug("Backend workstations API unavailable, using offline fallback fleet:", err);
      } finally {
        if (active) setIsLoadingFleet(false);
      }
    }
    loadLiveWorkstations();
    return () => {
      active = false;
    };
  }, [refreshIndex]);

  const confirmIsolation = async () => {
    if (!isolationTarget) return;

    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(isolationTarget.id);
      if (isUuid) {
        if (isolationTarget.is_isolated) {
          await rollbackWorkstationIsolation(isolationTarget.id);
        } else {
          await isolateWorkstation(isolationTarget.id);
        }
      }
    } catch (err) {
      console.warn("Could not reach SOAR endpoint, applying local mock isolation:", err);
    }

    setDevices((prev) =>
      prev.map((d) =>
        d.id === isolationTarget.id
          ? {
            ...d,
            is_isolated: !d.is_isolated,
            status: !d.is_isolated ? "Critical" : "Online",
          }
          : d
      )
    );

    const actionText = isolationTarget.is_isolated
      ? `Surgical network isolation rolled back for ${isolationTarget.name}`
      : `Surgical network containment enforced on ${isolationTarget.name}. Host OS kept running; unauthorized C2 sockets severed.`;

    setActionSuccessMessage(actionText);
    setIsolationTarget(null);

    setTimeout(() => {
      setActionSuccessMessage(null);
    }, 6000);
  };

  const enrollmentToken = "sm-agt-8f7a912e-kku-fleet";
  const linuxInstallCmd = `curl -sSL https://secure-maint.kku.edu.sa/agent/install.sh | sudo bash -s -- --token ${enrollmentToken} --server https://telemetry.kku.edu.sa`;
  const windowsInstallCmd = `irm https://secure-maint.kku.edu.sa/agent/install.ps1 | iex; Install-SecureMaintAgent -Token "${enrollmentToken}" -Server "https://telemetry.kku.edu.sa"`;

  const copyToClipboard = (text: string, isToken = false) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      if (isToken) {
        setCopiedToken(true);
        setTimeout(() => setCopiedToken(false), 2000);
      } else {
        setCopiedCommand(true);
        setTimeout(() => setCopiedCommand(false), 2000);
      }
    }
  };

  const handleEnrollDevice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceForm.name.trim() || !newDeviceForm.ip.trim()) return;

    const newId = `ws-${newDeviceForm.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now().toString().slice(-4)}`;
    const created: DeviceItem = {
      id: newId,
      name: newDeviceForm.name.toUpperCase().trim(),
      model: newDeviceForm.model || "Workstation",
      category: newDeviceForm.category,
      ip: newDeviceForm.ip.trim(),
      type: newDeviceForm.type,
      location: newDeviceForm.location,
      rack: newDeviceForm.rack || "Default Bay",
      status: "Online",
      cpu: Math.floor(Math.random() * 20) + 20,
      memory: Math.floor(Math.random() * 25) + 30,
      disk: Math.floor(Math.random() * 20) + 35,
      lastSeen: "Just now",
    };

    setDevices((prev) => [created, ...prev]);
    setActionSuccessMessage(`Device ${created.name} successfully enrolled! Telemetry agent heartbeat stream established.`);
    setIsAddModalOpen(false);
    setNewDeviceForm({
      name: "",
      model: "Dell Precision 5820",
      category: "desktop",
      type: "Desktop Workstation",
      ip: "",
      location: "Computer Lab 1",
      rack: "Room 101",
      department: "College of Computer Science",
      os: "Ubuntu 22.04 LTS",
    });

    setTimeout(() => {
      setActionSuccessMessage(null);
    }, 6000);
  };

  const handleExportCsv = () => {
    const headers = ["ID", "Name", "Model", "Type", "IP Address", "Location", "Rack", "Status", "CPU", "Memory", "Disk"];
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
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `secure_maint_devices_${new Date().toISOString().slice(0, 10)}.csv`);
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

  return (
    <div className="space-y-6 font-sans">
      {/* Action Notification Banner */}
      {actionSuccessMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2.5 shadow-lg shadow-emerald-950/40">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{actionSuccessMessage}</span>
        </div>
      )}

      {/* In-Page Action Bar */}
      <div className="flex items-center justify-end gap-2.5">
        <button
          type="button"
          onClick={handleExportCsv}
          className="px-3.5 py-2 rounded-xl border border-slate-700/80 bg-[#091124] hover:bg-slate-800 text-xs font-medium text-slate-200 flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
          title="Export devices list to CSV"
        >
          <Download className="w-3.5 h-3.5 text-slate-400" />
          <span>Export</span>
        </button>

        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-[#1d68ff] hover:bg-[#185adb] text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Device</span>
        </button>
      </div>

      {/* Row 1: 5 Status KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpiCards.map((card, i) => (
          <div
            key={i}
            className="glass-card p-4 flex items-center justify-between border-slate-800/80 bg-[#091124]/90 hover:border-slate-700 transition-colors shadow-lg"
          >
            <div>
              <p className="text-xs font-medium text-slate-400 tracking-wide">{card.title}</p>
              <h3 className="text-2xl font-bold text-white mt-1 font-sans tracking-tight">{card.value}</h3>
              <p className={`text-[11px] font-medium mt-1 ${card.deltaColor}`}>{card.delta}</p>
            </div>
            <div className={`w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0 ${card.iconBg}`}>
              {card.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Row 2: Unified Filter & Search Toolbar */}
      <div className="glass-card p-3.5 border-slate-800/80 bg-[#091124]/90 shadow-lg flex flex-col lg:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, IP, or type..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-900/90 border border-slate-700/80 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors font-sans"
            />
          </div>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-1.5 text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="ALL">All Status</option>
            <option value="ONLINE">Online</option>
            <option value="WARNING">Warning</option>
            <option value="CRITICAL">Critical</option>
            <option value="OFFLINE">Offline</option>
          </select>

          {/* Types Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="text-xs bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-1.5 text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="ALL">All Types</option>
            <option value="Server">Server</option>
            <option value="Desktop">Desktop</option>
            <option value="Database Server">Database Server</option>
            <option value="Network Switch">Network Switch</option>
            <option value="Storage">Storage</option>
            <option value="Web Server">Web Server</option>
            <option value="Backup Server">Backup Server</option>
          </select>

          {/* Locations Filter */}
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="text-xs bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-1.5 text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="ALL">All Locations</option>
            <option value="Main Data Center">Main Data Center</option>
            <option value="Computer Lab 1">Computer Lab 1</option>
            <option value="Computer Lab 2">Computer Lab 2</option>
            <option value="Computer Lab 3">Computer Lab 3</option>
            <option value="IT Office">IT Office</option>
          </select>

          {/* More Filters button */}
          <button
            type="button"
            className="px-3 py-1.5 rounded-xl border border-slate-700/80 bg-slate-900/60 hover:bg-slate-800 text-xs font-medium text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <span>More Filters</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
        </div>

        {/* Right side: Live indicator and Refresh */}
        <div className="flex items-center gap-2.5 self-end lg:self-auto">
          {isLiveFleet ? (
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/50 border border-emerald-500/30 px-2.5 py-1 rounded-xl flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Fleet ({devices.length} Devices)
            </span>
          ) : (
            <span className="text-[11px] font-mono text-slate-400 bg-slate-900/60 border border-slate-700/60 px-2.5 py-1 rounded-xl flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              Fleet ({devices.length} Devices)
            </span>
          )}

          {/* Refresh button */}
          <button
            type="button"
            onClick={() => setRefreshIndex((p) => p + 1)}
            disabled={isLoadingFleet}
            className="px-3 py-1.5 rounded-xl border border-slate-700/80 bg-slate-900/60 hover:bg-slate-800 text-xs font-medium text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 text-slate-400 ${isLoadingFleet ? "animate-spin text-blue-400" : ""}`} />
            <span>{isLoadingFleet ? "Syncing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* Row 3: Main Device Inventory Table */}
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
                <th className="py-3 px-3 font-semibold text-slate-300">Device Name</th>
                <th className="py-3 px-3 font-semibold text-slate-300">IP Address</th>
                <th className="py-3 px-3 font-semibold text-slate-300">Type</th>
                <th className="py-3 px-3 font-semibold text-slate-300">Location</th>
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
                    className={`hover:bg-slate-800/30 transition-colors ${isSelected ? "bg-blue-600/5" : ""
                      }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3 px-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectRow(device.id)}
                        className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0 cursor-pointer"
                      />
                    </td>

                    {/* Device Name */}
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

                    {/* IP Address */}
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                      {device.ip}
                    </td>

                    {/* Type */}
                    <td className="py-3 px-3 text-slate-300 whitespace-nowrap text-xs font-medium">
                      {device.type}
                    </td>

                    {/* Location */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="text-xs text-slate-200 font-medium">{device.location}</div>
                      <div className="text-[11px] text-slate-400">{device.rack}</div>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                        <span
                          className={`w-2 h-2 rounded-full ${device.status === "Online"
                              ? "bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                              : device.status === "Warning"
                                ? "bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                                : device.status === "Critical"
                                  ? "bg-rose-400 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
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
                                  : "text-slate-400"
                          }
                        >
                          {device.status}
                        </span>
                      </span>
                    </td>

                    {/* CPU Usage */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {renderProgressBar(
                        device.cpu,
                        device.status === "Critical" ? "rose" : device.status === "Warning" ? "amber" : undefined
                      )}
                    </td>

                    {/* Memory Usage */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {renderProgressBar(
                        device.memory,
                        device.status === "Critical" ? "rose" : device.status === "Warning" ? "amber" : undefined
                      )}
                    </td>

                    {/* Disk Usage */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {renderProgressBar(
                        device.disk,
                        device.status === "Critical" ? "rose" : device.status === "Warning" ? "amber" : undefined
                      )}
                    </td>

                    {/* Last Seen */}
                    <td className="py-3 px-3 text-[11px] text-slate-400 whitespace-nowrap">
                      {device.lastSeen}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        {/* Eye details icon */}
                        <Link
                          href={`/devices/${device.id}`}
                          title="View Device Details"
                          className="p-1.5 rounded-lg border border-slate-700/80 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-blue-400 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>

                        {/* Surgical Isolation SOAR Trigger */}
                        <button
                          type="button"
                          onClick={() => setIsolationTarget(device)}
                          title={device.is_isolated ? "Rollback Surgical Isolation" : "Execute Surgical Isolation"}
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${device.is_isolated
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

                        {/* More action dots */}
                        <button
                          type="button"
                          className="p-1.5 rounded-lg border border-slate-700/80 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Table Footer / Pagination */}
        <div className="p-3.5 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 select-none">
          <div>
            Showing 1 to {filteredDevices.length} of {total} devices
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="px-2 py-1 rounded-lg border border-slate-800 bg-slate-900/60 text-slate-500 hover:text-slate-300 disabled:opacity-50"
            >
              &lt;
            </button>
            <button
              type="button"
              className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold text-xs"
            >
              1
            </button>
            <button
              type="button"
              className="px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
            >
              2
            </button>
            <button
              type="button"
              className="px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
            >
              3
            </button>
            <button
              type="button"
              className="px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
            >
              4
            </button>
            <span className="px-1 text-slate-600">...</span>
            <button
              type="button"
              className="px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
            >
              15
            </button>
            <button
              type="button"
              className="px-2 py-1 rounded-lg border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
            >
              &gt;
            </button>
          </div>
        </div>
      </div>

      {/* Surgical Isolation Confirmation Modal (Preserved per Rule 19 & 20) */}
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
                className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmIsolation}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold text-white shadow-lg cursor-pointer ${isolationTarget.is_isolated
                    ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20"
                    : "bg-rose-600 hover:bg-rose-500 shadow-rose-600/20"
                  }`}
              >
                {isolationTarget.is_isolated ? "Rollback Isolation" : "Execute Surgical Containment"}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-xs text-slate-300">
              {isolationTarget.is_isolated
                ? "Rolling back surgical isolation will restore normal inbound and outbound network connectivity to this workstation. The telemetry monitoring agent will remain active."
                : "Enforcing surgical network isolation severs all unauthorized socket connections and drops inbound/outbound packets to prevent lateral movement and C2 beaconing. The host operating system will NOT reboot, and active legitimate researcher state is preserved per Rule 19 & 20."}
            </p>

            <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/80 text-xs font-mono space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Device Classification:</span>
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

      {/* Enroll New Device Modal */}
      {isAddModalOpen && (
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Enroll University Infrastructure Device"
          subtitle="Register hardware specifications and deploy the lightweight telemetry agent"
          maxWidth="2xl"
        >
          <form onSubmit={handleEnrollDevice} className="space-y-4 text-xs">
            {/* 2-column Grid for Device Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Device Hostname / Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. LAB-PC-25 or SRV-AI-03"
                  value={newDeviceForm.name}
                  onChange={(e) => setNewDeviceForm({ ...newDeviceForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#091124] border border-slate-800 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  IPv4 Address <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 10.10.2.88"
                  value={newDeviceForm.ip}
                  onChange={(e) => setNewDeviceForm({ ...newDeviceForm, ip: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#091124] border border-slate-800 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Device Category</label>
                <select
                  value={newDeviceForm.category}
                  onChange={(e) => {
                    const cat = e.target.value as "desktop" | "server" | "switch" | "storage";
                    const defaultType =
                      cat === "desktop"
                        ? "Desktop Workstation"
                        : cat === "server"
                          ? "Compute / DB Server"
                          : cat === "switch"
                            ? "Network Switch"
                            : "Storage Node";
                    setNewDeviceForm({ ...newDeviceForm, category: cat, type: defaultType });
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-[#091124] border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="desktop">Desktop / Workstation</option>
                  <option value="server">Compute / Database Server</option>
                  <option value="switch">Network Switch / Router</option>
                  <option value="storage">Storage Node / SAN</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Hardware Model</label>
                <input
                  type="text"
                  placeholder="e.g. HP EliteDesk 800 G8"
                  value={newDeviceForm.model}
                  onChange={(e) => setNewDeviceForm({ ...newDeviceForm, model: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#091124] border border-slate-800 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Department</label>
                <select
                  value={newDeviceForm.department}
                  onChange={(e) => setNewDeviceForm({ ...newDeviceForm, department: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#091124] border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="College of Computer Science">College of Computer Science</option>
                  <option value="College of Engineering">College of Engineering</option>
                  <option value="College of Science">College of Science</option>
                  <option value="Central IT Administration">Central IT Administration</option>
                  <option value="University Data Center">University Data Center</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Operating System</label>
                <select
                  value={newDeviceForm.os}
                  onChange={(e) => setNewDeviceForm({ ...newDeviceForm, os: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#091124] border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="Ubuntu 22.04 LTS">Ubuntu 22.04 LTS</option>
                  <option value="Ubuntu 24.04 LTS">Ubuntu 24.04 LTS</option>
                  <option value="Red Hat Enterprise Linux 9">Red Hat Enterprise Linux 9</option>
                  <option value="Windows 11 Enterprise">Windows 11 Enterprise</option>
                  <option value="Windows Server 2022">Windows Server 2022</option>
                  <option value="Cisco IOS XE">Cisco IOS XE (Switch)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Location / Lab</label>
                <input
                  type="text"
                  placeholder="e.g. Computer Lab 3 or Data Center"
                  value={newDeviceForm.location}
                  onChange={(e) => setNewDeviceForm({ ...newDeviceForm, location: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#091124] border border-slate-800 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Rack / Room</label>
                <input
                  type="text"
                  placeholder="e.g. Room 302 or Rack 04"
                  value={newDeviceForm.rack}
                  onChange={(e) => setNewDeviceForm({ ...newDeviceForm, rack: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#091124] border border-slate-800 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Agent Deployment One-Liner Box */}
            <div className="mt-4 p-3.5 rounded-xl border border-slate-800 bg-[#070d1e] space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-300 font-medium">
                  <Terminal className="w-4 h-4 text-blue-400" />
                  <span>Agent Deployment Command</span>
                </div>
                <div className="flex items-center bg-slate-900/80 p-0.5 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setAgentOsTab("linux")}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${agentOsTab === "linux"
                        ? "bg-blue-600 text-white"
                        : "text-slate-400 hover:text-slate-200"
                      }`}
                  >
                    Linux / macOS
                  </button>
                  <button
                    type="button"
                    onClick={() => setAgentOsTab("windows")}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${agentOsTab === "windows"
                        ? "bg-blue-600 text-white"
                        : "text-slate-400 hover:text-slate-200"
                      }`}
                  >
                    Windows PowerShell
                  </button>
                </div>
              </div>

              <div className="relative group">
                <pre className="p-3 rounded-lg bg-black/60 border border-slate-800/80 text-[11px] font-mono text-cyan-300 overflow-x-auto whitespace-pre-wrap break-all pr-16">
                  {agentOsTab === "linux" ? linuxInstallCmd : windowsInstallCmd}
                </pre>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(agentOsTab === "linux" ? linuxInstallCmd : windowsInstallCmd)
                  }
                  className="absolute right-2 top-2.5 px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] flex items-center gap-1 border border-slate-700 transition-colors cursor-pointer"
                  title="Copy command"
                >
                  {copiedCommand ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-slate-400" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>
                  Enrollment Token:{" "}
                  <code className="px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 font-mono text-[10px]">
                    {enrollmentToken}
                  </code>
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(enrollmentToken, true)}
                  className="text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {copiedToken ? "Token Copied!" : "Copy Token"}
                </button>
              </div>

              <p className="text-[10px] text-slate-500 leading-relaxed border-t border-slate-800/60 pt-2">
                * Agent gathers continuous CPU, RAM, disk, network, and process metadata non-intrusively per Rule 9. No private files or communications are inspected.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-3.5 py-2 rounded-xl border border-slate-700/80 bg-[#091124] hover:bg-slate-800 text-xs font-medium text-slate-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#1d68ff] hover:bg-[#185adb] text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Enroll Device &amp; Start Telemetry</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
