"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface RadarAxis {
  label: string;
  value: number; // 0 to 100
  maxValue?: number;
}

interface RadarChartProps {
  axes: RadarAxis[];
  size?: number;
  color?: string;
  className?: string;
}

export const RadarChart: React.FC<RadarChartProps> = ({
  axes,
  size = 260,
  color = "#8b5cf6",
  className,
}) => {
  const center = size / 2;
  const radius = center - 40;
  const totalAxes = axes.length;

  const getCoordinates = (index: number, value: number, max: number = 100) => {
    const angle = (Math.PI * 2 / totalAxes) * index - Math.PI / 2;
    const r = (value / max) * radius;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y };
  };

  // Polygon points for data
  const polygonPoints = axes
    .map((axis, i) => {
      const { x, y } = getCoordinates(i, axis.value, axis.maxValue || 100);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className={cn("relative flex items-center justify-center p-2", className)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        {/* Background Web Rings */}
        {[0.25, 0.5, 0.75, 1.0].map((level) => {
          const ringPoints = axes
            .map((_, i) => {
              const angle = (Math.PI * 2 / totalAxes) * i - Math.PI / 2;
              const r = radius * level;
              const x = center + r * Math.cos(angle);
              const y = center + r * Math.sin(angle);
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(" ");

          return (
            <polygon
              key={level}
              points={ringPoints}
              fill="none"
              stroke="#1e293b"
              strokeWidth="1"
              strokeDasharray={level === 1 ? "none" : "2 2"}
            />
          );
        })}

        {/* Axis Spokes */}
        {axes.map((axis, i) => {
          const { x, y } = getCoordinates(i, 100, 100);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="#1e293b"
              strokeWidth="1"
            />
          );
        })}

        {/* Data Area Polygon */}
        <polygon
          points={polygonPoints}
          fill={color}
          fillOpacity="0.25"
          stroke={color}
          strokeWidth="2.5"
          style={{ filter: `drop-shadow(0 0 8px ${color}60)` }}
        />

        {/* Data Points */}
        {axes.map((axis, i) => {
          const { x, y } = getCoordinates(i, axis.value, axis.maxValue || 100);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="4.5"
              fill="#060b18"
              stroke={color}
              strokeWidth="2"
            />
          );
        })}

        {/* Axis Labels */}
        {axes.map((axis, i) => {
          const angle = (Math.PI * 2 / totalAxes) * i - Math.PI / 2;
          const labelRadius = radius + 22;
          const x = center + labelRadius * Math.cos(angle);
          const y = center + labelRadius * Math.sin(angle);

          return (
            <text
              key={i}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[10px] font-mono fill-slate-300 font-medium"
            >
              {axis.label} ({axis.value}%)
            </text>
          );
        })}
      </svg>
    </div>
  );
};
