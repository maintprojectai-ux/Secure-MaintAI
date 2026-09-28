import React from "react";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  glow?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = "md",
  className,
  glow = false,
}) => {
  const norm = (status || "").toUpperCase();

  let colorClasses = "bg-slate-800/80 text-slate-300 border-slate-700";
  let dotColor = "bg-slate-400";

  if (["ONLINE", "HEALTHY", "SUCCESS", "OPTIMAL", "RESOLVED", "COMPLETED", "OPERATIONAL", "LOW"].includes(norm)) {
    colorClasses = "bg-emerald-950/60 text-emerald-400 border-emerald-500/30";
    dotColor = "bg-emerald-400";
  } else if (["WARNING", "MEDIUM", "ACKNOWLEDGED", "IN_PROGRESS", "SCHEDULED"].includes(norm)) {
    colorClasses = "bg-amber-950/60 text-amber-400 border-amber-500/30";
    dotColor = "bg-amber-400";
  } else if (["CRITICAL", "HIGH", "FAILURE", "OVERDUE", "THREAT", "NEW"].includes(norm)) {
    colorClasses = "bg-rose-950/60 text-rose-400 border-rose-500/30";
    dotColor = "bg-rose-400";
  } else if (["OFFLINE", "CLOSED", "SUSPENDED"].includes(norm)) {
    colorClasses = "bg-slate-900/70 text-slate-400 border-slate-700/40";
    dotColor = "bg-slate-500";
  } else if (["ADMIN", "IT_OPERATOR", "API"].includes(norm)) {
    colorClasses = "bg-blue-950/60 text-blue-400 border-blue-500/30";
    dotColor = "bg-blue-400";
  } else if (["RESEARCHER", "SYSTEM"].includes(norm)) {
    colorClasses = "bg-purple-950/60 text-purple-400 border-purple-500/30";
    dotColor = "bg-purple-400";
  } else if (["STUDENT"].includes(norm)) {
    colorClasses = "bg-cyan-950/60 text-cyan-400 border-cyan-500/30";
    dotColor = "bg-cyan-400";
  }

  const sizeClasses =
    size === "sm"
      ? "text-xs px-2 py-0.5"
      : size === "lg"
      ? "text-sm px-3 py-1.5 font-semibold"
      : "text-xs px-2.5 py-1 font-medium";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border tracking-wide uppercase transition-all duration-200",
        colorClasses,
        sizeClasses,
        glow && "shadow-sm",
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", dotColor)} />
      {status}
    </span>
  );
};
