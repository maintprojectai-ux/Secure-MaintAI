import React from "react";
import { cn } from "@/lib/utils";

interface GaugeMeterProps {
  label: string;
  value: number; // 0 to 100
  sublabel?: string;
  size?: number;
  strokeWidth?: number;
  color?: "blue" | "cyan" | "purple" | "emerald" | "amber" | "rose";
  className?: string;
}

export const GaugeMeter: React.FC<GaugeMeterProps> = ({
  label,
  value,
  sublabel,
  size = 140,
  strokeWidth = 10,
  color = "blue",
  className,
}) => {
  const clampedValue = Math.min(Math.max(value, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  // Use a 270-degree arc for dashboard dial look
  const arcLength = circumference * 0.75;
  const strokeDashoffset = arcLength - (clampedValue / 100) * arcLength;

  const colorStyles = {
    blue: { stroke: "#3b82f6", glow: "rgba(59, 130, 246, 0.4)", text: "text-blue-400" },
    cyan: { stroke: "#06b6d4", glow: "rgba(6, 182, 212, 0.4)", text: "text-cyan-400" },
    purple: { stroke: "#8b5cf6", glow: "rgba(139, 92, 246, 0.4)", text: "text-purple-400" },
    emerald: { stroke: "#10b981", glow: "rgba(16, 185, 129, 0.4)", text: "text-emerald-400" },
    amber: { stroke: "#f59e0b", glow: "rgba(245, 158, 11, 0.4)", text: "text-amber-400" },
    rose: { stroke: "#ef4444", glow: "rgba(239, 68, 68, 0.4)", text: "text-rose-400" },
  }[color];

  return (
    <div className={cn("flex flex-col items-center justify-center p-3", className)}>
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-135"
        >
          {/* Background Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#1e293b"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />

          {/* Value Progress Arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colorStyles.stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{
              transition: "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
              filter: `drop-shadow(0 0 6px ${colorStyles.glow})`,
            }}
          />
        </svg>

        {/* Center Readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold font-mono tracking-tight text-white">
            {clampedValue.toFixed(1)}
            <span className="text-xs text-slate-400 font-sans">%</span>
          </span>
          <span className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">
            {label}
          </span>
        </div>
      </div>

      {sublabel && (
        <p className="text-xs text-slate-400 mt-1 font-mono tracking-wide text-center">
          {sublabel}
        </p>
      )}
    </div>
  );
};
