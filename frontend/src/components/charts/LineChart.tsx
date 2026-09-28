"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";

export interface LineSeries {
  id: string;
  name: string;
  color: string;
  data: number[]; // Array of values across time points
}

interface LineChartProps {
  labels?: string[];
  series?: LineSeries[];
  data?: { label: string; value: number }[];
  color?: string;
  height?: number;
  yMin?: number;
  yMax?: number;
  unit?: string;
  className?: string;
  onPointClick?: (label: string, index: number) => void;
  selectedPointIndex?: number | null;
}

export const LineChart: React.FC<LineChartProps> = ({
  labels: propLabels,
  series: propSeries,
  data,
  color = "#3b82f6",
  height = 220,
  yMin: propYMin,
  yMax: propYMax,
  unit = "%",
  className,
  onPointClick,
  selectedPointIndex,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const labels = propLabels || (data ? data.map((d) => d.label) : []);
  const series: LineSeries[] =
    propSeries ||
    (data
      ? [
          {
            id: "series-1",
            name: "Value",
            color,
            data: data.map((d) => d.value),
          },
        ]
      : []);

  const allValues = series.flatMap((s) => s.data);
  const calculatedMin = allValues.length ? Math.min(...allValues) : 0;
  const calculatedMax = allValues.length ? Math.max(...allValues) : 100;
  const yMin = propYMin !== undefined ? propYMin : Math.max(0, Math.floor(calculatedMin * 0.9));
  const yMax = propYMax !== undefined ? propYMax : Math.ceil(calculatedMax * 1.05 || 100);

  const paddingLeft = 36;
  const paddingRight = 16;
  const paddingTop = 20;
  const paddingBottom = 30;

  const viewBoxWidth = 600;
  const viewBoxHeight = height;

  const chartWidth = viewBoxWidth - paddingLeft - paddingRight;
  const chartHeight = viewBoxHeight - paddingTop - paddingBottom;

  const numPoints = labels.length;
  const xStep = chartWidth / (numPoints - 1 || 1);

  // Generate SVG path for a given series
  const getSeriesPath = (data: number[]) => {
    return data
      .map((val, idx) => {
        const x = paddingLeft + idx * xStep;
        const normY = (val - yMin) / (yMax - yMin || 1);
        const y = paddingTop + chartHeight - normY * chartHeight;
        return `${idx === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  };

  const getAreaPath = (data: number[]) => {
    const linePath = getSeriesPath(data);
    const lastX = paddingLeft + (data.length - 1) * xStep;
    const bottomY = paddingTop + chartHeight;
    return `${linePath} L ${lastX.toFixed(1)} ${bottomY.toFixed(1)} L ${paddingLeft} ${bottomY.toFixed(1)} Z`;
  };

  return (
    <div className={cn("relative w-full overflow-hidden flex flex-col", className)}>
      {/* Legend Header */}
      <div className="flex items-center justify-end gap-4 mb-3">
        {series.map((s) => (
          <div key={s.id} className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            <span>{s.name}</span>
          </div>
        ))}
      </div>

      {/* SVG Chart Area */}
      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          className="w-full h-auto overflow-visible"
        >
          <defs>
            {series.map((s) => (
              <linearGradient key={`grad-${s.id}`} id={`grad-${s.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.25" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0.0" />
              </linearGradient>
            ))}
          </defs>

          {/* Horizontal Grid lines */}
          {[0, 25, 50, 75, 100].map((tick) => {
            const y = paddingTop + chartHeight - (tick / 100) * chartHeight;
            return (
              <g key={tick}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={viewBoxWidth - paddingRight}
                  y2={y}
                  stroke="#1e293b"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="text-[9px] fill-slate-500 font-mono"
                >
                  {tick}
                  {unit}
                </text>
              </g>
            );
          })}

          {/* Area Fills */}
          {series.map((s) => (
            <path key={`area-${s.id}`} d={getAreaPath(s.data)} fill={`url(#grad-${s.id})`} />
          ))}

          {/* Paths */}
          {series.map((s) => (
            <path
              key={`path-${s.id}`}
              d={getSeriesPath(s.data)}
              fill="none"
              stroke={s.color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ filter: `drop-shadow(0 2px 8px ${s.color}40)` }}
            />
          ))}

          {/* Interactive Hover Guides & Circles */}
          {(() => {
            const activeIdx = hoveredIdx !== null ? hoveredIdx : (selectedPointIndex !== undefined && selectedPointIndex !== null ? selectedPointIndex : null);
            if (activeIdx === null) return null;
            return (
              <>
                <line
                  x1={paddingLeft + activeIdx * xStep}
                  y1={paddingTop}
                  x2={paddingLeft + activeIdx * xStep}
                  y2={paddingTop + chartHeight}
                  stroke="#475569"
                  strokeWidth="1.5"
                  strokeDasharray="2 2"
                />
                {series.map((s) => {
                  const val = s.data[activeIdx];
                  const normY = (val - yMin) / (yMax - yMin || 1);
                  const y = paddingTop + chartHeight - normY * chartHeight;
                  return (
                    <circle
                      key={`dot-${s.id}`}
                      cx={paddingLeft + activeIdx * xStep}
                      cy={y}
                      r="5"
                      fill="#060b18"
                      stroke={s.color}
                      strokeWidth="2.5"
                    />
                  );
                })}
              </>
            );
          })()}

          {/* X Axis Labels */}
          {labels.map((lbl, idx) => {
            const x = paddingLeft + idx * xStep;
            return (
              <text
                key={idx}
                x={x}
                y={viewBoxHeight - 8}
                textAnchor="middle"
                className="text-[10px] fill-slate-500 font-mono cursor-pointer hover:fill-blue-400"
                onClick={() => onPointClick?.(lbl, idx)}
              >
                {lbl}
              </text>
            );
          })}

          {/* Transparent Hover Hit Boxes */}
          {labels.map((lbl, idx) => {
            const x = paddingLeft + idx * xStep - xStep / 2;
            return (
              <rect
                key={`hit-${idx}`}
                x={Math.max(x, 0)}
                y={paddingTop}
                width={xStep}
                height={chartHeight}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => onPointClick?.(lbl, idx)}
              />
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {(() => {
          const activeIdx = hoveredIdx !== null ? hoveredIdx : (selectedPointIndex !== undefined && selectedPointIndex !== null ? selectedPointIndex : null);
          if (activeIdx === null) return null;
          return (
            <div
              className="absolute top-2 z-10 pointer-events-none -translate-x-1/2 glass-card px-3 py-2 text-xs border border-slate-700 bg-slate-900/90 shadow-xl"
              style={{
                left: `${((paddingLeft + activeIdx * xStep) / viewBoxWidth) * 100}%`,
              }}
            >
              <div className="font-semibold text-white mb-1">{labels[activeIdx]}</div>
              {series.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 text-[11px]">
                  <span style={{ color: s.color }}>{s.name}:</span>
                  <span className="font-mono text-white">
                    {s.data[activeIdx]}
                    {unit}
                  </span>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
};
