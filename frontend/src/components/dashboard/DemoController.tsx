"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Zap,
  ShieldAlert,
  Microscope,
  Lock,
  WifiOff,
  Activity,
  ChevronRight,
  ChevronLeft,
  Loader2,
  CheckCircle2,
  Sliders,
} from "lucide-react";
import { DemoScenarioType, DemoExecutionReceipt } from "@/types";
import { triggerDemoScenario } from "@/lib/api";

interface DemoControllerProps {
  receipt: DemoExecutionReceipt | null;
  activeStep: number;
  onReceiptUpdate: (receipt: DemoExecutionReceipt) => void;
  onStepChange: (step: number | ((prev: number) => number)) => void;
  onReset: () => void;
  workstationId?: string;
  targetHostname?: string;
  isIsolated?: boolean;
  onRestoreNetwork?: () => void;
}

interface ScenarioOption {
  type: DemoScenarioType;
  title: string;
  subtitle: string;
  badge: string;
  rolePersona: string;
  expectedOutcome: string;
  color: string;
  borderColor: string;
  icon: React.ElementType;
}

const SCENARIOS: ScenarioOption[] = [
  {
    type: "TECHNICAL_DEGRADATION",
    title: "Scenario 1: Hardware & Memory Fault",
    subtitle: "Simulates severe memory leak and disk I/O thrashing. AI diagnoses a technical fault ('mem') and dispatches an automated maintenance work order.",
    badge: "Hardware Fault",
    rolePersona: "IT Infrastructure",
    expectedOutcome: "Work Order Dispatched • Host Online",
    color: "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20",
    borderColor: "border-amber-500/40",
    icon: Zap,
  },
  {
    type: "CYBER_THREAT",
    title: "Scenario 2: Cryptojacking Cyber Threat",
    subtitle: "Simulates an unauthorized crypto-mining process with outbound Stratum traffic. SOAR response adapts to the University IdP role (Student: Full Host Isolation • Researcher: Selective Miner Kill, Workload Preserved).",
    badge: "Cyber Threat",
    rolePersona: "Role-Sensitive (Student / Researcher)",
    expectedOutcome: "Student: Isolated • Researcher: Job Preserved",
    color: "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20",
    borderColor: "border-rose-500/40",
    icon: ShieldAlert,
  },
  {
    type: "RESEARCHER_HPC_WORKLOAD",
    title: "Scenario 3: Researcher Heavy Computing Workload",
    subtitle: "Simulates intensive multi-threaded numerical simulations. University IdP verifies active research credentials, ensuring legitimate scientific jobs are preserved without interruption.",
    badge: "Legitimate Compute",
    rolePersona: "Faculty Researcher",
    expectedOutcome: "Workload Preserved • Zero Interruption",
    color: "bg-purple-500/10 text-purple-400 hover:bg-purple-500/20",
    borderColor: "border-purple-500/40",
    icon: Microscope,
  },
  {
    type: "PRIVILEGE_ESCALATION",
    title: "Scenario 4: Unauthorized Privilege Escalation",
    subtitle: "Simulates credential harvesting and unauthorized permission elevation. AI triggers emergency containment to prevent lateral movement across the campus network.",
    badge: "Privilege Threat",
    rolePersona: "Compromised Account",
    expectedOutcome: "Session Revoked • Lateral Movement Blocked",
    color: "bg-red-500/10 text-red-300 hover:bg-red-500/20",
    borderColor: "border-red-600/50",
    icon: Lock,
  },
  {
    type: "IDP_OUTAGE_FALLBACK",
    title: "Scenario 5: University IdP Outage Fallback",
    subtitle: "Simulates a campus directory network timeout. System seamlessly engages secure local identity cache and flags the incident for SOC administrator review.",
    badge: "Fail-Safe Fallback",
    rolePersona: "Directory Service",
    expectedOutcome: "Safe Local Cache • SOC Review Flagged",
    color: "bg-orange-500/10 text-orange-400 hover:bg-orange-500/20",
    borderColor: "border-orange-500/40",
    icon: WifiOff,
  },
  {
    type: "NORMAL_BASELINE",
    title: "Scenario 6: Normal Operational Baseline",
    subtitle: "Simulates standard everyday university lab usage. AI confirms normal operational variance; workstation health remains 100% green with zero false alerts.",
    badge: "Nominal Baseline",
    rolePersona: "General Lab User",
    expectedOutcome: "Healthy & Online • Zero False Alarms",
    color: "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20",
    borderColor: "border-emerald-500/40",
    icon: Activity,
  },
];

type SimulatedRoleOption = "AUTO" | "STUDENT" | "RESEARCHER";

export function DemoController({
  receipt,
  activeStep,
  onReceiptUpdate,
  onStepChange,
  onReset,
  workstationId,
  targetHostname,
  isIsolated,
  onRestoreNetwork,
}: DemoControllerProps) {
  const [selectedScenario, setSelectedScenario] = useState<DemoScenarioType>("TECHNICAL_DEGRADATION");
  const [simulatedRole, setSimulatedRole] = useState<SimulatedRoleOption>("AUTO");
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionMessage, setExecutionMessage] = useState<string | null>(null);

  const handleTriggerScenario = async (scenarioType: DemoScenarioType) => {
    setSelectedScenario(scenarioType);
    setIsExecuting(true);
    const roleOverride = simulatedRole === "AUTO" ? undefined : simulatedRole;
    setExecutionMessage(
      `Injecting telemetry & running autonomous defense pipeline for ${scenarioType.replace(/_/g, " ")}${roleOverride ? ` (IdP Role: ${roleOverride})` : ""}...`
    );

    try {
      const liveReceipt = await triggerDemoScenario(scenarioType, workstationId, roleOverride);
      onReceiptUpdate(liveReceipt);

      // Visually step through the pipeline (Steps 1 to 7) for demonstration effect
      for (let step = 1; step <= 7; step++) {
        onStepChange(step);
        await new Promise((resolve) => setTimeout(resolve, 800));
      }

      const confText = liveReceipt.step_5_ml_result?.confidence !== undefined && liveReceipt.step_5_ml_result.confidence !== null
        ? `${(liveReceipt.step_5_ml_result.confidence * 100).toFixed(1)}%`
        : "N/A";

      setExecutionMessage(
        `Pipeline Completed: ${liveReceipt.scenario_title} • AI Diagnosis: ${liveReceipt.step_5_ml_result?.anomaly_type || "Evaluated"} (${confText} conf) • IdP Role: ${liveReceipt.step_6_idp_context?.role || "N/A"} • SOAR Action: ${liveReceipt.step_8_soar_execution?.action_taken || "Completed"}`
      );
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      setExecutionMessage(`Execution Error: ${errorMsg}. (Check that backend is running)`);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-[#091124]/95 shadow-xl p-4 sm:p-5 mb-6 text-slate-100 backdrop-blur-md">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Interactive Scenario Simulator
            </h2>
            {targetHostname && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
                Target Device: {targetHostname}
              </span>
            )}
            {isIsolated && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" /> Security Quarantine Active
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Safely test incident detection and role-sensitive autonomous SOAR playbooks on this machine.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* University IdP Role Context Selector */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 px-2.5 py-1.5 rounded-xl text-[11px]">
            <span className="text-slate-400 font-medium">IdP Role Context:</span>
            {(["AUTO", "STUDENT", "RESEARCHER"] as SimulatedRoleOption[]).map((roleOpt) => (
              <button
                key={roleOpt}
                type="button"
                onClick={() => setSimulatedRole(roleOpt)}
                disabled={isExecuting}
                className={`px-2 py-0.5 rounded-md font-mono font-semibold text-[10px] transition cursor-pointer ${
                  simulatedRole === roleOpt
                    ? "bg-indigo-500/30 text-indigo-200 border border-indigo-400/50"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                {roleOpt === "AUTO" ? "Auto (Device)" : roleOpt}
              </button>
            ))}
          </div>

          {isIsolated && onRestoreNetwork && (
            <button
              type="button"
              onClick={onRestoreNetwork}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-colors flex items-center gap-1.5 cursor-pointer self-start md:self-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore Network Connectivity</span>
            </button>
          )}
        </div>
      </div>

      {/* Scenario Selection Grid (6 Academic Simulation Scenarios in Order) */}
      <div className="mt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Select a Scenario to Test Autonomous Response
            </h3>
            <p className="text-[11px] text-slate-400">
              Click any scenario below to inject authentic telemetry and verify the autonomous 7-step defense pipeline on {targetHostname || "this workstation"}.
            </p>
          </div>
          {receipt && onReset && (
            <button
              type="button"
              onClick={onReset}
              className="self-start sm:self-auto text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-lg hover:bg-slate-800 border border-slate-700/60 transition flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Results</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {SCENARIOS.map((sc) => {
            const Icon = sc.icon;
            const isSelected = selectedScenario === sc.type;
            return (
              <button
                key={sc.type}
                type="button"
                onClick={() => handleTriggerScenario(sc.type)}
                disabled={isExecuting}
                className={`p-3.5 rounded-xl border text-left transition-all duration-200 cursor-pointer relative group flex flex-col justify-between ${isSelected
                    ? `${sc.borderColor} bg-slate-800/90 shadow-xl ring-1 ring-cyan-500/30`
                    : "border-slate-800/80 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-800/50"
                  }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${sc.borderColor} ${sc.color}`}>
                        {sc.badge}
                      </span>
                      <span className="text-[10px] text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/50 font-medium">
                        {sc.rolePersona}
                      </span>
                    </div>
                    <Icon className="w-4 h-4 text-slate-400 group-hover:text-slate-200 transition-colors shrink-0" />
                  </div>

                  <div className="text-xs font-bold text-white tracking-tight group-hover:text-cyan-300 transition-colors">
                    {sc.title}
                  </div>
                  <div className="text-[11px] text-slate-300 mt-1.5 leading-relaxed">
                    {sc.subtitle}
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <span className="text-slate-500">Expected:</span>
                    <span className="font-medium text-slate-300 truncate max-w-[170px]">{sc.expectedOutcome}</span>
                  </div>
                  {isSelected && receipt ? (
                    <span className="text-cyan-400 font-bold flex items-center gap-1 shrink-0 text-[10px]">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Simulated
                    </span>
                  ) : (
                    <span className="text-indigo-400 group-hover:text-cyan-300 font-semibold flex items-center gap-1 shrink-0 text-[10px]">
                      Run Scenario ➔
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Execution Status / Pipeline Feedback */}
      {(isExecuting || executionMessage) && (
        <div className="mt-4 p-3 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center gap-2.5 text-xs font-mono">
          {isExecuting ? (
            <>
              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
              <span className="text-cyan-300">{executionMessage}</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-slate-300 break-words">{executionMessage}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
