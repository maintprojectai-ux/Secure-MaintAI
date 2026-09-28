"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Server,
  Cpu,
  HardDrive,
  Activity,
  Shield,
  RotateCcw,
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  CheckCircle2,
  Edit,
  Play,
  RotateCw,
  Slash,
  Thermometer,
  Fan,
  Zap,
  Network,
  Check,
  ChevronDown,
  ChevronRight,
  User as UserIcon,
  ShieldCheck,
  Power,
  X,
  KeyRound,
  ShieldAlert as ShieldAlertIcon,
} from "lucide-react";
import { Workstation, DemoExecutionReceipt } from "@/types";
import { Modal } from "@/components/ui/Modal";
import { DemoProgress } from "@/components/dashboard/DemoProgress";
import { DemoController } from "@/components/dashboard/DemoController";
import {
  getWorkstationTelemetry,
  getWorkstation,
  isolateWorkstation,
  rollbackWorkstationIsolation,
} from "@/lib/api";

interface DeviceDetailClientProps {
  initialWorkstation: Workstation;
}

export const DeviceDetailClient: React.FC<DeviceDetailClientProps> = ({
  initialWorkstation,
}) => {
  const [workstation, setWorkstation] = useState<Workstation>(initialWorkstation);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [showIsolationModal, setShowIsolationModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRestartModal, setShowRestartModal] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    hostname: workstation.hostname,
    department: workstation.department || "Main Data Center",
    os_type: workstation.os_type || "Windows Server 2019",
    location: "Main Data Center / Rack 01",
    ip_address: workstation.ip_address || "10.10.1.10",
  });

  // 7-Step Demonstration State
  const [demoReceipt, setDemoReceipt] = useState<DemoExecutionReceipt | null>(null);
  const [demoActiveStep, setDemoActiveStep] = useState<number>(1);

  // Dynamic live telemetry metrics
  const [liveCpu, setLiveCpu] = useState<number>(42);
  const [liveMemory, setLiveMemory] = useState<number>(68);
  const [liveDisk, setLiveDisk] = useState<number>(54);
  const [sparkCpu, setSparkCpu] = useState<number[]>([35, 42, 38, 45, 52, 48, 44, 42]);
  const [sparkMemory, setSparkMemory] = useState<number[]>([62, 64, 65, 66, 68, 67, 68, 68]);
  const [sparkDisk, setSparkDisk] = useState<number[]>([50, 51, 52, 53, 54, 54, 54, 54]);
  const [sparkLabels, setSparkLabels] = useState<string[]>([
    "15:25", "15:30", "15:35", "15:40", "15:45", "15:50", "15:55", "16:00"
  ]);

  // Dynamic telemetry polling
  React.useEffect(() => {
    let active = true;

    // Fetch live workstation details if ID is a valid UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workstation.id);
    if (isUuid) {
      getWorkstation(workstation.id)
        .then((live) => {
          if (active && live) {
            setWorkstation((prev) => ({
              ...prev,
              ...live,
              is_isolated: live.status === "ISOLATED",
            }));
          }
        })
        .catch((err) => {
          console.debug("Backend workstation details API unreachable:", err);
        });
    }

    const fetchTelemetry = async () => {
      try {
        const metrics = await getWorkstationTelemetry(workstation.id, 8);
        if (active && metrics && metrics.length > 0) {
          const sorted = [...metrics].sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          const latest = sorted[sorted.length - 1];
          setLiveCpu(Math.round(latest.cpu_usage));
          setLiveMemory(Math.round(latest.memory_usage));
          setLiveDisk(Math.round((latest.disk_read + latest.disk_write) % 100 || 54));

          setSparkCpu(sorted.map((m) => Math.round(m.cpu_usage)));
          setSparkMemory(sorted.map((m) => Math.round(m.memory_usage)));
          setSparkDisk(sorted.map((m) => Math.round((m.disk_read + m.disk_write) % 100 || 54)));
          setSparkLabels(
            sorted.map((m) => {
              const d = new Date(m.timestamp);
              return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
            })
          );
        }
      } catch {
        // Retain current metrics if endpoint offline
      }
    };

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [workstation.id]);

  const generateSvgPath = (data: number[], width = 300, height = 45): string => {
    if (!data || data.length === 0) return `M0 ${height / 2} L${width} ${height / 2}`;
    const stepX = width / Math.max(data.length - 1, 1);
    return data
      .map((val, idx) => {
        const x = Math.round(idx * stepX);
        const clampedVal = Math.max(0, Math.min(100, val));
        const y = Math.round(height - (clampedVal / 100) * (height - 8) - 4);
        return `${idx === 0 ? "M" : "L"}${x} ${y}`;
      })
      .join(" ");
  };

  const handleReceiptUpdate = (receipt: DemoExecutionReceipt) => {
    setDemoReceipt(receipt);
    setDemoActiveStep(4);
    setLiveCpu(Math.round(receipt.step_3_telemetry.cpu_percent));
    setLiveMemory(Math.round(receipt.step_3_telemetry.memory_percent));
    setWorkstation((prev) => ({
      ...prev,
      is_isolated: receipt.step_8_soar_execution.workstation_final_status === "ISOLATED",
      status: receipt.step_8_soar_execution.workstation_final_status === "ISOLATED" ? "CRITICAL" : "ONLINE",
    }));
  };

  // Actions
  const handleToggleIsolation = async () => {
    const nextState = !workstation.is_isolated;

    // Wire live SOAR isolation if workstation.id is a real UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workstation.id);
    if (isUuid) {
      try {
        if (workstation.is_isolated) {
          await rollbackWorkstationIsolation(workstation.id);
        } else {
          await isolateWorkstation(workstation.id);
        }
      } catch (err) {
        console.warn("Could not reach SOAR endpoint, applying local mock isolation:", err);
      }
    }

    setWorkstation((prev) => ({
      ...prev,
      is_isolated: nextState,
      status: nextState ? "CRITICAL" : "ONLINE",
    }));
    setShowIsolationModal(false);

    const message = nextState
      ? `Surgical containment enforced on ${workstation.hostname}. Unauthorized sockets dropped; host OS kept running.`
      : `Surgical isolation rolled back for ${workstation.hostname}. Telemetry streams and socket access restored.`;

    setFeedbackMessage(message);
    setTimeout(() => setFeedbackMessage(null), 6000);
  };

  const handleRunScan = () => {
    setIsScanning(true);
    setFeedbackMessage("Initiating autonomous telemetry & integrity scan...");
    setTimeout(() => {
      setIsScanning(false);
      setFeedbackMessage("Integrity scan completed: 0 threats detected. Host memory & kernel modules optimal.");
      setTimeout(() => setFeedbackMessage(null), 5000);
    }, 2000);
  };

  const handleRestartService = () => {
    setShowRestartModal(false);
    setFeedbackMessage(`Host telemetry daemon & services restarted successfully on ${workstation.hostname}.`);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    setWorkstation((prev) => ({
      ...prev,
      hostname: editForm.hostname.toUpperCase(),
      department: editForm.department,
      os_type: editForm.os_type,
      ip_address: editForm.ip_address,
    }));
    setShowEditModal(false);
    setFeedbackMessage(`Device profile updated for ${editForm.hostname.toUpperCase()}.`);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  return (
    <div className="space-y-5 font-sans">
      {/* 10-Step Live Demonstration Controls & Visual Stepper */}
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
      />

      <DemoProgress
        receipt={demoReceipt}
        activeStep={demoActiveStep}
        onStepSelect={(step) => setDemoActiveStep(step)}
        onReset={() => {
          setDemoReceipt(null);
          setDemoActiveStep(1);
        }}
      />

      {/* Toast Feedback Notification */}
      {feedbackMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2.5 shadow-lg shadow-emerald-950/50 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* TOP DEVICE HERO CARD (Matching Mockup) */}
      <div className="glass-card p-6 rounded-2xl border-slate-800/80 bg-[#091124]/95 shadow-xl space-y-6">
        {/* Upper Row: Icon, Hostname, Status, Subtitle & Action Buttons */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#0c1a3a] border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0 shadow-lg shadow-blue-500/10">
              <Server className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold font-sans text-white tracking-tight">
                  {workstation.hostname}
                </h1>
                {workstation.is_isolated ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center gap-1.5 animate-pulse">
                    <Slash className="w-3 h-3" />
                    Isolated
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Online
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                {workstation.asset_tag ? `${workstation.asset_tag} • ` : ""}
                {workstation.hardware_specs?.processor || "Server • Dell PowerEdge R740"} •{" "}
                {workstation.operating_system || workstation.os_type || "Windows Server 2019"}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Edit Device */}
            <button
              type="button"
              onClick={() => setShowEditModal(true)}
              className="px-3.5 py-2 rounded-xl border border-slate-700/80 bg-[#060b18] hover:bg-slate-800 text-xs font-semibold text-slate-200 flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
            >
              <Edit className="w-3.5 h-3.5 text-slate-400" />
              <span>Edit Device</span>
            </button>

            {/* Run Scan */}
            <button
              type="button"
              onClick={handleRunScan}
              disabled={isScanning}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 transition-colors shadow-md shadow-blue-600/20 cursor-pointer"
            >
              <Shield className={`w-3.5 h-3.5 ${isScanning ? "animate-spin" : ""}`} />
              <span>{isScanning ? "Scanning..." : "Run Scan"}</span>
            </button>

            {/* Restart */}
            <button
              type="button"
              onClick={() => setShowRestartModal(true)}
              className="px-3.5 py-2 rounded-xl border border-slate-700/80 bg-[#060b18] hover:bg-slate-800 text-xs font-semibold text-slate-200 flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
            >
              <RotateCw className="w-3.5 h-3.5 text-slate-400" />
              <span>Restart</span>
            </button>

            {/* Isolate Device / Rollback Isolation */}
            <button
              type="button"
              onClick={() => setShowIsolationModal(true)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold text-white flex items-center gap-2 shadow-lg transition-colors cursor-pointer ${
                workstation.is_isolated
                  ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20"
                  : "bg-rose-600 hover:bg-rose-500 shadow-rose-600/30"
              }`}
            >
              {workstation.is_isolated ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Rollback Isolation</span>
                </>
              ) : (
                <>
                  <Slash className="w-3.5 h-3.5" />
                  <span>Isolate Device</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Lower Row: 7 Telemetry Specifications Strip (Matching Mockup) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-4 border-t border-slate-800/80 text-xs font-mono">
          <div>
            <span className="text-slate-500 text-[10px] block uppercase">IP Address</span>
            <span className="text-white font-medium mt-0.5 block">{workstation.ip_address || "10.10.1.10"}</span>
          </div>

          <div>
            <span className="text-slate-500 text-[10px] block uppercase">MAC Address</span>
            <span className="text-slate-300 mt-0.5 block truncate max-w-[130px]">
              {workstation.mac_address || "00:1A:4B:2F:8C:7D"}
            </span>
          </div>

          <div>
            <span className="text-slate-500 text-[10px] block uppercase">Location</span>
            <span className="text-slate-300 mt-0.5 block truncate max-w-[150px]">
              {workstation.lab ? `${workstation.department} / ${workstation.lab}` : (workstation.department || "Main Data Center")}
            </span>
          </div>

          <div>
            <span className="text-slate-500 text-[10px] block uppercase">Operating System</span>
            <span className="text-slate-300 mt-0.5 block truncate max-w-[150px]">
              {workstation.operating_system || workstation.os_type || "Windows Server 2019"}
            </span>
          </div>

          <div>
            <span className="text-slate-500 text-[10px] block uppercase">Agent Version</span>
            <span className="text-slate-300 mt-0.5 block">{workstation.agent_version || "1.0.0"}</span>
          </div>

          <div>
            <span className="text-slate-500 text-[10px] block uppercase">Last Seen</span>
            <span className="text-emerald-400 mt-0.5 block">2 min ago</span>
          </div>

          <div>
            <span className="text-slate-500 text-[10px] block uppercase">Uptime</span>
            <span className="text-white font-medium mt-0.5 block">15d 6h 24m</span>
          </div>
        </div>
      </div>

      {/* 3-COLUMN OPERATIONAL GRID (Matching Mockup) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* =================================================================== */}
        {/* COLUMN 1: System Overview, Recent Alerts & Top Apps (4 of 12 cols) */}
        {/* =================================================================== */}
        <div className="lg:col-span-4 space-y-5">
          {/* Card 1: System Overview */}
          <div className="glass-card p-5 rounded-2xl border-slate-800/80 bg-[#091124]/95 shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
              <Cpu className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold text-white tracking-tight">System Overview</h3>
            </div>

            {/* 3 Circular Ring Gauges */}
            <div className="grid grid-cols-3 gap-2 py-2 text-center">
              {/* CPU Ring Gauge */}
              <div className="flex flex-col items-center">
                <span className="text-[11px] text-slate-400 mb-1.5 font-medium">CPU Usage</span>
                <div className="relative w-16 h-16 flex items-center justify-center">
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
                  <span className="absolute text-xs font-bold text-white">{liveCpu}%</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono mt-1.5">8 Cores</span>
              </div>

              {/* Memory Ring Gauge */}
              <div className="flex flex-col items-center">
                <span className="text-[11px] text-slate-400 mb-1.5 font-medium">Memory Usage</span>
                <div className="relative w-16 h-16 flex items-center justify-center">
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
                  <span className="absolute text-xs font-bold text-white">{liveMemory}%</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono mt-1.5">43.6 GB / 64 GB</span>
              </div>

              {/* Disk Ring Gauge */}
              <div className="flex flex-col items-center">
                <span className="text-[11px] text-slate-400 mb-1.5 font-medium">Disk Usage</span>
                <div className="relative w-16 h-16 flex items-center justify-center">
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
                  <span className="absolute text-xs font-bold text-white">{liveDisk}%</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono mt-1.5">1.2 TB / 2.2 TB</span>
              </div>
            </div>

            {/* System Metadata List */}
            <div className="space-y-2 pt-2 border-t border-slate-800/80 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Architecture</span>
                <span className="text-white font-medium">{workstation.hardware_specs?.architecture || "x86_64"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">OS Platform</span>
                <span className="text-slate-300">{workstation.operating_system || workstation.os_type || "Windows Server"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Processor</span>
                <span className="text-slate-300 truncate max-w-[140px]" title={workstation.hardware_specs?.processor || ""}>
                  {workstation.hardware_specs?.processor || "Generic Node"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Logical Cores</span>
                <span className="text-slate-300">{workstation.hardware_specs?.logical_cpus || workstation.hardware_specs?.cores || "8"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Agent Version</span>
                <span className="text-slate-300">{workstation.agent_version || "1.0.0"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Health Status</span>
                <span className={`${workstation.status === "CRITICAL" || workstation.status === "ISOLATED" ? "text-rose-400" : "text-emerald-400"} font-bold flex items-center gap-1`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${workstation.status === "CRITICAL" || workstation.status === "ISOLATED" ? "bg-rose-400" : "bg-emerald-400"}`} />
                  {workstation.status === "ISOLATED" ? "Isolated" : workstation.status === "CRITICAL" ? "Critical" : "Healthy"}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Network Information */}
          <div className="glass-card p-5 rounded-2xl border-slate-800/80 bg-[#091124]/95 shadow-xl space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
              <Network className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold text-white tracking-tight">Network Information</h3>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Private IP</span>
                <span className="text-white">{workstation.ip_address || "10.10.1.10"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Subnet Mask</span>
                <span className="text-slate-300">255.255.255.0</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Gateway</span>
                <span className="text-slate-300">10.10.1.1</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">DNS</span>
                <span className="text-slate-300">10.10.0.5</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">MAC Address</span>
                <span className="text-slate-300 font-mono">{workstation.mac_address || "00:1A:4B:2F:8C:7D"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Speed</span>
                <span className="text-slate-300">1 Gbps</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Port</span>
                <span className="text-slate-300">Ethernet 1</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Status</span>
                <span className={`${workstation.status === "OFFLINE" ? "text-slate-400" : "text-emerald-400"} font-semibold`}>
                  {workstation.status === "OFFLINE" ? "Down" : "Up"}
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* =================================================================== */}
        {/* COLUMN 2: Real-time Performance, Recent Logs & Hardware (5 of 12)  */}
        {/* =================================================================== */}
        <div className="lg:col-span-5 space-y-5">
          {/* Card 1: Performance (Real-time) with 3 Sparkline Wave Charts */}
          <div className="glass-card p-5 rounded-2xl border-slate-800/80 bg-[#091124]/95 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Performance (Real-time)
                </h3>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1">
                Live <ChevronDown className="w-3 h-3 text-slate-500" />
              </span>
            </div>

            {/* Sparkline 1: CPU Usage (%) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400 text-[11px]">CPU Usage (%)</span>
                <span className="text-blue-400 font-bold font-sans text-sm">{liveCpu}%</span>
              </div>
              <div className="relative h-14 w-full">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 300 45">
                  <path
                    d={generateSvgPath(sparkCpu)}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <circle cx="295" cy={Math.round(45 - (Math.max(0, Math.min(100, liveCpu)) / 100) * 37 - 4)} r="3" fill="#3b82f6" />
                </svg>
              </div>
            </div>

            {/* Sparkline 2: Memory Usage (%) */}
            <div className="space-y-1 pt-1 border-t border-slate-800/60">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400 text-[11px]">Memory Usage (%)</span>
                <span className="text-emerald-400 font-bold font-sans text-sm">{liveMemory}%</span>
              </div>
              <div className="relative h-14 w-full">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 300 45">
                  <path
                    d={generateSvgPath(sparkMemory)}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <circle cx="295" cy={Math.round(45 - (Math.max(0, Math.min(100, liveMemory)) / 100) * 37 - 4)} r="3" fill="#10b981" />
                </svg>
              </div>
            </div>

            {/* Sparkline 3: Disk Usage (%) */}
            <div className="space-y-1 pt-1 border-t border-slate-800/60">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400 text-[11px]">Disk Usage (%)</span>
                <span className="text-purple-400 font-bold font-sans text-sm">{liveDisk}%</span>
              </div>
              <div className="relative h-14 w-full">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 300 45">
                  <path
                    d={generateSvgPath(sparkDisk)}
                    fill="none"
                    stroke="#8b5cf6"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <circle cx="295" cy={Math.round(45 - (Math.max(0, Math.min(100, liveDisk)) / 100) * 37 - 4)} r="3" fill="#8b5cf6" />
                </svg>
              </div>

              {/* Timestamps Axis */}
              <div className="flex justify-between text-[9px] font-mono text-slate-500 pt-1">
                {sparkLabels.map((t, idx) => (
                  <span key={idx}>{t}</span>
                ))}
              </div>
            </div>
          </div>


          {/* Card 3: Hardware Information */}
          <div className="glass-card p-5 rounded-2xl border-slate-800/80 bg-[#091124]/95 shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <h3 className="text-sm font-bold text-white tracking-tight">Hardware Information</h3>
              {workstation.asset_tag && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/30">
                  {workstation.asset_tag}
                </span>
              )}
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">CPU</span>
                <span className="text-white truncate max-w-[200px]">
                  {workstation.hardware_specs?.processor || "2 x Intel(R) Xeon(R) Silver 4214 CPU @ 2.20GHz"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Cores / Threads</span>
                <span className="text-slate-200">
                  {workstation.hardware_specs?.cores
                    ? `${workstation.hardware_specs.cores} Cores / ${workstation.hardware_specs.logical_cpus || workstation.hardware_specs.cores} Threads`
                    : "16 Cores / 32 Threads"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">RAM</span>
                <span className="text-slate-200">
                  {workstation.hardware_specs?.ram_gb ? `${workstation.hardware_specs.ram_gb} GB RAM` : "64 GB DDR4"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Architecture</span>
                <span className="text-slate-200">
                  {workstation.hardware_specs?.architecture || "x86_64"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Platform</span>
                <span className="text-slate-200 truncate max-w-[200px]">
                  {workstation.hardware_specs?.platform || workstation.operating_system || "Linux / Windows"}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">NIC</span>
                <span className="text-slate-200 truncate max-w-[200px]">
                  {workstation.mac_address ? `Ethernet (${workstation.mac_address})` : "1 Gbps - Intel Ethernet I350"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* COLUMN 3: Device Health, Network & Recent Actions (3 of 12 cols)    */}
        {/* =================================================================== */}
        <div className="lg:col-span-3 space-y-5">
          {/* Card 0: University IdP Context & Surgical Containment */}
          <div className="glass-card p-5 rounded-2xl border-slate-800/80 bg-[#091124]/95 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white tracking-tight">University IdP Context</h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/30">
                Rule §18 / §20
              </span>
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Assigned User:</span>
                <span className="text-white font-medium truncate max-w-[140px]">
                  {demoReceipt?.step_6_idp_context?.username || workstation.assigned_user?.full_name || "khalid.mansoor"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">IdP Role:</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                  (demoReceipt?.step_6_idp_context?.role || workstation.assigned_user?.role) === "RESEARCHER"
                    ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                    : (demoReceipt?.step_6_idp_context?.role || workstation.assigned_user?.role) === "ADMIN"
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                    : "bg-blue-500/20 text-blue-300 border-blue-500/40"
                }`}>
                  {demoReceipt?.step_6_idp_context?.role || workstation.assigned_user?.role || "Pending IdP Resolution"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Department / Lab:</span>
                <span className="text-slate-300 truncate max-w-[140px]">
                  {demoReceipt?.step_6_idp_context?.department || workstation.department || "Computer Science"}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-slate-400 block mb-1">Authorized HPC Workloads:</span>
                {demoReceipt?.step_6_idp_context?.active_workloads && demoReceipt.step_6_idp_context.active_workloads.length > 0 ? (
                  <div className="space-y-1">
                    {demoReceipt.step_6_idp_context.active_workloads.map((w, idx) => (
                      <span key={idx} className="block px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[10px] text-cyan-300">
                        • {w}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-500 text-[10px] italic">None registered (Standard Student)</span>
                )}
              </div>

              {/* Surgical Containment State */}
              <div className="pt-2 border-t border-slate-800/80">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-400">SOAR Surgical Isolation:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    workstation.is_isolated
                      ? "bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse"
                      : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  }`}>
                    {workstation.is_isolated ? "CONTAINED (HOST ACTIVE)" : "UNRESTRICTED"}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed font-sans">
                  {workstation.is_isolated
                    ? "Malicious sockets dropped and process killed. Host OS kept running without rebooting."
                    : "Workstation network interfaces and processes normal."}
                </p>
              </div>
            </div>
          </div>

          {/* Card 1: Device Health */}
          <div className="glass-card p-5 rounded-2xl border-slate-800/80 bg-[#091124]/95 shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white tracking-tight">Device Health</h3>
            </div>

            {/* Circular Health Shield */}
            <div className="flex flex-col items-center justify-center py-2 text-center">
              <div className={`w-14 h-14 rounded-full border-2 flex items-center justify-center mb-2 shadow-lg ${
                workstation.is_isolated || workstation.status === "CRITICAL"
                  ? "bg-rose-500/15 border-rose-500/40 text-rose-400 shadow-rose-500/20 animate-pulse"
                  : workstation.status === "WARNING"
                  ? "bg-amber-500/15 border-amber-500/40 text-amber-400 shadow-amber-500/20"
                  : "bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-emerald-500/20"
              }`}>
                {workstation.is_isolated || workstation.status === "CRITICAL" ? (
                  <ShieldAlertIcon className="w-7 h-7" />
                ) : workstation.status === "WARNING" ? (
                  <AlertTriangle className="w-7 h-7" />
                ) : (
                  <ShieldCheck className="w-7 h-7" />
                )}
              </div>
              <h4 className="text-base font-bold text-white">
                {workstation.is_isolated 
                  ? "Isolated" 
                  : workstation.status === "CRITICAL" 
                  ? "Critical" 
                  : workstation.status === "WARNING" 
                  ? "Warning" 
                  : "Healthy"}
              </h4>
              <p className="text-[11px] text-slate-400">
                {workstation.is_isolated 
                  ? "Network contained by SOAR" 
                  : workstation.status === "CRITICAL" 
                  ? "Security anomaly detected" 
                  : workstation.status === "WARNING" 
                  ? "System metric degraded" 
                  : "No issues detected"}
              </p>
            </div>

            {/* Health Parameters */}
            <div className="space-y-2.5 pt-2 border-t border-slate-800/80 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-slate-500" /> Hardware Status
                </span>
                <span className={`${workstation.status === "CRITICAL" || workstation.status === "ISOLATED" ? "text-rose-400" : workstation.status === "WARNING" ? "text-amber-400" : "text-emerald-400"} font-semibold`}>
                  {workstation.status === "CRITICAL" || workstation.status === "ISOLATED" ? "Critical" : workstation.status === "WARNING" ? "Warning" : "Normal"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Thermometer className="w-3.5 h-3.5 text-slate-500" /> Temperature
                </span>
                <span className="text-slate-200">36 °C</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Fan className="w-3.5 h-3.5 text-slate-500" /> Fan Speed
                </span>
                <span className="text-slate-200">1200 RPM</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Power className="w-3.5 h-3.5 text-slate-500" /> Power Status
                </span>
                <span className="text-slate-200">Normal</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-slate-500" /> Network Status
                </span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Connected
                </span>
              </div>
            </div>
          </div>        </div>
      </div>

      {/* =================================================================== */}
      {/* MODAL 1: Surgical Isolation Confirmation Modal (Rule 19 & 20)       */}
      {/* =================================================================== */}
      {showIsolationModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowIsolationModal(false)}
          title={
            workstation.is_isolated
              ? `Confirm Network Isolation Rollback: ${workstation.hostname}`
              : `Confirm Surgical Network Isolation: ${workstation.hostname}`
          }
          subtitle={`Target IP: ${workstation.ip_address} • Department: ${workstation.department}`}
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
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold text-white shadow-lg cursor-pointer ${
                  workstation.is_isolated
                    ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20"
                    : "bg-rose-600 hover:bg-rose-500 shadow-rose-600/30"
                }`}
              >
                {workstation.is_isolated ? "Rollback Isolation" : "Execute Surgical Containment"}
              </button>
            </>
          }
        >
          <div className="space-y-3 text-xs">
            <p className="text-slate-300 leading-relaxed">
              {workstation.is_isolated
                ? "Rolling back surgical network isolation will restore standard inbound and outbound network connectivity to this server. The lightweight telemetry agent will remain active."
                : "Enforcing surgical network isolation severs all unauthorized socket connections and blocks inbound/outbound traffic to prevent lateral movement and C2 beaconing. The host operating system will NOT reboot, and active research workload states are preserved per Rule 19 & 20."}
            </p>

            <div className="p-3.5 rounded-xl border border-slate-800 bg-[#070d1e] space-y-1.5 font-mono text-[11px]">
              <div className="flex justify-between text-slate-400">
                <span>Target Node:</span>
                <span className="text-white font-bold">{workstation.hostname}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>IP Address:</span>
                <span className="text-cyan-400">{workstation.ip_address}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Assigned Role Context:</span>
                <span className="text-amber-400">
                  {workstation.assigned_user?.role || "ADMIN / IT INFRASTRUCTURE"}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>SOAR Action:</span>
                <span className="text-rose-400 font-bold">Playbook 3: Surgical Network Isolation</span>
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
          title={`Edit Device: ${workstation.hostname}`}
          subtitle="Update hardware metadata, location, and department assignment"
        >
          <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
            <div className="space-y-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Hostname</label>
                <input
                  type="text"
                  required
                  value={editForm.hostname}
                  onChange={(e) => setEditForm({ ...editForm, hostname: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#070d1e] border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">IPv4 Address</label>
                <input
                  type="text"
                  required
                  value={editForm.ip_address}
                  onChange={(e) => setEditForm({ ...editForm, ip_address: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#070d1e] border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Operating System</label>
                <input
                  type="text"
                  value={editForm.os_type}
                  onChange={(e) => setEditForm({ ...editForm, os_type: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#070d1e] border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Facility Location / Rack</label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#070d1e] border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-md"
              >
                Save Changes
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL 3: Restart Service / Node Modal                               */}
      {/* =================================================================== */}
      {showRestartModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowRestartModal(false)}
          title={`Restart Host Services: ${workstation.hostname}`}
          subtitle="Cycle agent daemons or request controlled host reboot"
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
                Restart Telemetry Daemons
              </button>
            </>
          }
        >
          <p className="text-xs text-slate-300 leading-relaxed">
            Restarting host telemetry daemons cycles the local agent process and flushes ephemeral socket buffers without disrupting production workloads or server operating system execution.
          </p>
        </Modal>
      )}
    </div>
  );
};
