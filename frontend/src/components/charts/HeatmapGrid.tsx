"use client";

import React from "react";
import { AttackMatrixCell } from "@/types";
import { cn } from "@/lib/utils";

interface HeatmapGridProps {
  data: AttackMatrixCell[];
  className?: string;
}

export const HeatmapGrid: React.FC<HeatmapGridProps> = ({ data, className }) => {
  const getCellColor = (severity: AttackMatrixCell["severity"]) => {
    switch (severity) {
      case "critical":
        return "bg-rose-500/80 border-rose-500 hover:bg-rose-400";
      case "high":
        return "bg-amber-500/70 border-amber-500 hover:bg-amber-400";
      case "medium":
        return "bg-blue-500/50 border-blue-500 hover:bg-blue-400";
      case "low":
        return "bg-slate-800/80 border-slate-700 hover:bg-slate-700";
      default:
        return "bg-slate-900/60 border-slate-800";
    }
  };

  return (
    <div className={cn("glass-card p-4", className)}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-sm font-semibold text-white tracking-tight">
            Attack Intensity Matrix (24-Hour Distribution)
          </h4>
          <p className="text-xs text-slate-400">Hourly density of security events & intrusions</p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <span>Low</span>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-slate-800 border border-slate-700" />
            <span className="w-2.5 h-2.5 rounded bg-blue-500/50 border border-blue-500" />
            <span className="w-2.5 h-2.5 rounded bg-amber-500/70 border border-amber-500" />
            <span className="w-2.5 h-2.5 rounded bg-rose-500/80 border border-rose-500" />
          </div>
          <span>Critical</span>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-6 sm:grid-cols-12 md:grid-cols-24 gap-1.5">
        {data.map((cell) => {
          const hourLabel = `${cell.hour.toString().padStart(2, "0")}:00`;
          return (
            <div
              key={cell.hour}
              title={`${hourLabel} — ${cell.attacks} events (${cell.severity.toUpperCase()})`}
              className={cn(
                "group relative h-12 rounded-lg border transition-all duration-200 flex flex-col items-center justify-between p-1 cursor-pointer",
                getCellColor(cell.severity)
              )}
            >
              <span className="text-[9px] font-mono text-slate-400 group-hover:text-white">
                {cell.hour}h
              </span>
              <span className="text-[10px] font-bold font-mono text-white">
                {cell.attacks}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
