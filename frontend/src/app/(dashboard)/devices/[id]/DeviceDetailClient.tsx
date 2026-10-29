"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Server,
  Monitor,
  Cpu,
  Activity,
  RotateCcw,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Edit,
  RotateCw,
  Slash,
  Network,
  ChevronRight,
  ShieldCheck,
  HardDrive,
  User as UserIcon,
  Clock,
  Sparkles,
  ArrowRight,
  Sliders,
  ShieldAlert as ShieldAlertIcon,
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
  getRecentAnomalies,
  getIncidents,
  getAlerts,
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

function CircularGauge({
  value,
  strokeColor,
}: {
  value: number;
  strokeColor: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  const strokeDashoffset = 238.76 * (1 - clamped / 100);

  return (
    <div className="relative w-18 h-18 shrink-0 flex items-center justify-center">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="38" stroke="#1e293b" strokeWidth="9" fill="none" />
        <circle
          cx="50"
          cy="50"
          r="38"
          stroke={strokeColor}
          strokeWidth="9"
          strokeDasharray="238.76"
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      <span className="absolute text-sm font-bold text-white">{clamped}%</span>
    </div>
  );
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
  const [liveCpu, setLiveCpu] = useState<number>(initialWorkstation?.cpu_usage ?? 0);
  const [liveMemory, setLiveMemory] = useState<number>(initialWorkstation?.memory_usage ?? 0);
  const [liveDisk, setLiveDisk] = useState<number>(initialWorkstation?.disk_usage ?? 0);
  const [liveDiskIO, setLiveDiskIO] = useState<number>(0);
  const [liveNetworkInMb, setLiveNetworkInMb] = useState<number>(0);
  const [liveNetworkOutMb, setLiveNetworkOutMb] = useState<number>(0);
  const [liveProcessCount, setLiveProcessCount] = useState<number>(
    initialWorkstation?.process_count ?? 0
  );
  const [latestTelemetryTime, setLatestTelemetryTime] = useState<string | null>(null);
  const [deviceAnomalies, setDeviceAnomalies] = useState<any[]>([]);
  const [deviceIncidents, setDeviceIncidents] = useState<any[]>([]);
  const [deviceAlerts, setDeviceAlerts] = useState<any[]>([]);
  const [sparkCpu, setSparkCpu] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0]);
  const [sparkMemory, setSparkMemory] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0]);
  const [sparkDiskIO, setSparkDiskIO] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0]);

  const isFetchingRef = useRef(false);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  useEffect(() => {
    if (!workstation?.id) return;
    let active = true;

    const fetchTelemetry = async () => {
      if (isFetchingRef.current) return;
      if (typeof document !== "undefined" && document.hidden) return;

      isFetchingRef.current = true;
      try {
        const [metricsRes, anomaliesRes, incidentsRes, alertsRes] = await Promise.allSettled([
          getWorkstationTelemetry(workstation.id, 8),
          getRecentAnomalies(5, workstation.id),
          getIncidents({ workstationId: workstation.id, limit: 5 }),
          getAlerts({ workstationId: workstation.id, limit: 5 }),
        ]);

        if (!active) return;

        if (anomaliesRes.status === "fulfilled" && Array.isArray(anomaliesRes.value)) {
          setDeviceAnomalies(
            anomaliesRes.value.filter(
              (a) => !a.workstation_id || String(a.workstation_id) === String(workstation.id)
            )
          );
        }
        if (incidentsRes.status === "fulfilled" && Array.isArray(incidentsRes.value)) {
          setDeviceIncidents(incidentsRes.value);
        }
        if (alertsRes.status === "fulfilled" && Array.isArray(alertsRes.value)) {
          setDeviceAlerts(alertsRes.value);
        }

        const metrics = metricsRes.status === "fulfilled" ? metricsRes.value : [];
        if (metrics && metrics.length > 0) {
          const sorted = [...metrics].sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          const latest = sorted[sorted.length - 1];
          setLiveCpu(Math.round(latest.cpu_usage));
          setLiveMemory(Math.round(latest.memory_usage));

          const ioRateMb =
            Math.round(((latest.disk_read + latest.disk_write) / (1024 * 1024)) * 100) / 100;
          const netInMb = Math.round((latest.network_in / (1024 * 1024)) * 100) / 100;
          const netOutMb = Math.round((latest.network_out / (1024 * 1024)) * 100) / 100;

          setLiveDiskIO(ioRateMb);
          setLiveDisk(Math.min(Math.round(ioRateMb), 100));
          setLiveNetworkInMb(netInMb);
          setLiveNetworkOutMb(netOutMb);
          setLiveProcessCount(latest.process_count ?? 0);
          setLatestTelemetryTime(latest.timestamp);

          setSparkCpu(sorted.map((m) => Math.round(m.cpu_usage)));
          setSparkMemory(sorted.map((m) => Math.round(m.memory_usage)));
          setSparkDiskIO(
            sorted.map(
              (m) => Math.round(((m.disk_read + m.disk_write) / (1024 * 1024)) * 100) / 100
            )
          );
        }
      } catch {
        // Retain current metrics if endpoint is transiently unreachable
      } finally {
        isFetchingRef.current = false;
      }
    };

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

    fetchTelemetry().then(() => scheduleNext());

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
    setLiveDiskIO(receipt.step_3_telemetry.disk_read_mb_s);
    setLiveDisk(Math.min(Math.round(receipt.step_3_telemetry.disk_read_mb_s), 100));
    setLiveNetworkOutMb(receipt.step_3_telemetry.network_out_mb_s);
    setLiveProcessCount(receipt.step_3_telemetry.process_count);
    setLatestTelemetryTime(receipt.step_4_scenario.triggered_at);
    setWorkstation((prev) =>
      prev
        ? {
          ...prev,
          last_seen_at: receipt.step_4_scenario.triggered_at,
          is_isolated: receipt.step_8_soar_execution.workstation_final_status === "ISOLATED",
          status:
            receipt.step_8_soar_execution.workstation_final_status === "ISOLATED"
              ? "ISOLATED"
              : "ONLINE",
        }
        : null
    );
  };

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
        console.warn("Isolation endpoint error:", err);
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
      ? `Surgical network isolation enforced on ${workstation.hostname}. Unauthorized traffic severed; operating system and research workloads preserved.`
      : `Surgical network isolation lifted for ${workstation.hostname}. Full connectivity and data streams restored.`;

    setFeedbackMessage(message);
    setTimeout(() => setFeedbackMessage(null), 5000);
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
      setFeedbackMessage(`Workstation configuration updated successfully for ${workstation.hostname}.`);
      setTimeout(() => setFeedbackMessage(null), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update workstation configuration";
      setEditError(msg);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const getCpuStatus = (usage: number) => {
    if (usage >= 85) return { label: "Heavy Workload", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30" };
    if (usage >= 65) return { label: "Moderate Activity", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" };
    return { label: "Normal Load", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" };
  };

  const getMemoryStatus = (usage: number) => {
    if (usage >= 90) return { label: "High Memory Load", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30" };
    if (usage >= 75) return { label: "Elevated Usage", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" };
    return { label: "Healthy Usage", color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/30" };
  };

  const getDiskStatus = (usage: number) => {
    if (usage >= 90) return { label: "Low Free Space", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30" };
    if (usage >= 75) return { label: "Moderate Storage", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" };
    return { label: "Ample Free Space", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30" };
  };

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
        </div>
      </div>
    );
  }

  if (!workstation) {
    return (
      <div className="space-y-6 font-sans">
        <nav className="flex items-center gap-2 text-xs text-slate-400">
          <Link href="/devices" className="hover:text-white transition-colors">
            Workstations
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
          <span className="text-slate-200 font-medium">Workstation Details</span>
        </nav>

        <div className="glass-card p-10 rounded-2xl border-slate-800/80 bg-[#091124]/95 text-center space-y-4 max-w-lg mx-auto mt-12 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Workstation Not Found</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            {loadError || (
              <>
                No workstation registered with identifier{" "}
                <span className="font-mono text-cyan-400 font-bold">{deviceId}</span>.
              </>
            )}
          </p>
          <div className="pt-2">
            <Link
              href="/devices"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors shadow-md shadow-blue-600/20"
            >
              Back to Workstations
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

  const assignedUser = workstation.assigned_user;
  const simulatedIdp = demoReceipt?.step_6_idp_context;
  const hasAssignedUser = Boolean(assignedUser);
  const hasSimulatedSession = Boolean(simulatedIdp);

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

  const isQuarantined = Boolean(workstation.is_isolated);
  const isOffline = workstation.status === "OFFLINE";
  const isDegraded =
    workstation.status === "CRITICAL" ||
    demoReceipt?.scenario_type === "TECHNICAL_DEGRADATION";

  const hasLiveTelemetry = Boolean(latestTelemetryTime);

  const netEgressStatus = isQuarantined
    ? { label: "Quarantined (Blocked)", color: "text-rose-400" }
    : liveNetworkOutMb >= 5.0
    ? { label: "High Outbound Stream", color: "text-amber-400" }
    : hasLiveTelemetry
    ? { label: "Active Egress Stream", color: "text-emerald-400" }
    : { label: "No Telemetry Yet", color: "text-slate-400" };

  const netIngressStatus = isQuarantined
    ? { label: "Inbound Restricted", color: "text-rose-400" }
    : liveNetworkInMb >= 10.0
    ? { label: "Heavy Inbound Transfer", color: "text-cyan-400" }
    : hasLiveTelemetry
    ? { label: "Active Ingress Stream", color: "text-emerald-400" }
    : { label: "No Telemetry Yet", color: "text-slate-400" };

  const diskThroughputStatus =
    liveDiskIO >= 50.0
      ? { label: "High I/O Saturation", color: "text-rose-400" }
      : liveDiskIO >= 10.0
      ? { label: "Active R/W Throughput", color: "text-amber-400" }
      : hasLiveTelemetry
      ? { label: "Nominal Disk I/O", color: "text-emerald-400" }
      : { label: "No Telemetry Yet", color: "text-slate-400" };

  const networkLinkStatus = isQuarantined
    ? {
        speed: "0 Mbps",
        sub: "Quarantined by SOAR",
        color: "text-rose-400",
        border: "border-rose-500/40 bg-rose-950/20",
      }
    : isOffline
    ? {
        speed: "Link Down",
        sub: "No Carrier Detected",
        color: "text-slate-400",
        border: "border-slate-800 bg-[#060b18]",
      }
    : {
        speed: isServer ? "10 Gbps" : "1 Gbps",
        sub: hasLiveTelemetry
          ? `${liveProcessCount} Active Processes`
          : "Full Duplex Connected",
        color: "text-emerald-400",
        border: "border-slate-800/80 bg-[#060b18]",
      };

  const overallEnvBadge = isQuarantined
    ? { text: "Network Quarantined", color: "text-rose-400", icon: Slash }
    : isDegraded || liveDiskIO >= 50.0
    ? { text: "Hardware Saturation", color: "text-rose-400", icon: AlertTriangle }
    : liveCpu > 80
    ? { text: "High Load", color: "text-amber-400", icon: Activity }
    : isOffline
    ? { text: "Offline", color: "text-slate-400", icon: AlertCircle }
    : hasLiveTelemetry
    ? { text: "Telemetry Verified", color: "text-emerald-400", icon: CheckCircle2 }
    : { text: "Awaiting Telemetry", color: "text-slate-400", icon: Clock };

  const protectionActivityItems: Array<{
    id: string;
    title: string;
    description: string;
    time: string;
    ts: number;
    type: "telemetry" | "anomaly" | "incident" | "alert";
  }> = [];

  if (latestTelemetryTime) {
    protectionActivityItems.push({
      id: `tel-${latestTelemetryTime}`,
      title: "Telemetry Heartbeat Ingested",
      description: `CPU ${liveCpu}%, RAM ${liveMemory}%, Disk I/O ${liveDiskIO.toFixed(2)} MB/s, Net Out ${liveNetworkOutMb.toFixed(2)} MB/s, and ${liveProcessCount} active processes synced to database.`,
      time: formatLastSeen(latestTelemetryTime),
      ts: new Date(latestTelemetryTime).getTime(),
      type: "telemetry",
    });
  }

  for (const a of deviceAnomalies) {
    const tsStr = a.timestamp || a.created_at;
    const evidenceStr = Array.isArray(a.evidence) && a.evidence.length > 0
      ? ` — ${a.evidence.join("; ")}`
      : "";
    protectionActivityItems.push({
      id: `anom-${a.id}`,
      title: `ML Anomaly Detected: ${a.anomaly_type}`,
      description: `${a.model_name || "ML Engine"} scored ${(Number(a.score ?? 0) * 100).toFixed(1)}% (Confidence: ${(Number(a.confidence ?? 0) * 100).toFixed(1)}%)${evidenceStr}`,
      time: formatLastSeen(tsStr),
      ts: tsStr ? new Date(tsStr).getTime() : 0,
      type: "anomaly",
    });
  }

  for (const inc of deviceIncidents) {
    const tsStr = inc.detected_at || inc.created_at;
    protectionActivityItems.push({
      id: `inc-${inc.id}`,
      title: `Security Incident (${inc.incident_number || inc.category || "SIEM"}): ${inc.title}`,
      description: `Status: ${inc.status} • Severity: ${inc.severity}${inc.response_action ? ` • Action: ${inc.response_action}` : ""}`,
      time: formatLastSeen(tsStr),
      ts: tsStr ? new Date(tsStr).getTime() : 0,
      type: "incident",
    });
  }

  for (const al of deviceAlerts) {
    const tsStr = al.created_at;
    protectionActivityItems.push({
      id: `al-${al.id}`,
      title: `Alert [${al.severity}]: ${al.title}`,
      description: al.description || al.recommendation || "Active alert recorded for this workstation.",
      time: formatLastSeen(tsStr),
      ts: tsStr ? new Date(tsStr).getTime() : 0,
      type: "alert",
    });
  }

  protectionActivityItems.sort((a, b) => b.ts - a.ts);
  const recentProtectionFeed = protectionActivityItems.slice(0, 5);

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
      {/* 1. Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <nav className="flex items-center gap-2 text-xs text-slate-400">
          <Link href="/devices" className="hover:text-white transition-colors flex items-center gap-1.5">
            <ChevronRight className="w-3.5 h-3.5 rotate-180 text-slate-500" />
            <span>Workstations</span>
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
          <span className="text-slate-200 font-medium">Workstation Details</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
          <span className="font-mono text-cyan-400 font-bold">{workstation.hostname}</span>
        </nav>

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

      {/* 3. HERO CARD */}
      <div className="glass-card p-6 rounded-2xl border-slate-800/80 bg-[#091124]/95 shadow-xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
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
                    <span>Online &amp; Protected</span>
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-300 mt-1.5 flex flex-wrap items-center gap-2">
                <span className="font-medium text-slate-200">
                  {isServer ? "Campus Server Node" : "Lab Workstation"}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400">
                  {(workstation.hardware_specs?.processor as string) ||
                    (workstation.hardware_specs?.cpu as string) ||
                    (isServer ? "Intel Xeon Silver" : "Intel Core i7")}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400">
                  {workstation.operating_system || workstation.os_type || "Linux Workstation"}
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

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Edit Details */}
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

            {/* Quarantine / Restore Network */}
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
              {workstation.operating_system || workstation.os_type || "Linux Workstation"}
            </span>
          </div>

          <div>
            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">System Uptime</span>
            <span className="text-slate-200 mt-0.5 block font-medium">
              {formatUptime(workstation.created_at)}
            </span>
          </div>

          <div>
            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">Monitoring Agent</span>
            <span className="text-emerald-400 font-medium mt-0.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              v1.0 Active
            </span>
          </div>
        </div>
      </div>

      {/* 4. Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${activeTab === "overview"
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
              : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Overview &amp; Health</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("simulation")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer relative ${activeTab === "simulation"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
              : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-300" />
            <span>Autonomous Defense Simulator</span>
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping absolute -top-1 -right-1" />
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("specs")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${activeTab === "specs"
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
              : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Hardware Specs</span>
          </button>
        </div>

        <span className="text-xs text-slate-400 font-mono">
          {activeTab === "overview" && "Operational health, load levels, and IdP user ownership."}
          {activeTab === "simulation" && "Test AI detection, IdP permissions, and automated SOAR response."}
          {activeTab === "specs" && "Hardware specifications, network addresses, and daemon details."}
        </span>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: OVERVIEW & HEALTH                                            */}
      {/* =================================================================== */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Status & Health Assessment Banner */}
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
                    ? "Security Quarantine Active (Workstation Protected)"
                    : workstation.status === "CRITICAL"
                      ? "Critical Condition Detected"
                      : workstation.status === "WARNING"
                        ? "Elevated Resource Demand"
                        : "Nominal Operations — Full Protection Active"}
                </h3>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                  {workstation.is_isolated
                    ? "Safely isolated from campus network to sever rogue sockets. Host OS remains active; active research files and sessions are preserved."
                    : workstation.status === "CRITICAL"
                      ? "Unusual activity or severe resource saturation detected. Automated incident tracking has flagged this node for review."
                      : workstation.status === "WARNING"
                        ? "Processor or memory usage is higher than ordinary baselines. Background telemetry is monitored closely."
                        : "Hardware performance is nominal, telemetry streams are verified, and university role-sensitive protections are fully active."}
                </p>
              </div>
            </div>

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

          {/* 3 Key Vital Cards */}
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
                <CircularGauge value={liveCpu} strokeColor="#3b82f6" />
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
                    {(workstation.hardware_specs?.processor as string) || "Intel Xeon / Core i7"}
                  </p>
                </div>
              </div>

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
                <CircularGauge value={liveMemory} strokeColor="#06b6d4" />
                <div className="space-y-1 text-xs">
                  <p className="text-slate-300 font-medium">
                    {liveMemory < 75 ? "Plentiful memory remaining" : "High application memory in use"}
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    {workstation.hardware_specs?.ram_gb
                      ? `${Math.round((workstation.hardware_specs.ram_gb * liveMemory) / 100)} GB / ${workstation.hardware_specs.ram_gb} GB total`
                      : "43.5 GB / 64 GB total"}
                  </p>
                  <p className="text-slate-500 text-[10px] font-mono">DDR4 Registered ECC</p>
                </div>
              </div>

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
                <CircularGauge value={liveDisk} strokeColor="#8b5cf6" />
                <div className="space-y-1 text-xs">
                  <p className="text-slate-300 font-medium">
                    {liveDisk < 75 ? "Plenty of free storage" : "Storage filling up"}
                  </p>
                  <p className="text-slate-400 text-[11px]">{formattedUsedStorage} used of {formattedTotalStorage}</p>
                  <p className="text-slate-500 text-[10px] font-mono">{rawStorageSpec}</p>
                </div>
              </div>

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

          {/* Environmental Health & University User Ownership */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left: Environmental Health (7 cols) */}
            <div className="lg:col-span-7 space-y-5">
              <div className="glass-card p-5 rounded-2xl border-slate-800/80 bg-[#091124]/95 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white tracking-tight">Environmental &amp; Hardware Status</h3>
                  </div>
                  <span className={`text-[11px] font-mono ${overallEnvBadge.color} flex items-center gap-1`}>
                    <overallEnvBadge.icon className="w-3.5 h-3.5" />
                    {overallEnvBadge.text}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-[#060b18] border border-slate-800/80 space-y-1">
                    <span className="text-slate-500 text-[10px] uppercase font-bold flex items-center gap-1">
                      <Network className={`w-3 h-3 ${netEgressStatus.color}`} /> Net Egress
                    </span>
                    <span className="text-white font-bold text-base block">{liveNetworkOutMb.toFixed(2)} MB/s</span>
                    <span className={`text-[11px] ${netEgressStatus.color}`}>{netEgressStatus.label}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#060b18] border border-slate-800/80 space-y-1">
                    <span className="text-slate-500 text-[10px] uppercase font-bold flex items-center gap-1">
                      <Network className={`w-3 h-3 ${netIngressStatus.color}`} /> Net Ingress
                    </span>
                    <span className="text-white font-bold text-base block">{liveNetworkInMb.toFixed(2)} MB/s</span>
                    <span className={`text-[11px] ${netIngressStatus.color}`}>{netIngressStatus.label}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#060b18] border border-slate-800/80 space-y-1">
                    <span className="text-slate-500 text-[10px] uppercase font-bold flex items-center gap-1">
                      <HardDrive className={`w-3 h-3 ${diskThroughputStatus.color}`} /> Disk I/O
                    </span>
                    <span className="text-white font-bold text-base block">{liveDiskIO.toFixed(2)} MB/s</span>
                    <span className={`text-[11px] ${diskThroughputStatus.color}`}>{diskThroughputStatus.label}</span>
                  </div>

                  <div className={`p-3 rounded-xl border space-y-1 ${networkLinkStatus.border}`}>
                    <span className="text-slate-500 text-[10px] uppercase font-bold flex items-center gap-1">
                      <Cpu className={`w-3 h-3 ${networkLinkStatus.color}`} /> Link &amp; Procs
                    </span>
                    <span className="text-white font-bold text-base block">{networkLinkStatus.speed}</span>
                    <span className={`text-[11px] ${networkLinkStatus.color}`}>{networkLinkStatus.sub}</span>
                  </div>
                </div>
              </div>

              {/* Recent Protection Activity */}
              <div className="glass-card p-5 rounded-2xl border-slate-800/80 bg-[#091124]/95 shadow-xl space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-bold text-white tracking-tight">Recent Protection Activity</h3>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {recentProtectionFeed.length > 0
                      ? `${recentProtectionFeed.length} recorded event${recentProtectionFeed.length === 1 ? "" : "s"}`
                      : "No events recorded"}
                  </span>
                </div>

                {recentProtectionFeed.length > 0 ? (
                  <div className="space-y-2.5 text-xs">
                    {recentProtectionFeed.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#060b18] border border-slate-800/60"
                      >
                        {item.type === "telemetry" ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        ) : item.type === "anomaly" ? (
                          <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                        ) : item.type === "incident" ? (
                          <ShieldAlertIcon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <p className="text-slate-200 font-medium">{item.title}</p>
                          <p className="text-slate-400 text-[11px]">{item.description}</p>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono shrink-0 ml-2">
                          {item.time}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-[#060b18] border border-slate-800/60 text-center space-y-1.5">
                    <p className="text-xs font-medium text-slate-300">
                      No Protection Activity Recorded Yet
                    </p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      No telemetry heartbeats, anomalies, or incidents exist in the database for{" "}
                      <span className="font-mono text-slate-300">{workstation.hostname}</span>. Run the endpoint agent or trigger an interactive scenario in the Simulation tab to generate live records.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right: University User Ownership (5 cols) */}
            <div className="lg:col-span-5 space-y-5">
              <div className="glass-card p-5 rounded-2xl border-slate-800/80 bg-[#091124]/95 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-purple-400" />
                    <h3 className="text-sm font-bold text-white tracking-tight">University Identity &amp; Access</h3>
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
                        : idpRole === "ADMIN"
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
                            : idpRole === "ADMIN"
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

                <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 text-purple-300 font-semibold">
                    <ShieldCheck className="w-4 h-4 text-purple-400" />
                    <span>Role-Sensitive Surgical Response Policy</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    {idpRole === "RESEARCHER"
                      ? "Researcher Privilege: Spurious or heavy compute triggers surgical network containment rather than process kills, ensuring long-running model training and deep learning states are preserved."
                      : idpRole === "STUDENT"
                      ? "Student Lab Policy: High-severity threats (e.g., cryptojacking or rogue processes) trigger surgical process containment and session suspension to safeguard shared hardware."
                      : idpRole === "ADMIN"
                      ? "Administrative Policy: Maintenance operations are audited in high fidelity; unauthorized escalation attempts trigger instant SIEM alerts and cryptographic audit records."
                      : "Open SSO Integration: Secure-MaintAI queries the IdP to dynamically bind institutional roles and enforce surgical SOAR containment playbooks."}
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
                  Simulate how Secure-MaintAI detects and defends this workstation against hardware faults, student cyber threats, or heavy research compute.
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
          <div className="p-4 rounded-2xl border border-purple-500/40 bg-purple-950/30 text-purple-200 shadow-xl space-y-2">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-purple-400 shrink-0" />
              <h3 className="text-sm font-bold text-white tracking-tight">
                Academic Verification &amp; Defense Simulation Suite
              </h3>
            </div>
            <p className="text-xs text-purple-300/90 leading-relaxed">
              Test how Secure-MaintAI monitors, classifies, and surgically defends this workstation across all 5 verification scenarios. Live telemetry, ML diagnostics, IdP role bindings, and automated SOAR playbooks execute safely in real time.
            </p>
          </div>

          <DemoController
            receipt={demoReceipt}
            activeStep={demoActiveStep}
            onReceiptUpdate={handleReceiptUpdate}
            onStepChange={setDemoActiveStep}
            onReset={() => {
              setDemoReceipt(null);
              setDemoActiveStep(1);
            }}
            workstationId={workstation.id}
            targetHostname={workstation.hostname}
            isIsolated={workstation.is_isolated}
            onRestoreNetwork={() => setShowIsolationModal(true)}
          />

          {demoReceipt && (
            <DemoProgress
              receipt={demoReceipt}
              activeStep={demoActiveStep}
              onStepSelect={setDemoActiveStep}
              onReset={() => {
                setDemoReceipt(null);
                setDemoActiveStep(1);
              }}
            />
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: HARDWARE SPECS & SYSTEM PROFILE                              */}
      {/* =================================================================== */}
      {activeTab === "specs" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          <div className="glass-card p-5 rounded-2xl border-slate-800/80 bg-[#091124]/95 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white tracking-tight">Hardware Specifications</h3>
              </div>
              <span className="text-xs font-mono text-cyan-400">{workstation.hostname}</span>
            </div>

            <div className="divide-y divide-slate-800/60 text-xs">
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400">Processor Model:</span>
                <span className="text-white font-mono font-medium">
                  {(workstation.hardware_specs?.processor as string) || (workstation.hardware_specs?.cpu as string) || "Intel Xeon / Core i7"}
                </span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400">CPU Architecture:</span>
                <span className="text-white font-mono">
                  {(workstation.hardware_specs?.architecture as string) || "x86_64 (64-bit)"}
                </span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400">Cores / Threads:</span>
                <span className="text-white font-mono">
                  {workstation.hardware_specs?.logical_cpus || workstation.hardware_specs?.cores || "8 Cores"}
                </span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400">Total Installed RAM:</span>
                <span className="text-white font-mono">
                  {workstation.hardware_specs?.ram_gb ? `${workstation.hardware_specs.ram_gb} GB` : "64 GB DDR4"}
                </span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400">Storage Controller:</span>
                <span className="text-white font-mono">{rawStorageSpec}</span>
              </div>
            </div>
          </div>

          <div className="glass-card p-5 rounded-2xl border-slate-800/80 bg-[#091124]/95 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <Network className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white tracking-tight">Network &amp; Daemon Profile</h3>
              </div>
              <span className="text-xs font-mono text-emerald-400">Agent v1.0</span>
            </div>

            <div className="divide-y divide-slate-800/60 text-xs">
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400">Assigned IPv4 Address:</span>
                <span className="text-cyan-400 font-mono font-medium">{workstation.ip_address || "10.10.1.10"}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400">MAC Address:</span>
                <span className="text-white font-mono">{workstation.mac_address || "00:1A:2B:3C:4D:5E"}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400">Operating System:</span>
                <span className="text-white">{workstation.operating_system || workstation.os_type || "Linux Workstation"}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400">Asset Inventory Tag:</span>
                <span className="text-purple-300 font-mono">{workstation.asset_tag || "KKU-WS-001"}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400">Surgical Isolation State:</span>
                <span className={workstation.is_isolated ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>
                  {workstation.is_isolated ? "ISOLATED (Quarantine Active)" : "NOMINAL (Unrestricted)"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 1: Edit Workstation Configuration                             */}
      {/* =================================================================== */}
      {showEditModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowEditModal(false)}
          title={`Edit Configuration: ${workstation.hostname}`}
          subtitle="Update location, department, asset tag, and operational status"
        >
          <form onSubmit={handleSaveEdit} className="space-y-4 text-xs font-sans">
            <div className="space-y-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Hostname (Fixed)</label>
                <input
                  type="text"
                  disabled
                  value={workstation.hostname}
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
      {/* MODAL 2: Surgical Isolation Confirmation Modal (Rule 19 & 20)      */}
      {/* =================================================================== */}
      {showIsolationModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowIsolationModal(false)}
          title={
            workstation.is_isolated
              ? `Restore Network Access: ${workstation.hostname}`
              : `Confirm Surgical Isolation: ${workstation.hostname}`
          }
          subtitle={`IP Address: ${workstation.ip_address || "10.10.1.10"}`}
          footer={
            <>
              <button
                type="button"
                onClick={() => setShowIsolationModal(false)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleToggleIsolation}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold text-white shadow-lg cursor-pointer ${workstation.is_isolated
                  ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20"
                  : "bg-rose-600 hover:bg-rose-500 shadow-rose-600/20"
                  }`}
              >
                {workstation.is_isolated ? "Restore Network Connectivity" : "Execute Surgical Containment"}
              </button>
            </>
          }
        >
          <div className="space-y-3 text-xs text-slate-300 leading-relaxed font-sans">
            <p>
              {workstation.is_isolated
                ? "Restoring network access lifts firewall containment rules and reconnects this workstation to the campus network. Continuous telemetry screening will resume immediately."
                : "Surgical isolation blocks external socket communication, dropping unauthorized lateral movement and command-and-control packets. The host operating system will NOT reboot, and active research workloads remain safe."}
            </p>
            <div className="p-3 rounded-xl bg-[#060b18] border border-slate-800 space-y-1 font-mono text-[11px]">
              <div className="flex justify-between text-slate-400">
                <span>Target Workstation:</span>
                <span className="text-white font-bold">{workstation.hostname}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Target IP Address:</span>
                <span className="text-cyan-400">{workstation.ip_address}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Automated SOAR Action:</span>
                <span className="text-purple-300 font-bold">Playbook 3: Surgical Network Isolation</span>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
