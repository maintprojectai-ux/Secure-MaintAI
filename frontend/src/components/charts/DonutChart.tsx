"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutSegment[];
  size?: number;
  thickness?: number;
  strokeWidth?: number;
  centerTitle?: string;
  centerValue?: string | number;
  centerLabel?: string | number;
  centerSub?: string;
  showLegend?: boolean;
  className?: string;
  onSegmentClick?: (segment: DonutSegment, index: number) => void;
  selectedIndex?: number | null;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  data,
  size = 180,
  thickness: propThickness,
  strokeWidth,
  centerTitle: propCenterTitle,
  centerValue: propCenterValue,
  centerLabel,
  centerSub,
  showLegend = true,
  className,
  onSegmentClick,
  selectedIndex,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const thickness = propThickness || strokeWidth || 24;
  const centerValue = propCenterValue !== undefined ? propCenterValue : centerLabel;
  const centerTitle = propCenterTitle !== undefined ? propCenterTitle : (centerSub || "Total");

  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  return (
    <div className={cn("flex flex-col sm:flex-row items-center gap-6", className)}>
      {/* SVG Donut */}
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
          {data.map((segment, idx) => {
            const percent = segment.value / total;
            const strokeDasharray = `${percent * circumference} ${circumference}`;
            const strokeDashoffset = -accumulatedPercent * circumference;
            accumulatedPercent += percent;

            const isHovered = hoveredIdx === idx || selectedIndex === idx;

            return (
              <circle
                key={idx}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={isHovered ? thickness + 4 : thickness}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-300 cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => onSegmentClick?.(segment, idx)}
                style={{
                  filter: isHovered ? `drop-shadow(0 0 8px ${segment.color})` : "none",
                }}
              />
            );
          })}
        </svg>

        {/* Center Readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
          <span className="text-2xl font-bold font-mono text-white tracking-tight">
            {hoveredIdx !== null ? data[hoveredIdx].value : centerValue ?? total}
          </span>
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium max-w-[80px] truncate">
            {hoveredIdx !== null ? data[hoveredIdx].label : centerTitle}
          </span>
        </div>
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="flex flex-col gap-2 min-w-[140px]">
          {data.map((item, idx) => {
            const pct = Math.round((item.value / total) * 100);
            const isHovered = hoveredIdx === idx || selectedIndex === idx;
            return (
              <div
                key={idx}
                className={cn(
                  "flex items-center justify-between text-xs py-1 px-2 rounded-lg transition-colors cursor-pointer",
                  isHovered ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
                )}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => onSegmentClick?.(item, idx)}
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
                <span className="font-mono font-semibold text-slate-300">{pct}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
