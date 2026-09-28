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
}

interface ScenarioOption {
  type: DemoScenarioType;
  title: string;
  subtitle: string;
  badge: string;
  color: string;
  borderColor: string;
  icon: React.ElementType;
}

const SCENARIOS: ScenarioOption[] = [
  {
    type: "STUDENT_CYBER_THREAT",
    title: "Scenario 2: Student Cyber Threat Simulation",
    subtitle: "High anomaly score + student role → surgical containment of sockets & process kill",
    badge: "Cyber Threat",
    color: "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20",
    borderColor: "border-rose-500/40",
    icon: ShieldAlert,
  },
  {
    type: "TECHNICAL_DEGRADATION",
    title: "Scenario 1: Technical Degradation Simulation",
    subtitle: "Disk I/O + thermal fault → technical anomaly → maintenance ticket dispatched",
    badge: "Technical",
    color: "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20",
    borderColor: "border-amber-500/40",
    icon: Zap,
  },
  {
    type: "RESEARCHER_HPC_WORKLOAD",
    title: "Scenario 3: Researcher HPC Workload Simulation",
    subtitle: "High compute load + researcher role → preservation of scientific workload without isolation",
    badge: "HPC Workload",
    color: "bg-purple-500/10 text-purple-400 hover:bg-purple-500/20",
    borderColor: "border-purple-500/40",
    icon: Microscope,
  },
  {
    type: "PRIVILEGE_ESCALATION",
    title: "Scenario 4: Privilege Escalation Simulation",
    subtitle: "Simulated LSASS/security descriptor read → emergency role revocation & host isolation",
    badge: "Privilege Escalation",
    color: "bg-red-500/10 text-red-300 hover:bg-red-500/20",
    borderColor: "border-red-600/50",
    icon: Lock,
  },
  {
    type: "IDP_OUTAGE_FALLBACK",
    title: "Scenario 5: IdP Outage Fallback",
    subtitle: "Directory server timeout → safe fail-secure fallback with operator manual authorization required",
    badge: "Fail-Safe",
    color: "bg-orange-500/10 text-orange-400 hover:bg-orange-500/20",
    borderColor: "border-orange-500/40",
    icon: WifiOff,
  },
  {
    type: "NORMAL_BASELINE",
    title: "Baseline: Normal Telemetry Stream",
    subtitle: "Nominal university lab metrics → model scores normal → health status green",
    badge: "Nominal",
    color: "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20",
    borderColor: "border-emerald-500/40",
    icon: Activity,
  },
];

export function DemoController({
  receipt,
  activeStep,
  onReceiptUpdate,
  onStepChange,
  onReset,
  workstationId,
  targetHostname,
}: DemoControllerProps) {
  const [selectedScenario, setSelectedScenario] = useState<DemoScenarioType>("STUDENT_CYBER_THREAT");
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionMessage, setExecutionMessage] = useState<string | null>(null);

  const handleTriggerScenario = async (scenarioType: DemoScenarioType) => {
    setSelectedScenario(scenarioType);
    setIsExecuting(true);
    setExecutionMessage(`Dispatching authentic pipeline for ${scenarioType.replace(/_/g, " ")}...`);

    try {
      const liveReceipt = await triggerDemoScenario(scenarioType, workstationId);
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
        `Pipeline Executed: ${liveReceipt.scenario_title} • Model: ${liveReceipt.step_5_ml_result?.model_name || "Ensemble"} • Confidence: ${confText} • IdP Role: ${liveReceipt.step_6_idp_context?.role || "N/A"} • SOAR Action: ${liveReceipt.step_8_soar_execution?.action_taken || "Evaluated"}`
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
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Live Demonstration Controller
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
              Guide 6 / Scene 8
            </span>
            {targetHostname && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
                Target Device: {targetHostname}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Trigger academic simulation scenarios through the authentic ML ➔ IdP ➔ SOAR ➔ DB pipeline.
          </p>
        </div>

      </div>

      {/* Scenario Selection Grid (6 Academic Simulation Scenarios) */}
      <div className="mt-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Select Simulation Scenario (Dispatches Real Pipeline)
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {SCENARIOS.map((sc) => {
            const Icon = sc.icon;
            const isSelected = selectedScenario === sc.type;
            return (
              <button
                key={sc.type}
                type="button"
                onClick={() => handleTriggerScenario(sc.type)}
                disabled={isExecuting}
                className={`p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer relative group flex flex-col justify-between ${
                  isSelected
                    ? `${sc.borderColor} bg-slate-800/80 shadow-lg`
                    : "border-slate-800/80 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-800/50"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${sc.borderColor} ${sc.color}`}
                    >
                      {sc.badge}
                    </span>
                    <Icon className="w-4 h-4 text-slate-400 group-hover:text-slate-200 transition-colors" />
                  </div>
                  <div className="text-xs font-bold text-white tracking-tight">{sc.title}</div>
                  <div className="text-[11px] text-slate-400 mt-1 leading-snug line-clamp-2">
                    {sc.subtitle}
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
                  <span className="text-slate-500 font-mono">POST /api/v1/demo/trigger-scenario</span>
                  {isSelected && receipt ? (
                    <span className="text-cyan-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Active
                    </span>
                  ) : (
                    <span className="text-slate-400 group-hover:text-slate-200 font-medium">Trigger ➔</span>
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
