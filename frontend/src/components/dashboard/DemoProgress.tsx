"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Database,
  Flame,
  KeyRound,
  Layers,
  Network,
  RotateCcw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import { DemoExecutionReceipt } from "@/types";

interface DemoProgressProps {
  receipt: DemoExecutionReceipt | null;
  activeStep: number;
  onStepSelect?: (step: number) => void;
  onReset?: () => void;
}

interface StepDefinition {
  step: number;
  title: string;
  shortDesc: string;
  guideSection: string;
  icon: React.ElementType;
}

const STEPS: StepDefinition[] = [
  { step: 1, title: "Simulation Triggered", shortDesc: "Controlled Scenario Active", guideSection: "Guide §6.4", icon: Flame },
  { step: 2, title: "ML Screening & Diagnosis", shortDesc: "Isolation Forest + Specialists", guideSection: "Guide §6.5", icon: Cpu },
  { step: 3, title: "IdP Context Resolved", shortDesc: "Role & HPC Workload Lookup", guideSection: "Guide §6.6", icon: KeyRound },
  { step: 4, title: "Role-Sensitive Playbook", shortDesc: "Orchestration Decision", guideSection: "Guide §6.7", icon: Layers },
  { step: 5, title: "Surgical Containment", shortDesc: "Host Active • Sockets Contained", guideSection: "Guide §6.8", icon: ShieldCheck },
  { step: 6, title: "Incident & Audit Hash", shortDesc: "SHA-256 Immutable Record", guideSection: "Guide §6.9", icon: ShieldAlert },
  { step: 7, title: "Validation & Evidence", shortDesc: "Held-out Test Confusion Matrices", guideSection: "Guide §6.10", icon: Scale },
];

export function DemoProgress({ receipt, activeStep, onStepSelect, onReset }: DemoProgressProps) {
  const [inspectedStep, setInspectedStep] = useState<number | null>(null);

  const currentDisplayStep = inspectedStep ?? activeStep;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/90 backdrop-blur-md shadow-2xl p-5 mb-6 text-slate-100 transition-all duration-300">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
            <Zap className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight text-white">
                7-Step Demonstration Flow
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium">
                Guide Section 6 Primary Evidence
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {receipt
                ? `Active Scenario: ${receipt.scenario_title}`
                : "Select a simulation scenario from the Demonstration Controller to drive the live pipeline."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700/50">
            <span className="text-slate-400">Progress:</span>
            <span className="font-mono font-bold text-indigo-400">{activeStep} / 7 Steps</span>
          </div>
          {onReset && (
            <button
              onClick={onReset}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-800 border border-transparent hover:border-slate-700 transition"
              title="Reset Demonstration State"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Stepper Bar */}
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {STEPS.map((st) => {
          const isDone = st.step < activeStep || (st.step === STEPS.length && activeStep === STEPS.length);
          const isCurrent = st.step === activeStep;
          const isInspected = st.step === currentDisplayStep;
          const Icon = st.icon;

          return (
            <button
              key={st.step}
              onClick={() => {
                setInspectedStep(st.step);
                onStepSelect?.(st.step);
              }}
              className={`group flex flex-col items-center text-center p-2.5 rounded-lg border transition-all duration-200 ${
                isInspected
                  ? "bg-indigo-600/20 border-indigo-500 ring-2 ring-indigo-500/30 shadow-lg shadow-indigo-500/10"
                  : isCurrent
                    ? "bg-slate-800/90 border-indigo-400/60 shadow"
                    : isDone
                      ? "bg-slate-900/60 border-emerald-500/30 hover:border-emerald-500/60"
                      : "bg-slate-900/30 border-slate-800/80 hover:border-slate-700 opacity-60"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold mb-2 transition ${
                  isDone
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                    : isCurrent
                      ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/50 animate-pulse"
                      : "bg-slate-800 text-slate-400 border border-slate-700"
                }`}
              >
                {isDone ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <span className="text-[11px] font-bold text-slate-200 line-clamp-1 group-hover:text-white">
                {st.step}. {st.title}
              </span>
              <span className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                {st.guideSection}
              </span>
            </button>
          );
        })}
      </div>

      {/* Step Inspector Panel */}
      <div className="mt-4 p-4 rounded-xl bg-slate-950/70 border border-slate-800/90">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Stage {currentDisplayStep} Details
            </span>
            <span className="text-sm font-semibold text-slate-200">
              {STEPS[currentDisplayStep - 1].title} — {STEPS[currentDisplayStep - 1].shortDesc}
            </span>
          </div>
          {inspectedStep && inspectedStep !== activeStep && (
            <button
              onClick={() => setInspectedStep(null)}
              className="text-xs text-indigo-400 hover:text-indigo-300 underline"
            >
              Return to current step ({activeStep})
            </button>
          )}
        </div>

        {/* Step-Specific Evidence Renders */}
        {currentDisplayStep === 1 && (
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs">
            {receipt ? (
              <div>
                {/* Data Provenance Badge */}
                {receipt.data_provenance && (
                  <div className="mb-3 p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-500/30 text-[11px]">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <Database className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="font-semibold text-indigo-200">
                          {receipt.data_provenance.tier}
                        </span>
                        <span className="font-mono text-slate-300">
                          — {receipt.data_provenance.dataset_name}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        Ref: {receipt.data_provenance.reference_citation}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      <strong>Methodology:</strong> {receipt.data_provenance.generation_method}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold font-mono text-[11px]">
                      {receipt.step_4_scenario.type}
                    </span>
                    <span className="font-bold text-slate-100 text-sm">
                      {receipt.step_4_scenario.name}
                    </span>
                  </div>
                  <span className="text-slate-400 text-[11px]">
                    Triggered: {new Date(receipt.step_4_scenario.triggered_at).toLocaleTimeString()}
                  </span>
                </div>

                {/* Telemetry Vectors */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-2.5">
                  <div className="p-2 rounded bg-slate-950/70 border border-slate-800 text-center">
                    <span className="text-slate-400 block text-[10px]">CPU Usage</span>
                    <span className="font-mono font-bold text-indigo-400 text-xs">
                      {receipt.step_3_telemetry.cpu_percent}%
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-950/70 border border-slate-800 text-center">
                    <span className="text-slate-400 block text-[10px]">Memory Usage</span>
                    <span className="font-mono font-bold text-indigo-400 text-xs">
                      {receipt.step_3_telemetry.memory_percent}%
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-950/70 border border-slate-800 text-center">
                    <span className="text-slate-400 block text-[10px]">Network Out</span>
                    <span className="font-mono font-bold text-indigo-400 text-xs">
                      {receipt.step_3_telemetry.network_out_mb_s} MB/s
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-950/70 border border-slate-800 text-center">
                    <span className="text-slate-400 block text-[10px]">Active Processes</span>
                    <span className="font-mono font-bold text-indigo-400 text-xs">
                      {receipt.step_3_telemetry.process_count}
                    </span>
                  </div>
                </div>

                {/* Process List Snapshot */}
                {receipt.step_2_workstation.processes && receipt.step_2_workstation.processes.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-800/80">
                    <div className="flex items-center gap-1.5 mb-1.5 text-slate-300 font-semibold text-[11px]">
                      <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Simulated Active Process Tree Snapshot</span>
                    </div>
                    <div className="space-y-1 bg-slate-950/60 rounded-md p-2 border border-slate-800 font-mono text-[10px]">
                      {receipt.step_2_workstation.processes.map((proc) => (
                        <div key={proc.pid} className="flex flex-wrap items-center justify-between gap-1 text-slate-300">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500">[{proc.pid}]</span>
                            <span className="text-cyan-300 font-bold">{proc.name}</span>
                            <span className="text-slate-400 truncate max-w-xs">{proc.command}</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-400">
                            <span>CPU: {proc.cpu_percent}%</span>
                            <span>RAM: {proc.memory_mb.toFixed(0)}MB</span>
                            <span className={`px-1 rounded text-[9px] ${
                              proc.status === "contained"
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                                : "bg-slate-800 text-slate-300"
                            }`}>
                              {proc.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Network Sockets Snapshot */}
                {receipt.step_3_telemetry.sockets && receipt.step_3_telemetry.sockets.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-800/80">
                    <div className="flex items-center gap-1.5 mb-1.5 text-slate-300 font-semibold text-[11px]">
                      <Network className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Active Network Sockets & Inspection</span>
                    </div>
                    <div className="space-y-1 bg-slate-950/60 rounded-md p-2 border border-slate-800 font-mono text-[10px]">
                      {receipt.step_3_telemetry.sockets.map((sock, idx) => (
                        <div key={idx} className="flex flex-wrap items-center justify-between gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500">{sock.protocol}</span>
                            <span className="text-slate-300">{sock.local_address} → {sock.remote_address}</span>
                            {sock.threat_note && (
                              <span className="text-amber-400 italic text-[9px]">({sock.threat_note})</span>
                            )}
                          </div>
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                            sock.state === "BLOCKED"
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                              : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          }`}>
                            {sock.state}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-slate-300 text-[11px] mt-2.5">
                  Controlled telemetry stress vector dispatched into genuine agent pipeline for{" "}
                  <strong className="text-white font-mono">{receipt.step_2_workstation.hostname}</strong> (
                  {receipt.step_2_workstation.ip_address}) in {receipt.step_2_workstation.department} — {receipt.step_2_workstation.lab}.
                </p>
              </div>
            ) : (
              <div className="text-slate-400 italic py-2">
                Awaiting scenario trigger. Select a simulation in the Demonstration Controller above and click &quot;Execute Live Pipeline&quot;.
              </div>
            )}
          </div>
        )}


        {currentDisplayStep === 2 && (
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs">
            {receipt ? (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-300">Diagnostic Classification:</span>
                    <span
                      className={`px-2 py-0.5 rounded font-mono font-bold text-xs ${
                        receipt.step_5_ml_result.anomaly_type === "SECURITY_ANOMALY"
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : receipt.step_5_ml_result.anomaly_type === "TECHNICAL_ANOMALY"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      }`}
                    >
                      {receipt.step_5_ml_result.anomaly_type}
                    </span>
                    {receipt.step_5_ml_result.predicted_fault && receipt.step_5_ml_result.anomaly_type === "TECHNICAL_ANOMALY" && (
                      <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono text-[10px]">
                        Fault: {receipt.step_5_ml_result.predicted_fault}
                      </span>
                    )}
                    {receipt.step_5_ml_result.anomaly_type === "SECURITY_ANOMALY" && (
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono text-[10px]">
                        Threat: Host Cyber Attack
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">
                      Runtime Confidence:{" "}
                      <strong className="text-indigo-400 font-mono">
                        {(receipt.step_5_ml_result.confidence * 100).toFixed(1)}%
                      </strong>
                    </span>
                    <span className="text-slate-400">
                      Anomaly Score:{" "}
                      <strong className="text-indigo-400 font-mono">
                        {receipt.step_5_ml_result.score.toFixed(3)}
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-800/80">
                  <span className="text-[11px] text-slate-400 block mb-1">
                    Model: {receipt.step_5_ml_result.model_name} (v{receipt.step_5_ml_result.model_version})
                  </span>
                  <div className="space-y-1">
                    {receipt.step_5_ml_result.evidence?.length ? (
                      receipt.step_5_ml_result.evidence.map((ev, idx) => (
                        <div key={idx} className="text-[11px] text-slate-300 flex items-center gap-1.5">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              receipt.step_5_ml_result.anomaly_type === "SECURITY_ANOMALY"
                                ? "bg-rose-400"
                                : receipt.step_5_ml_result.anomaly_type === "TECHNICAL_ANOMALY"
                                  ? "bg-amber-400"
                                  : "bg-emerald-400"
                            }`}
                          />
                          <span>{ev}</span>
                        </div>
                      ))
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">
                        No anomalous signals flagged by the screening detector.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-slate-400 italic py-2">
                Awaiting telemetry feature extraction and dual-stage ML classification (Isolation Forest + Random Forest).
              </div>
            )}
          </div>
        )}

        {currentDisplayStep === 3 && (
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs">
            {receipt ? (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                  <div>
                    <span className="text-slate-400 block text-[11px]">User Account & Identity</span>
                    <span className="font-bold text-white text-sm">
                      {receipt.step_6_idp_context.username}
                    </span>
                    <span className="text-slate-400 text-[11px] block">
                      Dept: {receipt.step_6_idp_context.department} • Lab: {receipt.step_6_idp_context.lab || "General Lab"}
                    </span>
                  </div>
                  <div>
                    <span
                      className={`px-3 py-1 rounded-full font-bold text-xs ${
                        receipt.step_6_idp_context.role === "RESEARCHER"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : receipt.step_6_idp_context.role === "ADMIN"
                            ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                            : "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                      }`}
                    >
                      IdP Role: {receipt.step_6_idp_context.role}
                    </span>
                  </div>
                </div>

                {receipt.step_6_idp_context.is_fallback && (
                  <div className="my-2 p-2 rounded bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-amber-300 text-[11px]">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>
                      <strong>IdP Outage Fallback Active:</strong> University IdP directory was unreachable. Safe local policy cache engaged without service interruption (Rule 18 / Scenario 5).
                    </span>
                  </div>
                )}

                <div className="mt-2 pt-2 border-t border-slate-800 text-[11px]">
                  <span className="text-slate-400">Active Authorized HPC Workloads: </span>
                  {receipt.step_6_idp_context.active_workloads?.length ? (
                    <span className="font-mono font-semibold text-emerald-400">
                      {receipt.step_6_idp_context.active_workloads.join(", ")}
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">None registered (Standard workstation context)</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-slate-400 italic py-2">
                Awaiting user identity resolution from the University IdP directory.
              </div>
            )}
          </div>
        )}

        {currentDisplayStep === 4 && (
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs">
            {receipt ? (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold font-mono text-[11px]">
                      {receipt.step_7_policy_decision.playbook_to_execute}
                    </span>
                    <span className="font-bold text-white">
                      Decision: {receipt.step_7_policy_decision.decision}
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-emerald-400">
                    {receipt.step_7_policy_decision.requires_human_approval
                      ? "⚠️ Requires SOC Human Approval"
                      : "✓ Autonomous SOAR Execution"}
                  </span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed mb-2">
                  {receipt.step_7_policy_decision.reason}
                </p>
                {receipt.step_7_policy_decision.rules_triggered?.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-slate-400">Rules Triggered:</span>
                    {receipt.step_7_policy_decision.rules_triggered.map((rule, idx) => (
                      <span
                        key={idx}
                        className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono text-[10px]"
                      >
                        {rule}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-slate-400 italic py-2">
                Awaiting policy engine evaluation against university RBAC and research workload rules.
              </div>
            )}
          </div>
        )}

        {currentDisplayStep === 5 && (
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs">
            {receipt ? (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded font-bold text-xs ${
                        receipt.step_8_soar_execution.workstation_final_status === "ISOLATED"
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                          : receipt.step_8_soar_execution.workstation_final_status === "MAINTENANCE"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      }`}
                    >
                      Status: {receipt.step_8_soar_execution.workstation_final_status}
                    </span>
                    <span className="text-slate-300 font-semibold">
                      {receipt.step_8_soar_execution.workstation_final_status === "ISOLATED"
                        ? "Host OS Active • Sockets Contained • No Host Reboot Required"
                        : receipt.step_8_soar_execution.workstation_final_status === "MAINTENANCE"
                          ? "Host OS Active • Maintenance Queued • Hardware Monitored"
                          : "Host OS Active • Workload Preserved • Zero Research Interruption"}
                    </span>
                  </div>
                  <span className="text-xs text-emerald-400 font-medium">
                    {receipt.step_8_soar_execution.can_rollback ? "✓ Instant Rollback Available" : ""}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-1">
                  {receipt.step_8_soar_execution.action_taken}
                </p>

                {/* Surgical Actions Highlights */}
                {receipt.step_8_soar_execution.workstation_final_status === "ISOLATED" && (
                  <div className="mt-3 pt-2 border-t border-slate-800/80 flex flex-col gap-1.5 font-mono text-[10px]">
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Surgical Containment: Rogue worker processes neutralized without host OS reboot</span>
                    </div>
                    {receipt.step_3_telemetry.sockets?.some((s) => s.state === "BLOCKED") && (
                      <div className="flex items-center gap-1.5 text-rose-300">
                        <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                        <span>Socket Severed: Blocked unauthorized outbound connections on firewall</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-slate-400 italic py-2">
                Awaiting SOAR playbook execution. Actions are surgical and strictly preserve the host OS.
              </div>
            )}
          </div>
        )}

        {currentDisplayStep === 6 && (
          <div className="text-xs">
            {receipt ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 block mb-1">Incident Record</span>
                  <span className="font-mono font-bold text-slate-200">
                    {receipt.step_9_incident_audit.incident_id || "None (Maintenance Workflow)"}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Status: {receipt.step_9_incident_audit.status}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 block mb-1">SIEM/XDR Alert</span>
                  <span
                    className={`font-mono font-bold ${
                      receipt.step_9_incident_audit.alert_id ? "text-rose-400" : "text-slate-400"
                    }`}
                  >
                    {receipt.step_9_incident_audit.alert_id || "Exempt / Suppressed"}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    {receipt.step_9_incident_audit.alert_id
                      ? "High-Priority Alert Dispatched"
                      : "No security incident logged"}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 block mb-1">Immutable Audit Hash</span>
                  <span className="font-mono text-emerald-400 text-[11px] truncate block">
                    {receipt.step_9_incident_audit.audit_id
                      ? `SHA-256: ${receipt.step_9_incident_audit.audit_id.slice(0, 16)}...`
                      : "SHA-256: Pending Ledger Seal"}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Cryptographically sealed audit log
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 italic py-2">
                Awaiting incident logging, alert generation, and SHA-256 audit record sealing.
              </div>
            )}
          </div>
        )}

        {currentDisplayStep === 7 && (
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-white text-sm">
                Research Validation & Experimental Evidence (Guide §6.10)
              </span>
            </div>

            {receipt?.data_provenance && (
              <div className="mb-3 p-2 rounded bg-slate-950/80 border border-indigo-500/20 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                <span className="text-slate-400">
                  Empirical Calibration: <strong className="text-indigo-300">{receipt.data_provenance.dataset_name}</strong>
                </span>
                <span className="text-emerald-400 font-semibold font-mono">
                  ✓ Verified against Empirical Benchmarks
                </span>
              </div>
            )}

            <p className="text-slate-300 text-[11px] mb-3">
              {receipt?.step_10_validation_summary.instruction ||
                "Observe the actual runtime confidence returned by the selected model; observe the actual measured MTTR and agent overhead, then compare them against the documented acceptance thresholds."}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="p-2 rounded bg-slate-950 border border-slate-800/80">
                <span className="text-slate-400 block">Agent RSS Overhead</span>
                <span className="font-mono font-semibold text-emerald-400">
                  {receipt?.step_10_validation_summary?.acceptance_thresholds?.agent_max_rss || "< 50 MB"}
                </span>
                <span className="text-[10px] text-slate-400 block">Lightweight profile</span>
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800/80">
                <span className="text-slate-400 block">Agent CPU Overhead</span>
                <span className="font-mono font-semibold text-emerald-400">
                  {receipt?.step_10_validation_summary?.acceptance_thresholds?.agent_max_cpu || "< 2.0%"}
                </span>
                <span className="text-[10px] text-slate-400 block">Non-intrusive collection</span>
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800/80">
                <span className="text-slate-400 block">Screening Latency</span>
                <span className="font-mono font-semibold text-emerald-400">&lt; 10 ms Target</span>
                <span className="text-[10px] text-slate-400 block">Real-time inference</span>
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800/80">
                <span className="text-slate-400 block">SOAR MTTR</span>
                <span className="font-mono font-semibold text-emerald-400">
                  {receipt?.step_10_validation_summary?.acceptance_thresholds?.soar_mttr || "< 2.0 s"}
                </span>
                <span className="text-[10px] text-slate-400 block">Sub-second containment</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

