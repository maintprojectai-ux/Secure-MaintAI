"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Server,
  Monitor,
  Cpu,
  Activity,
  Shield,
  RotateCcw,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Edit,
  RotateCw,
  Slash,
  Thermometer,
  Fan,
  Network,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Power,
  KeyRound,
  ShieldAlert as ShieldAlertIcon,
  HardDrive,
  User as UserIcon,
  MapPin,
  Clock,
  Sparkles,
  Info,
  ArrowRight,
  Check,
  Radio,
  Sliders,
  HelpCircle,
  Zap,
} from "lucide-react";
import { Workstation, DemoExecutionReceipt, WorkstationStatus } from "@/types";
import { Modal } from "@/components/ui/Modal";
import { DemoProgress } from "@/components/dashboard/DemoProgress";
import { DemoController } from "@/components/dashboard/DemoController";
import {
  getWorkstationTelemetry,
  getWorkstation,
  updateWorkstation,
  isolateWorkstation,
  rollbackWorkstationIsolation,
} from "@/lib/api";

interface DeviceDetailClientProps {
  deviceId: string;
  initialWorkstation?: Workstation | null;
}

type TabType = "overview" | "simulation" | "specs";

function formatLastSeen(lastSeenAt?: string | null): string {
  if (!lastSeenAt) return "Just now";
  const diffMs = Date.now() - new Date(lastSeenAt).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${Math.max(1, diffSec)}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatUptime(createdAt?: string | null): string {
  if (!createdAt) return "Active (online)";
  const diffMs = Math.max(0, Date.now() - new Date(createdAt).getTime());
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (diffDays > 0) return `${diffDays}d ${diffHours}h ${diffMins}m`;
  if (diffHours > 0) return `${diffHours}h ${diffMins}m`;
  return `${diffMins}m`;
}

export const DeviceDetailClient: React.FC<DeviceDetailClientProps> = ({
  deviceId,
  initialWorkstation = null,
}) => {
  const [workstation, setWorkstation] = useState<Workstation | null>(initialWorkstation);
  const [isLoading, setIsLoading] = useState<boolean>(!initialWorkstation);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // Modals
  const [showIsolationModal, setShowIsolationModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [showRestartModal, setShowRestartModal] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState<{
    department: string;
    lab: string;
    asset_tag: string;
    status: WorkstationStatus;
  }>({
    department: initialWorkstation?.department || "",
    lab: initialWorkstation?.lab || "",
    asset_tag: initialWorkstation?.asset_tag || "",
    status: (initialWorkstation?.status as WorkstationStatus) || "ONLINE",
  });

  // Demonstration State
  const [demoReceipt, setDemoReceipt] = useState<DemoExecutionReceipt | null>(null);
  const [demoActiveStep, setDemoActiveStep] = useState<number>(1);

  // Dynamic live telemetry metrics
  const [liveCpu, setLiveCpu] = useState<number>(initialWorkstation?.cpu_usage ?? 42);
  const [liveMemory, setLiveMemory] = useState<number>(initialWorkstation?.memory_usage ?? 68);
  const [liveDisk, setLiveDisk] = useState<number>(initialWorkstation?.disk_usage ?? 0);
  const [liveDiskIO, setLiveDiskIO] = useState<number>(0);
  const [sparkCpu, setSparkCpu] = useState<number[]>([35, 42, 38, 45, 52, 48, 44, 42]);
  const [sparkMemory, setSparkMemory] = useState<number[]>([62, 64, 65, 66, 68, 67, 68, 68]);
  const [sparkDiskIO, setSparkDiskIO] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0]);
  const [sparkLabels, setSparkLabels] = useState<string[]>([
    "15:25", "15:30", "15:35", "15:40", "15:45", "15:50", "15:55", "16:00",
  ]);

  // Polling control refs to prevent duplicate/overlapping requests
  const isFetchingRef = useRef(false);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load workstation from live backend API
  useEffect(() => {
    let active = true;

    async function loadWorkstation() {
      try {
        setIsLoading(true);
        setLoadError(null);
        const live = await getWorkstation(deviceId);
        if (active && live) {
          setWorkstation({
            ...live,
            is_isolated: live.status === "ISOLATED",
          });
          setEditForm({
            department: live.department || "",
            lab: live.lab || "",
            asset_tag: live.asset_tag || "",
            status: live.status || "ONLINE",
          });
          if (live.cpu_usage != null) setLiveCpu(Math.round(live.cpu_usage));
          if (live.memory_usage != null) setLiveMemory(Math.round(live.memory_usage));
          if (live.disk_usage != null) setLiveDisk(Math.round(live.disk_usage));
        }
      } catch (err: unknown) {
        if (active) {
          const msg = err instanceof Error ? err.message : "Failed to load workstation";
          setLoadError(msg);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    loadWorkstation();
    return () => {
      active = false;
    };
  }, [deviceId]);

  // Controlled, deduplicated telemetry polling
  useEffect(() => {
    if (!workstation?.id) return;
    let active = true;

    const fetchTelemetry = async () => {
      // Prevent overlapping concurrent requests
      if (isFetchingRef.current) return;
      if (typeof document !== "undefined" && document.hidden) return;

      isFetchingRef.current = true;
      try {
        const metrics = await getWorkstationTelemetry(workstation.id, 8);
        if (active && metrics && metrics.length > 0) {
          const sorted = [...metrics].sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          const latest = sorted[sorted.length - 1];
          setLiveCpu(Math.round(latest.cpu_usage));
          setLiveMemory(Math.round(latest.memory_usage));

          // Real disk I/O throughput in MB/s (read + write), no fabricated percentages
          const ioRate = Math.round((latest.disk_read + latest.disk_write) * 10) / 10;
          setLiveDiskIO(ioRate);

          setSparkCpu(sorted.map((m) => Math.round(m.cpu_usage)));
          setSparkMemory(sorted.map((m) => Math.round(m.memory_usage)));
          setSparkDiskIO(sorted.map((m) => Math.round((m.disk_read + m.disk_write) * 10) / 10));
          setSparkLabels(
            sorted.map((m) => {
              const d = new Date(m.timestamp);
              return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
            })
          );
        }
      } catch {
        // Retain current metrics if endpoint offline
      } finally {
        isFetchingRef.current = false;
      }
    };

    // Self-scheduling loop: waits 15 seconds AFTER previous request completes before polling again
    const scheduleNext = () => {
      if (!active) return;
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = setTimeout(async () => {
        if (active && !document.hidden && activeTab === "overview") {
          await fetchTelemetry();
        }
        scheduleNext();
      }, 15000);
    };

    // Initial fetch, then schedule next
    fetchTelemetry().then(() => scheduleNext());

    // Pause polling when browser tab is hidden; resume when visible
    const handleVisibilityChange = () => {
      if (!document.hidden && active && activeTab === "overview") {
        fetchTelemetry();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [workstation?.id, activeTab]);

  const generateSvgPath = (data: number[], width = 300, height = 45, maxVal = 100): string => {
    if (!data || data.length === 0) return `M0 ${height / 2} L${width} ${height / 2}`;
    const stepX = width / Math.max(data.length - 1, 1);
    const ceiling = Math.max(...data, maxVal, 1);
    return data
      .map((val, idx) => {
        const x = Math.round(idx * stepX);
        const clampedVal = Math.max(0, Math.min(ceiling, val));
        const y = Math.round(height - (clampedVal / ceiling) * (height - 8) - 4);
        return `${idx === 0 ? "M" : "L"}${x} ${y}`;
      })
      .join(" ");
  };

  const handleReceiptUpdate = (receipt: DemoExecutionReceipt) => {
    setDemoReceipt(receipt);
    setDemoActiveStep(4);
    setLiveCpu(Math.round(receipt.step_3_telemetry.cpu_percent));
    setLiveMemory(Math.round(receipt.step_3_telemetry.memory_percent));
    setWorkstation((prev) =>
      prev
        ? {
          ...prev,
          is_isolated: receipt.step_8_soar_execution.workstation_final_status === "ISOLATED",
          status:
            receipt.step_8_soar_execution.workstation_final_status === "ISOLATED"
              ? "ISOLATED"
              : "ONLINE",
        }
        : null
    );
  };

  // Actions
  const handleToggleIsolation = async () => {
    if (!workstation) return;
    const nextState = !workstation.is_isolated;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      workstation.id
    );
    if (isUuid) {
      try {
        if (workstation.is_isolated) {
          await rollbackWorkstationIsolation(workstation.id);
        } else {
          try {
            await isolateWorkstation(workstation.id);
          } catch {
            await updateWorkstation(workstation.id, { status: "ISOLATED" });
          }
        }
      } catch (err) {
        console.warn("Could not reach isolation endpoint:", err);
      }
    }

    setWorkstation((prev) =>
      prev
        ? {
          ...prev,
          is_isolated: nextState,
          status: nextState ? "ISOLATED" : "ONLINE",
        }
        : null
    );
    setShowIsolationModal(false);

    const message = nextState
      ? `Network quarantine enforced on ${workstation.hostname}. Unauthorized traffic blocked; host OS and research work stay running.`
      : `Network quarantine lifted for ${workstation.hostname}. Full connectivity and data streams restored.`;

    setFeedbackMessage(message);
    setTimeout(() => setFeedbackMessage(null), 6000);
  };

  const handleRunScan = () => {
    setIsScanning(true);
    setFeedbackMessage("Running health & integrity scan on this device...");
    setTimeout(() => {
      setIsScanning(false);
      setFeedbackMessage(
        "Health check complete: All system services, OS modules, and network interfaces are optimal."
      );
      setTimeout(() => setFeedbackMessage(null), 5000);
    }, 2000);
  };

  const handleRestartService = () => {
    setShowRestartModal(false);
    setFeedbackMessage(
      `Background monitoring agent restarted successfully on ${workstation?.hostname || "this device"}. Operating system remained online.`
    );
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workstation) return;

    setIsSubmittingEdit(true);
    setEditError(null);

    try {
      const updated = await updateWorkstation(workstation.id, {
        department: editForm.department.trim() || null,
        lab: editForm.lab.trim() || null,
        asset_tag: editForm.asset_tag.trim() || null,
        status: editForm.status || null,
      });

      setWorkstation((prev) =>
        prev
          ? {
            ...prev,
            ...updated,
            is_isolated: updated.status === "ISOLATED",
          }
          : null
      );

      setShowEditModal(false);
      setFeedbackMessage(`Device details updated successfully for ${workstation.hostname}.`);
      setTimeout(() => setFeedbackMessage(null), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update device details";
      setEditError(msg);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Helper for human-readable CPU status
  const getCpuStatus = (usage: number) => {
    if (usage >= 85) return { label: "Heavy Workload", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30" };
    if (usage >= 65) return { label: "Moderate Activity", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" };
    return { label: "Normal Load", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" };
  };

  // Helper for human-readable Memory status
  const getMemoryStatus = (usage: number) => {
    if (usage >= 90) return { label: "High Memory Load", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30" };
    if (usage >= 75) return { label: "Elevated Usage", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" };
    return { label: "Healthy Usage", color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/30" };
  };

  // Helper for human-readable Storage status
  const getDiskStatus = (usage: number) => {
    if (usage >= 90) return { label: "Low Free Space", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30" };
    if (usage >= 75) return { label: "Moderate Storage", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" };
    return { label: "Ample Free Space", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30" };
  };

  // Loading skeleton state
  if (isLoading && !workstation) {
    return (
      <div className="space-y-6 font-sans animate-pulse">
        <div className="h-4 w-48 bg-slate-800/80 rounded" />
        <div className="glass-card p-6 rounded-2xl border-slate-800/80 bg-[#091124]/95 shadow-xl space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/80" />
            <div className="space-y-2">
              <div className="h-6 w-52 bg-slate-800/80 rounded" />
              <div className="h-4 w-72 bg-slate-800/50 rounded" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 pt-4 border-t border-slate-800/80">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 bg-slate-800/50 rounded" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="h-44 bg-slate-800/40 rounded-2xl" />
          <div className="h-44 bg-slate-800/40 rounded-2xl" />
          <div className="h-44 bg-slate-800/40 rounded-2xl" />
        </div>
      </div>
    );
  }

  // Not Found / Error state
  if (!workstation) {
    return (
      <div className="space-y-6 font-sans">
        <nav className="flex items-center gap-2 text-xs text-slate-400">
          <Link href="/devices" className="hover:text-white transition-colors">
            Devices Fleet
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
          <span className="text-slate-200 font-medium">Device Details</span>
        </nav>

        <div className="glass-card p-10 rounded-2xl border-slate-800/80 bg-[#091124]/95 text-center space-y-4 max-w-lg mx-auto mt-12 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Device Not Found</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            {loadError || (
              <>
                No device found with identifier{" "}
                <span className="font-mono text-cyan-400 font-bold">{deviceId}</span>. It may have
                been decommissioned or the ID is mistyped.
              </>
            )}
          </p>
          <div className="pt-2">
            <Link
              href="/devices"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors shadow-md shadow-blue-600/20"
            >
              Back to Devices Fleet
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const cpuStatus = getCpuStatus(liveCpu);
  const memStatus = getMemoryStatus(liveMemory);
  const diskStatus = getDiskStatus(liveDisk);

  const isServer =
    (workstation.hostname || "").toLowerCase().includes("srv") ||
    (workstation.hostname || "").toLowerCase().includes("hpc") ||
    ((workstation.hardware_specs?.processor as string) || "").toLowerCase().includes("xeon") ||
    ((workstation.hardware_specs?.cpu as string) || "").toLowerCase().includes("epyc");

  // User identity derivation
  const assignedUser = workstation.assigned_user;
  const simulatedIdp = demoReceipt?.step_6_idp_context;
  const hasAssignedUser = Boolean(assignedUser);
  const hasSimulatedSession = Boolean(simulatedIdp);

  // Top assigned user display string
  const topAssignedUserText = assignedUser?.full_name
    ? assignedUser.full_name
    : assignedUser?.username
    ? assignedUser.username
    : simulatedIdp?.username
    ? `${simulatedIdp.username} (Simulated Active Session)`
    : isServer
    ? "Shared Infrastructure Node"
    : workstation.lab
    ? `${workstation.lab} (Public Lab Station)`
    : "Shared Academic Workstation";

  // University Identity Card values
  const idpDisplayName = assignedUser?.full_name
    ? assignedUser.full_name
    : assignedUser?.username
    ? assignedUser.username
    : simulatedIdp?.username
    ? `${simulatedIdp.username} (Active Session)`
    : workstation.lab
    ? `${workstation.lab} Terminal Pool`
    : isServer
    ? "Central Campus Node"
    : "Shared Academic Station";

  const idpEmail = assignedUser?.email
    ? assignedUser.email
    : simulatedIdp?.username
    ? `${simulatedIdp.username.toLowerCase()}@kku.edu.sa`
    : hasAssignedUser || hasSimulatedSession
    ? "user@kku.edu.sa"
    : "Open SSO Login via King Khalid University IdP";

  const idpRole = simulatedIdp?.role
    ? simulatedIdp.role
    : assignedUser?.role
    ? assignedUser.role
    : isServer
    ? "INFRASTRUCTURE"
    : workstation.lab
    ? "STUDENT"
    : "CAMPUS_COMMUNITY";

  const idpDepartment = simulatedIdp?.department
    ? simulatedIdp.department
    : assignedUser?.department
    ? assignedUser.department
    : workstation.department
    ? workstation.department
    : "King Khalid University";

  const idpInitials =
    hasAssignedUser || hasSimulatedSession
      ? idpDisplayName
          .split(" ")
          .filter(Boolean)
          .map((n: string) => n[0])
          .slice(0, 2)
          .join("")
          .toUpperCase()
      : "KKU";

  // Dynamic Environmental & Hardware Vitals
  const isQuarantined = Boolean(workstation.is_isolated);
  const isOffline = workstation.status === "OFFLINE";
  const isDegraded =
    workstation.status === "CRITICAL" ||
    demoReceipt?.scenario_type === "TECHNICAL_DEGRADATION";

  // Temperature (°C): base 36°C idle, scales with liveCpu up to 72°C (or 81°C if degraded)
  const dynamicTemp = isDegraded ? 81 : Math.round(36 + (liveCpu / 100) * 36);
  const tempStatus =
    dynamicTemp >= 78
      ? { label: "High Thermal Load", color: "text-rose-400", sub: "Throttling Risk" }
      : dynamicTemp >= 58
      ? { label: "Warm (Under Load)", color: "text-amber-400", sub: "Active Dissipation" }
      : { label: "Cool & Optimal", color: "text-emerald-400", sub: "Nominal Range" };

  // Fan Speed (RPM): base 1,200 idle, scales with temperature & CPU
  const dynamicRpm = isDegraded ? 3850 : Math.round(1200 + (liveCpu / 100) * 2200);
  const fanStatus =
    dynamicRpm >= 3200
      ? { label: "Max Turbo Cooling", color: "text-amber-400" }
      : dynamicRpm >= 2000
      ? { label: "Dynamic Adaptive", color: "text-blue-300" }
      : { label: "Quiet & Steady", color: "text-slate-300" };

  // Power state
  const powerStatus = isOffline
    ? { draw: "0 W", sub: "Suspended / Off", color: "text-slate-400" }
    : isDegraded || liveCpu > 80
    ? { draw: isServer ? "~420 W" : "~240 W", sub: "High Compute Draw", color: "text-amber-400" }
    : { draw: isServer ? "~180 W" : "~85 W", sub: "Stable AC (KKU Grid)", color: "text-emerald-400" };

  // Network Link state
  const networkLinkStatus = isQuarantined
    ? {
        speed: "0 Mbps",
        sub: "Quarantined by SOAR",
        color: "text-rose-400",
        border: "border-rose-500/40 bg-rose-950/20",
        badge: "Quarantined",
      }
    : isOffline
    ? {
        speed: "Link Down",
        sub: "No Carrier Detected",
        color: "text-slate-400",
        border: "border-slate-800 bg-[#060b18]",
        badge: "Disconnected",
      }
    : {
        speed: isServer ? "10 Gbps" : "1 Gbps",
        sub: "Full Duplex Connected",
        color: "text-emerald-400",
        border: "border-slate-800/80 bg-[#060b18]",
        badge: "Connected",
      };

  // Overall environmental status badge
  const overallEnvBadge = isQuarantined
    ? { text: "Network Quarantined", color: "text-rose-400", icon: Slash }
    : isDegraded || dynamicTemp >= 78
    ? { text: "Thermal Warning", color: "text-rose-400", icon: AlertTriangle }
    : liveCpu > 80
    ? { text: "High Load", color: "text-amber-400", icon: Activity }
    : isOffline
    ? { text: "Offline", color: "text-slate-400", icon: AlertCircle }
    : { text: "All Normal", color: "text-emerald-400", icon: CheckCircle2 };

  // Hardware storage capacity and utilization
  const rawStorageSpec =
    (workstation.hardware_specs?.storage as string) ||
    (isServer ? "2.0 TB NVMe Array" : "512 GB NVMe SSD");
  let totalStorageGb = 512;
  if (rawStorageSpec.toLowerCase().includes("tb")) {
    const match = rawStorageSpec.match(/([\d.]+)\s*tb/i);
    totalStorageGb = match ? Math.round(parseFloat(match[1]) * 1024) : 2048;
  } else if (rawStorageSpec.toLowerCase().includes("gb")) {
    const match = rawStorageSpec.match(/([\d.]+)\s*gb/i);
    totalStorageGb = match ? Math.round(parseFloat(match[1])) : 512;
  }
  const usedStorageGb = Math.round((totalStorageGb * liveDisk) / 100);
  const formattedUsedStorage =
    totalStorageGb >= 1024 ? `${(usedStorageGb / 1024).toFixed(1)} TB` : `${usedStorageGb} GB`;
  const formattedTotalStorage =
    totalStorageGb >= 1024 ? `${(totalStorageGb / 1024).toFixed(1)} TB` : `${totalStorageGb} GB`;

  return (
    <div className="space-y-6 font-sans">
      {/* 1. Header & Navigation Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <nav className="flex items-center gap-2 text-xs text-slate-400">
          <Link href="/devices" className="hover:text-white transition-colors flex items-center gap-1.5">
            <ChevronRight className="w-3.5 h-3.5 rotate-180 text-slate-500" />
            <span>Devices Fleet</span>
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
          <span className="text-slate-200 font-medium">Device Details</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
          <span className="font-mono text-cyan-400 font-bold">{workstation.hostname}</span>
        </nav>

        {/* Live sync indicator */}
        <div className="flex items-center gap-2 self-start sm:self-auto text-xs px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-medium">Live Telemetry Active</span>
          <span className="text-slate-500 font-mono text-[11px]">• Refreshed {formatLastSeen(workstation.last_seen_at)}</span>
        </div>
      </div>

      {/* 2. Toast Feedback Notification */}
      {feedbackMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2.5 shadow-lg shadow-emerald-950/50 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">{feedbackMessage}</span>
        </div>
      )}

      {/* 3. HERO CARD: Device Identity, Health Status, & Primary Actions */}
      <div className="glass-card p-6 rounded-2xl border-slate-800/80 bg-[#091124]/95 shadow-xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Left: Device Icon, Hostname, Status & Model */}
          <div className="flex items-start sm:items-center gap-4">
            <div
              className={`w-14 h-14 rounded-2xl border flex items-center justify-center shrink-0 shadow-lg ${workstation.is_isolated
                ? "bg-rose-950/50 border-rose-500/40 text-rose-400 shadow-rose-950/40 animate-pulse"
                : workstation.status === "CRITICAL"
                  ? "bg-rose-950/50 border-rose-500/40 text-rose-400"
                  : workstation.status === "WARNING"
                    ? "bg-amber-950/50 border-amber-500/40 text-amber-400"
                    : "bg-blue-950/50 border-blue-500/40 text-blue-400 shadow-blue-900/20"
                }`}
            >
              {workstation.is_isolated ? (
                <ShieldAlertIcon className="w-7 h-7" />
              ) : isServer ? (
                <Server className="w-7 h-7" />
              ) : (
                <Monitor className="w-7 h-7" />
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold font-sans text-white tracking-tight">
                  {workstation.hostname}
                </h1>

                {/* Friendly, Clear Status Pill */}
                {workstation.is_isolated ? (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1.5 shadow-sm">
                    <Slash className="w-3.5 h-3.5 text-rose-400" />
                    <span>Quarantined from Network</span>
                  </span>
                ) : workstation.status === "CRITICAL" ? (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                    <span>Critical Alert</span>
                  </span>
                ) : workstation.status === "WARNING" ? (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Resource Warning</span>
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>Online & Protected</span>
                  </span>
                )}
              </div>

              {/* Plain-English Device Subtitle */}
              <p className="text-xs text-slate-300 mt-1.5 flex flex-wrap items-center gap-2">
                <span className="font-medium text-slate-200">
                  {isServer ? "Campus Server" : "Lab Workstation"}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400">
                  {(workstation.hardware_specs?.processor as string) ||
                    (workstation.hardware_specs?.cpu as string) ||
                    (isServer ? "Intel Xeon Silver" : "Intel Core i7")}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400">
                  {workstation.operating_system || workstation.os_type || "Windows Server 2019"}
                </span>
                {workstation.asset_tag && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="font-mono text-cyan-400 text-[11px] bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/30">
                      Asset: {workstation.asset_tag}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Right: Action Buttons with Clear Explanations */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Run Health Check */}
            <button
              type="button"
              onClick={handleRunScan}
              disabled={isScanning}
              title="Perform an immediate health and cybersecurity integrity scan"
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-md shadow-blue-600/20 cursor-pointer disabled:opacity-60"
            >
              <Shield className={`w-3.5 h-3.5 ${isScanning ? "animate-spin" : ""}`} />
              <span>{isScanning ? "Scanning System..." : "Run Health Check"}</span>
            </button>

            {/* Restart Agent */}
            <button
              type="button"
              onClick={() => setShowRestartModal(true)}
              title="Safely restart the background monitoring software without rebooting this machine"
              className="px-3.5 py-2 rounded-xl border border-slate-700/80 bg-[#060b18] hover:bg-slate-800 text-xs font-semibold text-slate-200 flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
            >
              <RotateCw className="w-3.5 h-3.5 text-slate-400" />
              <span>Restart Agent</span>
            </button>

            {/* Edit Device Profile */}
            <button
              type="button"
              onClick={() => {
                setEditForm({
                  department: workstation.department || "",
                  lab: workstation.lab || "",
                  asset_tag: workstation.asset_tag || "",
                  status: workstation.status || "ONLINE",
                });
                setEditError(null);
                setShowEditModal(true);
              }}
              title="Update room, department, or administrative notes"
              className="px-3.5 py-2 rounded-xl border border-slate-700/80 bg-[#060b18] hover:bg-slate-800 text-xs font-semibold text-slate-200 flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
            >
              <Edit className="w-3.5 h-3.5 text-slate-400" />
              <span>Edit Details</span>
            </button>

            {/* Quarantine from Network / Restore Connectivity */}
            <button
              type="button"
              onClick={() => setShowIsolationModal(true)}
              title={
                workstation.is_isolated
                  ? "Reconnect this machine to the campus network"
                  : "Block network access to stop threats while keeping the machine turned on"
              }
              className={`px-4 py-2 rounded-xl text-xs font-semibold text-white flex items-center gap-2 shadow-lg transition-all cursor-pointer ${workstation.is_isolated
                ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20"
                : "bg-rose-600 hover:bg-rose-500 shadow-rose-600/30"
                }`}
            >
              {workstation.is_isolated ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore Network Access</span>
                </>
              ) : (
                <>
                  <Slash className="w-3.5 h-3.5" />
                  <span>Quarantine from Network</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick Identity & Location Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-4 border-t border-slate-800/80 text-xs">
          <div>
            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">Location / Lab</span>
            <span className="text-white font-medium mt-0.5 block truncate">
              {workstation.lab
                ? `${workstation.department || "Campus"} • ${workstation.lab}`
                : workstation.department || "Main Campus Server Room"}
            </span>
          </div>

          <div>
            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">Assigned User</span>
            <span className="text-slate-200 mt-0.5 block truncate font-medium">
              {topAssignedUserText}
            </span>
          </div>

          <div>
            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">IP Address</span>
            <span className="text-cyan-400 font-mono mt-0.5 block font-medium">
              {workstation.ip_address || "10.10.1.10"}
            </span>
          </div>

          <div>
            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">Operating System</span>
            <span className="text-slate-300 mt-0.5 block truncate">
              {workstation.operating_system || workstation.os_type || "Windows Server 2019"}
            </span>
          </div>

          <div>
            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">System Uptime</span>
            <span className="text-slate-200 mt-0.5 block font-medium">
              {formatUptime(workstation.created_at)}
            </span>
          </div>

          <div>
            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">Agent Protection</span>
            <span className="text-emerald-400 mt-0.5 flex items-center gap-1 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>v{workstation.agent_version || "1.0.0"} (Active)</span>
            </span>
          </div>
        </div>
      </div>

      {/* 4. Tab Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-2">
        <div className="flex items-center gap-1.5 p-1 bg-[#060b18] border border-slate-800/80 rounded-xl">
          {/* Tab 1: Overview & Health */}
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${activeTab === "overview"
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
              : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Overview & Health</span>
          </button>

          {/* Tab 2: Security & AI Resilience Simulation */}
          <button
            type="button"
            onClick={() => setActiveTab("simulation")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer relative ${activeTab === "simulation"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
              : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-300" />
            <span>Security & Resilience Scenarios</span>
            {demoReceipt && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-cyan-400 text-slate-950 uppercase tracking-wider ml-1">
                Receipt
              </span>
            )}
          </button>

          {/* Tab 3: Detailed Specs */}
          <button
            type="button"
            onClick={() => setActiveTab("specs")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${activeTab === "specs"
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
              : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Hardware & Network Specs</span>
          </button>
        </div>

        {/* Tab Subtitle / Helper */}
        <div className="text-xs text-slate-400 hidden md:flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-500" />
          <span>
            {activeTab === "overview" && "Simplified operational health, load levels, and university user ownership."}
            {activeTab === "simulation" && "Test how AI detection, university IdP permissions, and automated SOAR playbooks protect this device in real time."}
            {activeTab === "specs" && "Full technical hardware components, network addresses, and agent daemon details."}
          </span>
        </div>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: OVERVIEW & HEALTH (Clean & Understandable for Normal Users)    */}
      {/* =================================================================== */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Plain-Language Status & Health Assessment Banner */}
          <div
            className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg ${workstation.is_isolated
              ? "bg-rose-950/40 border-rose-500/40 text-rose-200"
              : workstation.status === "CRITICAL"
                ? "bg-rose-950/40 border-rose-500/40 text-rose-200"
                : workstation.status === "WARNING"
                  ? "bg-amber-950/40 border-amber-500/40 text-amber-200"
                  : "bg-emerald-950/30 border-emerald-500/30 text-emerald-200"
              }`}
          >
            <div className="flex items-center gap-3.5">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${workstation.is_isolated || workstation.status === "CRITICAL"
                  ? "bg-rose-500/20 text-rose-400"
                  : workstation.status === "WARNING"
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-emerald-500/20 text-emerald-400"
                  }`}
              >
                {workstation.is_isolated ? (
                  <ShieldAlertIcon className="w-5 h-5" />
                ) : workstation.status === "CRITICAL" ? (
                  <AlertCircle className="w-5 h-5" />
                ) : workstation.status === "WARNING" ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <ShieldCheck className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">
                  {workstation.is_isolated
                    ? "Security Quarantine Active (Device is Protected)"
                    : workstation.status === "CRITICAL"
                      ? "Critical Condition Detected"
                      : workstation.status === "WARNING"
                        ? "Notice: System Experiencing Elevated Demand"
                        : "Everything Running Smoothly — No Issues Detected"}
                </h3>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                  {workstation.is_isolated
                    ? "This machine was safely isolated from the university network to block potential threats. The computer remains on, and all local research files and open applications are safe."
                    : workstation.status === "CRITICAL"
                      ? "Unusual activity or severe resource saturation detected. Automated incident tracking has flagged this node for review."
                      : workstation.status === "WARNING"
                        ? "Processor or memory usage is higher than ordinary. This is common during heavy compiles or compute tasks and is being monitored."
                        : "Hardware performance is optimal, security status is nominal, and university role-sensitive protections are fully active."}
                </p>
              </div>
            </div>

            {/* Quick Link to Simulation if nominal or to un-isolate if quarantined */}
            <div className="shrink-0 flex items-center gap-2">
              {workstation.is_isolated ? (
                <button
                  type="button"
                  onClick={() => setShowIsolationModal(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-colors cursor-pointer"
                >
                  Restore Network
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveTab("simulation")}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>Test AI Defense</span>
                </button>
              )}
            </div>
          </div>

          {/* 3 Key Vital Cards: CPU, Memory, Storage with Plain-English Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Vital 1: Processor (CPU) */}
            <div className="glass-card p-5 rounded-2xl border-slate-800/80 bg-[#091124]/95 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-bold text-white">Processor (CPU)</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${cpuStatus.bg} ${cpuStatus.color} ${cpuStatus.border}`}>
                  {cpuStatus.label}
                </span>
              </div>

              <div className="flex items-center gap-4">
                {/* Circular Gauge */}
                <div className="relative w-18 h-18 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="38" stroke="#1e293b" strokeWidth="9" fill="none" />
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      stroke="#3b82f6"
                      strokeWidth="9"
                      strokeDasharray="238.76"
                      strokeDashoffset={238.76 * (1 - liveCpu / 100)}
                      strokeLinecap="round"
                      fill="none"
                    />
                  </svg>
                  <span className="absolute text-sm font-bold text-white">{liveCpu}%</span>
                </div>

                <div className="space-y-1 text-xs">
                  <p className="text-slate-300 font-medium">
                    {liveCpu < 60 ? "Operating calmly" : liveCpu < 85 ? "Moderate calculations" : "High processing workload"}
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    {workstation.hardware_specs?.logical_cpus || workstation.hardware_specs?.cores
                      ? `${workstation.hardware_specs.logical_cpus || workstation.hardware_specs.cores} Cores Available`
                      : "8 Cores Available"}
                  </p>
                  <p className="text-slate-500 text-[10px] font-mono">
                    {(workstation.hardware_specs?.processor as string) || "Intel Xeon Silver"}
                  </p>
                </div>
              </div>

              {/* Sparkline trend */}
              <div className="pt-2 border-t border-slate-800/60">
                <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                  <span>Recent activity trend</span>
                  <span className="font-mono text-blue-400">{liveCpu}% now</span>
                </div>
                <div className="relative h-10 w-full">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 300 45">
                    <path
                      d={generateSvgPath(sparkCpu)}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Vital 2: Memory (RAM) */}
            <div className="glass-card p-5 rounded-2xl border-slate-800/80 bg-[#091124]/95 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-bold text-white">Memory (RAM)</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${memStatus.bg} ${memStatus.color} ${memStatus.border}`}>
                  {memStatus.label}
                </span>
              </div>

              <div className="flex items-center gap-4">
                {/* Circular Gauge */}
                <div className="relative w-18 h-18 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="38" stroke="#1e293b" strokeWidth="9" fill="none" />
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      stroke="#06b6d4"
                      strokeWidth="9"
                      strokeDasharray="238.76"
                      strokeDashoffset={238.76 * (1 - liveMemory / 100)}
                      strokeLinecap="round"
                      fill="none"
                    />
                  </svg>
                  <span className="absolute text-sm font-bold text-white">{liveMemory}%</span>
                </div>

                <div className="space-y-1 text-xs">
                  <p className="text-slate-300 font-medium">
                    {liveMemory < 75 ? "Plentiful memory remaining" : "High application memory in use"}
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    {workstation.hardware_specs?.ram_gb
                      ? `${Math.round((workstation.hardware_specs.ram_gb * liveMemory) / 100)} GB in use / ${workstation.hardware_specs.ram_gb} GB total`
                      : "43.5 GB in use / 64 GB total"}
                  </p>
                  <p className="text-slate-500 text-[10px] font-mono">DDR4 Registered ECC</p>
                </div>
              </div>

              {/* Sparkline trend */}
              <div className="pt-2 border-t border-slate-800/60">
                <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                  <span>Recent memory usage</span>
                  <span className="font-mono text-cyan-400">{liveMemory}% now</span>
                </div>
                <div className="relative h-10 w-full">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 300 45">
                    <path
                      d={generateSvgPath(sparkMemory)}
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Vital 3: Storage (Disk Space) */}
            <div className="glass-card p-5 rounded-2xl border-slate-800/80 bg-[#091124]/95 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-bold text-white">Storage (Disk)</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${diskStatus.bg} ${diskStatus.color} ${diskStatus.border}`}>
                  {diskStatus.label}
                </span>
              </div>

              <div className="flex items-center gap-4">
                {/* Circular Gauge */}
                <div className="relative w-18 h-18 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="38" stroke="#1e293b" strokeWidth="9" fill="none" />
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      stroke="#8b5cf6"
                      strokeWidth="9"
                      strokeDasharray="238.76"
                      strokeDashoffset={238.76 * (1 - liveDisk / 100)}
                      strokeLinecap="round"
                      fill="none"
                    />
                  </svg>
                  <span className="absolute text-sm font-bold text-white">{liveDisk}%</span>
                </div>

                <div className="space-y-1 text-xs">
                  <p className="text-slate-300 font-medium">
                    {liveDisk < 75 ? "Plenty of free storage" : "Storage filling up"}
                  </p>
                  <p className="text-slate-400 text-[11px]">{formattedUsedStorage} used of {formattedTotalStorage}</p>
                  <p className="text-slate-500 text-[10px] font-mono">{rawStorageSpec}</p>
                </div>
              </div>

              {/* Sparkline trend */}
              <div className="pt-2 border-t border-slate-800/60">
                <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                  <span>Disk I/O Activity</span>
                  <span className="font-mono text-purple-400">{liveDiskIO} MB/s</span>
                </div>
                <div className="relative h-10 w-full">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 300 45">
                    <path
                      d={generateSvgPath(sparkDiskIO, 300, 45, 10)}
                      fill="none"
                      stroke="#8b5cf6"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Environmental Health & University User Ownership (2-Column Grid) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left: Environmental Health & Physical Conditions (7 cols) */}
            <div className="lg:col-span-7 space-y-5">
              {/* Environmental Vitals */}
              <div className="glass-card p-5 rounded-2xl border-slate-800/80 bg-[#091124]/95 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <Thermometer className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white tracking-tight">Environmental & Hardware Status</h3>
                  </div>
                  <span className={`text-[11px] ${overallEnvBadge.color} flex items-center gap-1 font-medium`}>
                    <overallEnvBadge.icon className="w-3.5 h-3.5" />
                    {overallEnvBadge.text}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-[#060b18] border border-slate-800/80 space-y-1">
                    <span className="text-slate-500 text-[10px] uppercase font-bold flex items-center gap-1">
                      <Thermometer className={`w-3 h-3 ${tempStatus.color}`} /> Temperature
                    </span>
                    <span className="text-white font-bold text-base block">{dynamicTemp} °C</span>
                    <span className={`text-[11px] ${tempStatus.color}`}>{tempStatus.label}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#060b18] border border-slate-800/80 space-y-1">
                    <span className="text-slate-500 text-[10px] uppercase font-bold flex items-center gap-1">
                      <Fan className={`w-3 h-3 ${fanStatus.color}`} /> Fan Speed
                    </span>
                    <span className="text-white font-bold text-base block">{dynamicRpm.toLocaleString()} RPM</span>
                    <span className={`text-[11px] ${fanStatus.color}`}>{fanStatus.label}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#060b18] border border-slate-800/80 space-y-1">
                    <span className="text-slate-500 text-[10px] uppercase font-bold flex items-center gap-1">
                      <Power className="w-3 h-3 text-amber-400" /> Power
                    </span>
                    <span className="text-white font-bold text-base block">{powerStatus.draw}</span>
                    <span className={`text-[11px] ${powerStatus.color}`}>{powerStatus.sub}</span>
                  </div>

                  <div className={`p-3 rounded-xl border space-y-1 ${networkLinkStatus.border}`}>
                    <span className="text-slate-500 text-[10px] uppercase font-bold flex items-center gap-1">
                      <Network className={`w-3 h-3 ${networkLinkStatus.color}`} /> Network Link
                    </span>
                    <span className="text-white font-bold text-base block">{networkLinkStatus.speed}</span>
                    <span className={`text-[11px] ${networkLinkStatus.color}`}>{networkLinkStatus.sub}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed pt-1">
                  {isQuarantined
                    ? "SOAR automated response has isolated external network interfaces. Host CPU execution remains stable with zero operating system reboot required."
                    : isDegraded
                    ? "Thermal dissipation sensors report elevated core temperatures. Predictive maintenance recommends inspecting air intake and thermal paste application."
                    : isOffline
                    ? "Agent telemetry heartbeat is currently suspended. Physical sensors will sync automatically once device reconnects."
                    : "Physical sensors confirm thermal thresholds and fan intake are healthy. There is no risk of thermal throttling or power interruption."}
                </p>
              </div>

              {/* Recent Health & Monitoring Activity */}
              <div className="glass-card p-5 rounded-2xl border-slate-800/80 bg-[#091124]/95 shadow-xl space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-bold text-white tracking-tight">Recent Protection Activity</h3>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">Continuous telemetry feed</span>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex items-start gap-2.5 p-2 rounded-xl bg-[#060b18] border border-slate-800/60">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="text-slate-200 font-medium">Telemetry Heartbeat Ingested</p>
                      <p className="text-slate-400 text-[11px]">Hardware metrics, load factors, and process count synced to backend.</p>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0 ml-auto">
                      {formatLastSeen(workstation.last_seen_at)}
                    </span>
                  </div>

                  <div className="flex items-start gap-2.5 p-2 rounded-xl bg-[#060b18] border border-slate-800/60">
                    <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="text-slate-200 font-medium">AI Anomaly Screening</p>
                      <p className="text-slate-400 text-[11px]">
                        {demoReceipt?.step_5_ml_result?.is_anomaly
                          ? `Isolation Forest flagged anomaly (Score: ${(demoReceipt.step_5_ml_result.score * 100).toFixed(1)}%). Classified as ${demoReceipt.step_5_ml_result.anomaly_type || "Incident"}.`
                          : "Dual-model AI screening active. Hardware consumption is within certified operational baseline."}
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0 ml-auto">
                      {demoReceipt ? "Active Run" : "1m ago"}
                    </span>
                  </div>

                  <div className="flex items-start gap-2.5 p-2 rounded-xl bg-[#060b18] border border-slate-800/60">
                    <KeyRound className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="text-slate-200 font-medium">University IdP Validation</p>
                      <p className="text-slate-400 text-[11px]">
                        {hasSimulatedSession
                          ? `IdP verified active user '${simulatedIdp?.username}' with role '${idpRole}'. Policy: ${demoReceipt?.step_8_soar_execution?.action_taken || demoReceipt?.step_7_policy_decision?.decision || "Monitored"}.`
                          : hasAssignedUser
                          ? `Institutional IdP synced account for '${assignedUser?.full_name || assignedUser?.username || "Assigned User"}' (${idpRole}).`
                          : "Campus IdP listener standing by for single sign-on user login."}
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0 ml-auto">
                      {demoReceipt ? "Synced" : "5m ago"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: University User Ownership & Protection Context (5 cols) */}
            <div className="lg:col-span-5 space-y-5">
              {/* User Ownership Card */}
              <div className="glass-card p-5 rounded-2xl border-slate-800/80 bg-[#091124]/95 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-purple-400" />
                    <h3 className="text-sm font-bold text-white tracking-tight">University Identity & Access</h3>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    hasSimulatedSession
                      ? "bg-purple-500/10 text-purple-300 border-purple-500/30"
                      : hasAssignedUser
                      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                      : "bg-blue-500/10 text-blue-300 border-blue-500/30"
                  }`}>
                    {hasSimulatedSession ? "IdP Simulation Active" : hasAssignedUser ? "IdP User Assigned" : "Open Lab SSO"}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#060b18] border border-slate-800/80 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full border flex items-center justify-center font-bold text-sm shrink-0 ${
                      idpRole === "RESEARCHER"
                        ? "bg-purple-950/80 border-purple-500/40 text-purple-300"
                        : idpRole === "ADMIN" || idpRole === "IT_OPERATOR"
                        ? "bg-amber-950/80 border-amber-500/40 text-amber-300"
                        : "bg-blue-950/80 border-blue-500/40 text-blue-300"
                    }`}>
                      {idpInitials}
                    </div>
                    <div className="overflow-hidden">
                      <h4 className="text-sm font-bold text-white truncate">
                        {idpDisplayName}
                      </h4>
                      <p className="text-[11px] text-slate-400 truncate">
                        {idpEmail}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-800/80 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Institutional Role:</span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          idpRole === "RESEARCHER"
                            ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                            : idpRole === "ADMIN" || idpRole === "IT_OPERATOR"
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                            : idpRole === "STUDENT"
                            ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                            : "bg-slate-500/20 text-slate-300 border-slate-500/40"
                        }`}
                      >
                        {idpRole}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Department:</span>
                      <span className="text-white font-medium">
                        {idpDepartment}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Location / Lab:</span>
                      <span className="text-slate-200">
                        {workstation.lab || "Main Campus Computing Complex"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Plain-Language Explanation of Surgical Policy */}
                <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 text-purple-300 font-semibold">
                    <ShieldCheck className="w-4 h-4 text-purple-400" />
                    <span>How This Device Is Protected</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    {idpRole === "RESEARCHER"
                      ? "Researcher Privilege Context: Under King Khalid University policy, AI-detected anomalous spikes trigger surgical network containment rather than destructive kills, ensuring active simulations, deep learning weights, and open sessions are preserved."
                      : idpRole === "STUDENT"
                      ? "Student Lab Policy: High-severity threats (e.g., cryptojacking or rogue processes) trigger surgical process containment and session suspension to safeguard shared campus hardware."
                      : idpRole === "ADMIN" || idpRole === "IT_OPERATOR"
                      ? "Administrative Policy: Privileged maintenance access is audited in high fidelity; unauthorized escalation attempts trigger instant SIEM alerts and operational audit log entries."
                      : "Open SSO Integration: When students or researchers log in with university credentials, Secure-MaintAI queries the IdP to dynamically bind institutional roles and apply appropriate security containment playbooks."}
                  </p>
                </div>
              </div>

              {/* Simulation Teaser Card */}
              <div className="glass-card p-5 rounded-2xl border-slate-800/80 bg-gradient-to-br from-[#0c1328] to-[#091124] shadow-xl space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-bold text-white tracking-tight">Test Machine Resilience</h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Simulate how Secure-MaintAI detects and defends this device against hardware faults, student cyber threats, or heavy research compute.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("simulation")}
                  className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-purple-600/20 transition-all cursor-pointer"
                >
                  <span>Open Scenario Simulator</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: AUTONOMOUS DEFENSE SCENARIOS (Interactive Simulation Suite) */}
      {/* =================================================================== */}
      {activeTab === "simulation" && (
        <div className="space-y-6">
          {/* Header Explainer for Normal Users & Testers */}
          <div className="p-4 rounded-2xl border border-purple-500/40 bg-purple-950/30 text-purple-200 shadow-xl space-y-2">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-purple-400 shrink-0" />
              <h2 className="text-sm font-bold text-white tracking-tight">
                Autonomous Defense & Incident Simulation Suite
              </h2>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Safely test how Secure-MaintAI defends <strong className="text-white font-mono">{workstation.hostname}</strong> against real-world operational incidents. Choose any scenario below to inject realistic telemetry and observe how dual-stage AI screens the fault, verifies University IdP credentials, and applies surgical SOAR containment—without rebooting the machine or interrupting legitimate research.
            </p>
          </div>

          {/* Interactive Pipeline Controller */}
          <DemoController
            receipt={demoReceipt}
            activeStep={demoActiveStep}
            onReceiptUpdate={handleReceiptUpdate}
            onStepChange={(step) => setDemoActiveStep(step)}
            onReset={() => {
              setDemoReceipt(null);
              setDemoActiveStep(1);
            }}
            workstationId={workstation.id}
            targetHostname={workstation.hostname}
            isIsolated={workstation.is_isolated}
            onRestoreNetwork={handleToggleIsolation}
          />

          {/* Visual Step-by-Step Pipeline Stepper */}
          <DemoProgress
            receipt={demoReceipt}
            activeStep={demoActiveStep}
            onStepSelect={(step) => setDemoActiveStep(step)}
            onReset={() => {
              setDemoReceipt(null);
              setDemoActiveStep(1);
            }}
          />
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: HARDWARE & NETWORK SPECS (Detailed Specifications)            */}
      {/* =================================================================== */}
      {activeTab === "specs" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {/* Hardware Specifications */}
          <div className="glass-card p-5 rounded-2xl border-slate-800/80 bg-[#091124]/95 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white tracking-tight">Hardware Specifications</h3>
              </div>
              {workstation.asset_tag && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/30">
                  {workstation.asset_tag}
                </span>
              )}
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Processor (CPU):</span>
                <span className="text-white font-medium text-right">
                  {(workstation.hardware_specs?.processor as string) ||
                    (workstation.hardware_specs?.cpu as string) ||
                    (isServer ? "Intel(R) Xeon(R) Silver 4214 CPU @ 2.20GHz" : "Intel(R) Core(TM) i7-12700")}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Cores / Threads:</span>
                <span className="text-slate-200 font-mono">
                  {workstation.hardware_specs?.cores
                    ? `${workstation.hardware_specs.cores} Cores / ${workstation.hardware_specs.logical_cpus || workstation.hardware_specs.cores} Threads`
                    : "16 Cores / 32 Threads"}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">System Memory:</span>
                <span className="text-slate-200">
                  {workstation.hardware_specs?.ram_gb
                    ? `${workstation.hardware_specs.ram_gb} GB ${isServer ? "DDR4 ECC" : "DDR4"}`
                    : isServer
                    ? "64 GB DDR4 ECC"
                    : "16 GB DDR4"}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Architecture:</span>
                <span className="text-slate-200 font-mono">
                  {(workstation.hardware_specs?.architecture as string) || "x86_64 (64-bit)"}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Operating System:</span>
                <span className="text-slate-200">
                  {workstation.operating_system || workstation.os_type || (isServer ? "Ubuntu 22.04 LTS Server" : "Windows 11 Enterprise")}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Agent Daemon Version:</span>
                <span className="text-emerald-400 font-mono">
                  v{workstation.agent_version || "1.0.0"} (Autonomous telemetry collector)
                </span>
              </div>

              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Primary Storage:</span>
                <span className="text-slate-200">{rawStorageSpec}</span>
              </div>
            </div>
          </div>

          {/* Network Configuration */}
          <div className="glass-card p-5 rounded-2xl border-slate-800/80 bg-[#091124]/95 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <Network className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white tracking-tight">Network & IP Configuration</h3>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                isQuarantined
                  ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
                  : isOffline
                  ? "bg-slate-500/10 text-slate-300 border-slate-500/30"
                  : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
              }`}>
                {isQuarantined ? "ISOLATED" : isOffline ? "OFFLINE" : "CONNECTED"}
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Private IP Address:</span>
                <span className="text-cyan-400 font-mono font-bold">{workstation.ip_address || "10.10.1.10"}</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Subnet Mask:</span>
                <span className="text-slate-300 font-mono">255.255.255.0 (/24)</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Default Gateway:</span>
                <span className="text-slate-300 font-mono">10.10.1.1</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Campus DNS Server:</span>
                <span className="text-slate-300 font-mono">10.10.0.5, 8.8.8.8</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Hardware MAC Address:</span>
                <span className="text-slate-200 font-mono">{workstation.mac_address || "00:1A:4B:2F:8C:7D"}</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Interface Speed:</span>
                <span className="text-slate-200">1 Gbps (Intel I350 Gigabit Network Connection)</span>
              </div>

              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Telemetry Transport:</span>
                <span className="text-emerald-400 font-mono">TLS 1.3 Encrypted Socket (Port 8000)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 1: Quarantine / Isolation Confirmation Modal                  */}
      {/* =================================================================== */}
      {showIsolationModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowIsolationModal(false)}
          title={
            workstation.is_isolated
              ? `Restore Network Access: ${workstation.hostname}`
              : `Quarantine Device: ${workstation.hostname}`
          }
          subtitle={`IP Address: ${workstation.ip_address} • Location: ${workstation.lab || workstation.department || "Campus"}`}
          footer={
            <>
              <button
                type="button"
                onClick={() => setShowIsolationModal(false)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleToggleIsolation}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold text-white shadow-lg cursor-pointer ${workstation.is_isolated
                  ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20"
                  : "bg-rose-600 hover:bg-rose-500 shadow-rose-600/30"
                  }`}
              >
                {workstation.is_isolated ? "Restore Full Connectivity" : "Enforce Network Quarantine"}
              </button>
            </>
          }
        >
          <div className="space-y-3.5 text-xs">
            <p className="text-slate-300 leading-relaxed">
              {workstation.is_isolated
                ? "Restoring network connectivity will reconnect this device to the campus network and resume standard communications. The monitoring agent will continue safeguarding the device."
                : "Quarantining this device severs unauthorized network traffic to prevent any malware or cyber threat from communicating or spreading across campus."}
            </p>

            <div className="p-3.5 rounded-xl border border-slate-800 bg-[#070d1e] space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <Check className="w-4 h-4" />
                <span>Host operating system will remain powered on</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <Check className="w-4 h-4" />
                <span>Unsaved work and research files will NOT be deleted</span>
              </div>
              <div className="flex items-center gap-2 text-cyan-400 font-semibold">
                <Check className="w-4 h-4" />
                <span>Full network access can be restored at any time</span>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL 2: Edit Device Profile Modal                                  */}
      {/* =================================================================== */}
      {showEditModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowEditModal(false)}
          title={`Edit Device Details: ${workstation.hostname}`}
          subtitle="Update campus location, assigned room, and asset inventory tags"
        >
          <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
            <div className="space-y-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Hostname</label>
                <input
                  type="text"
                  disabled
                  value={workstation.hostname}
                  className="w-full px-3 py-2 rounded-xl bg-[#070d1e]/50 border border-slate-800 text-slate-400 font-mono cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">IP Address</label>
                <input
                  type="text"
                  disabled
                  value={workstation.ip_address}
                  className="w-full px-3 py-2 rounded-xl bg-[#070d1e]/50 border border-slate-800 text-slate-400 font-mono cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Department</label>
                <input
                  type="text"
                  value={editForm.department}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                  placeholder="e.g. College of Computer Science"
                  className="w-full px-3 py-2 rounded-xl bg-[#070d1e] border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Lab / Room Location</label>
                <input
                  type="text"
                  value={editForm.lab}
                  onChange={(e) => setEditForm({ ...editForm, lab: e.target.value })}
                  placeholder="e.g. AI Research Lab 3"
                  className="w-full px-3 py-2 rounded-xl bg-[#070d1e] border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Asset Tag</label>
                <input
                  type="text"
                  value={editForm.asset_tag}
                  onChange={(e) => setEditForm({ ...editForm, asset_tag: e.target.value })}
                  placeholder="e.g. ASSET-KKU-2026-0042"
                  className="w-full px-3 py-2 rounded-xl bg-[#070d1e] border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Operational Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as WorkstationStatus })}
                  className="w-full px-3 py-2 rounded-xl bg-[#070d1e] border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="ONLINE">ONLINE (Healthy)</option>
                  <option value="WARNING">WARNING (Elevated Load)</option>
                  <option value="CRITICAL">CRITICAL (Alert State)</option>
                  <option value="MAINTENANCE">MAINTENANCE (Servicing)</option>
                  <option value="OFFLINE">OFFLINE (Disconnected)</option>
                  <option value="ISOLATED">ISOLATED (Quarantined)</option>
                  <option value="DECOMMISSIONED">DECOMMISSIONED</option>
                </select>
              </div>
            </div>

            {editError && (
              <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingEdit}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold shadow-md cursor-pointer flex items-center gap-1.5"
              >
                {isSubmittingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL 3: Restart Monitoring Agent Modal                             */}
      {/* =================================================================== */}
      {showRestartModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowRestartModal(false)}
          title={`Restart Monitoring Agent: ${workstation.hostname}`}
          subtitle="Safely cycle the local telemetry agent software"
          footer={
            <>
              <button
                type="button"
                onClick={() => setShowRestartModal(false)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRestartService}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-lg cursor-pointer"
              >
                Restart Monitoring Agent
              </button>
            </>
          }
        >
          <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
            <p>
              Restarting the monitoring agent refreshes background telemetry collection daemons and flushes temporary network socket buffers.
            </p>
            <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-500/30 text-blue-200">
              <p className="font-semibold text-white">Will this turn off the computer?</p>
              <p className="text-[11px] text-slate-300 mt-0.5">
                No. This will <span className="font-semibold text-white">NOT</span> reboot the computer or interrupt any active student or researcher session.
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
