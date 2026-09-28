import React from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: React.ReactNode;
  iconColor?: "blue" | "cyan" | "purple" | "emerald" | "amber" | "rose";
  sparklineData?: number[];
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  change,
  changeType = "positive",
  icon,
  iconColor = "blue",
  sparklineData = [20, 35, 30, 45, 40, 60, 55, 75, 70, 85],
  className,
}) => {
  const iconColorStyles = {
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    cyan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    purple: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    rose: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  };

  const sparklineStroke = {
    blue: "#3b82f6",
    cyan: "#06b6d4",
    purple: "#8b5cf6",
    emerald: "#10b981",
    amber: "#f59e0b",
    rose: "#ef4444",
  }[iconColor];

  // Generate SVG path for mini sparkline
  const min = Math.min(...sparklineData);
  const max = Math.max(...sparklineData);
  const range = max - min || 1;
  const width = 80;
  const height = 30;

  const points = sparklineData
    .map((val, idx) => {
      const x = (idx / (sparklineData.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div
      className={cn(
        "glass-card p-5 relative overflow-hidden transition-all duration-300 hover:border-blue-500/40 hover:-translate-y-0.5 group",
        className
      )}
    >
      {/* Subtle Top-Right Ambient Glow */}
      <div
        className={cn(
          "absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl opacity-15 pointer-events-none transition-opacity group-hover:opacity-30",
          iconColor === "rose"
            ? "bg-rose-500"
            : iconColor === "emerald"
            ? "bg-emerald-500"
            : iconColor === "amber"
            ? "bg-amber-500"
            : iconColor === "purple"
            ? "bg-purple-500"
            : iconColor === "cyan"
            ? "bg-cyan-500"
            : "bg-blue-500"
        )}
      />

      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 tracking-wider uppercase">{title}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <h3 className="text-2xl lg:text-3xl font-bold tracking-tight text-white font-mono">
              {value}
            </h3>
            {change && (
              <span
                className={cn(
                  "text-xs font-semibold px-2 py-0.5 rounded-full",
                  changeType === "positive"
                    ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
                    : changeType === "negative"
                    ? "text-rose-400 bg-rose-500/10 border border-rose-500/20"
                    : "text-slate-400 bg-slate-500/10 border border-slate-500/20"
                )}
              >
                {change}
              </span>
            )}
          </div>
        </div>

        <div className={cn("p-2.5 rounded-xl border", iconColorStyles[iconColor])}>
          {icon}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between pt-2 border-t border-slate-800/60">
        <p className="text-xs text-slate-400 truncate max-w-[65%]">{subtitle}</p>

        {/* Mini Sparkline Chart */}
        <svg
          width={width}
          height={height}
          className="overflow-visible opacity-70 group-hover:opacity-100 transition-opacity"
        >
          <polyline
            fill="none"
            stroke={sparklineStroke}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />
        </svg>
      </div>
    </div>
  );
};
