"use client";

import React, { useState, useMemo } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Target,
  Monitor,
  CheckCircle2,
  ExternalLink,
  Search,
  ChevronDown,
  Play,
  Pause,
  Plus,
  Minus,
  Crosshair,
  Radio,
  Clock,
  AlertTriangle,
  Flame,
  Lock,
  Globe,
  ArrowUpRight,
  Filter,
  Eye,
  X,
  RotateCcw,
} from "lucide-react";
import { DonutChart, DonutSegment } from "@/components/charts/DonutChart";
import {
  MOCK_CYBER_KPIS,
  MOCK_CYBER_ATTACK_DISTRIBUTION,
  MOCK_TOP_ATTACKED_COUNTRIES,
  MOCK_ACTIVE_THREATS,
  MOCK_TOP_VULNERABILITIES,
  MOCK_RECENT_SECURITY_EVENTS,
  MOCK_SECURITY_POSTURE_DIMENSIONS,
  MOCK_THREAT_INTEL_FEED,
  MOCK_SUBNET_HEATMAP_DATA,
} from "@/lib/api";
import { ActiveThreatItem, SecurityEventItem, VulnerabilityItem } from "@/types";

export default function CybersecurityPage() {
  // Filters & Controls
  const [timeRange, setTimeRange] = useState("Last 24 Hours");
  const [searchQuery, setSearchQuery] = useState("");
  const [isMapPlaying, setIsMapPlaying] = useState(true);
  const [mapZoom, setMapZoom] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Time-range dynamic KPI metrics
  const kpiByTimeRange: Record<
    string,
    {
      threats_detected: string;
      threats_detected_change: string;
      high_risk_events: string;
      high_risk_change: string;
      blocked_attacks: string;
      blocked_attacks_change: string;
      affected_devices: string;
      affected_devices_change: string;
      security_score: number;
      security_score_change: string;
    }
  > = {
    "Last 24 Hours": {
      threats_detected: "312",
      threats_detected_change: "↑ 28% vs last 24h",
      high_risk_events: "87",
      high_risk_change: "↑ 35% vs last 24h",
      blocked_attacks: "1,248",
      blocked_attacks_change: "↑ 18% vs last 24h",
      affected_devices: "23",
      affected_devices_change: "↑ 15% vs last 24h",
      security_score: 72,
      security_score_change: "↑ 8 pts vs last 24h",
    },
    "Last 7 Days": {
      threats_detected: "1,840",
      threats_detected_change: "↑ 12% vs prev week",
      high_risk_events: "412",
      high_risk_change: "↑ 9% vs prev week",
      blocked_attacks: "8,920",
      blocked_attacks_change: "↑ 22% vs prev week",
      affected_devices: "38",
      affected_devices_change: "↓ 4 vs prev week",
      security_score: 74,
      security_score_change: "↑ 4 pts vs prev week",
    },
    "Last 30 Days": {
      threats_detected: "6,950",
      threats_detected_change: "↓ 5% vs prev month",
      high_risk_events: "1,480",
      high_risk_change: "↓ 2% vs prev month",
      blocked_attacks: "34,100",
      blocked_attacks_change: "↑ 14% vs prev month",
      affected_devices: "54",
      affected_devices_change: "↓ 12 vs prev month",
      security_score: 76,
      security_score_change: "↑ 10 pts vs prev month",
    },
  };

  const currentKpi = kpiByTimeRange[timeRange] || kpiByTimeRange["Last 24 Hours"];

  const attackDistributionData: DonutSegment[] = [
    { label: "Malware", value: 156, color: "#06b6d4" },
    { label: "DDoS", value: 93, color: "#3b82f6" },
    { label: "Brute Force", value: 41, color: "#f59e0b" },
    { label: "Exploits", value: 22, color: "#8b5cf6" },
  ];

  // Selected entities for modals
  const [selectedEvent, setSelectedEvent] = useState<SecurityEventItem | null>(null);
  const [selectedThreat, setSelectedThreat] = useState<ActiveThreatItem | null>(null);
  const [selectedVuln, setSelectedVuln] = useState<VulnerabilityItem | null>(null);
  const [showIsolationModal, setShowIsolationModal] = useState(false);
  const [isolationTarget, setIsolationTarget] = useState<string | null>(null);
  const [hoveredHeatmapCell, setHoveredHeatmapCell] = useState<{
    subnet: string;
    time: string;
    value: number;
  } | null>(null);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return MOCK_RECENT_SECURITY_EVENTS;
    const q = searchQuery.toLowerCase();
    return MOCK_RECENT_SECURITY_EVENTS.filter(
      (e) =>
        e.event.toLowerCase().includes(q) ||
        e.source.toLowerCase().includes(q) ||
        e.destination.toLowerCase().includes(q) ||
        e.severity.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const handleIsolateClick = (target: string) => {
    setIsolationTarget(target);
    setShowIsolationModal(true);
  };

  const handleConfirmIsolation = () => {
    setShowIsolationModal(false);
    setFeedback(`Surgical isolation command executed for target ${isolationTarget}. Traffic restricted to management plane.`);
    setTimeout(() => setFeedback(null), 6000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Feedback Toast Notification */}
      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-mono">{feedback}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Filter & Time Range Bar (Aligns with Mockup Header Controls) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search IP, domain, device..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          <div className="relative">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-xs text-slate-200 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option>Last 24 Hours</option>
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          <button
            onClick={() => {
              setFeedback("Refreshed SIEM and live anomaly intelligence feeds.");
              setTimeout(() => setFeedback(null), 4000);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-xs font-medium text-slate-300 rounded-lg border border-slate-700/80 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Sync</span>
          </button>
        </div>
      </div>

      {/* Top 5 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Threats Detected */}
        <div className="glass-card p-4 flex flex-col justify-between relative overflow-hidden group hover:border-rose-500/40 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-medium text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
              {currentKpi.threats_detected_change}
            </span>
          </div>
          <div className="mt-3">
            <span className="text-xs text-slate-400 font-medium">Threats Detected</span>
            <div className="text-2xl font-bold font-mono text-white mt-0.5">
              {currentKpi.threats_detected}
            </div>
          </div>
          {/* Red Sparkline */}
          <div className="mt-2 h-7 w-full">
            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 24">
              <path
                d="M 0 18 Q 15 12, 30 16 T 60 8 T 85 14 T 100 6"
                fill="none"
                stroke="#f43f5e"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M 0 18 Q 15 12, 30 16 T 60 8 T 85 14 T 100 6 L 100 24 L 0 24 Z"
                fill="rgba(244, 63, 94, 0.1)"
              />
            </svg>
          </div>
        </div>

        {/* Card 2: High Risk Events */}
        <div className="glass-card p-4 flex flex-col justify-between relative overflow-hidden group hover:border-amber-500/40 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Target className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              {currentKpi.high_risk_change}
            </span>
          </div>
          <div className="mt-3">
            <span className="text-xs text-slate-400 font-medium">High Risk Events</span>
            <div className="text-2xl font-bold font-mono text-white mt-0.5">
              {currentKpi.high_risk_events}
            </div>
          </div>
          {/* Orange Sparkline */}
          <div className="mt-2 h-7 w-full">
            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 24">
              <path
                d="M 0 16 Q 20 8, 40 14 T 70 6 T 100 10"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M 0 16 Q 20 8, 40 14 T 70 6 T 100 10 L 100 24 L 0 24 Z"
                fill="rgba(245, 158, 11, 0.1)"
              />
            </svg>
          </div>
        </div>

        {/* Card 3: Blocked Attacks */}
        <div className="glass-card p-4 flex flex-col justify-between relative overflow-hidden group hover:border-emerald-500/40 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              {currentKpi.blocked_attacks_change}
            </span>
          </div>
          <div className="mt-3">
            <span className="text-xs text-slate-400 font-medium">Blocked Attacks</span>
            <div className="text-2xl font-bold font-mono text-white mt-0.5">
              {currentKpi.blocked_attacks}
            </div>
          </div>
          {/* Green Sparkline */}
          <div className="mt-2 h-7 w-full">
            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 24">
              <path
                d="M 0 20 Q 25 10, 50 16 T 80 8 T 100 4"
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M 0 20 Q 25 10, 50 16 T 80 8 T 100 4 L 100 24 L 0 24 Z"
                fill="rgba(16, 185, 129, 0.1)"
              />
            </svg>
          </div>
        </div>

        {/* Card 4: Affected Devices */}
        <div className="glass-card p-4 flex flex-col justify-between relative overflow-hidden group hover:border-purple-500/40 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Monitor className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-medium text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
              {currentKpi.affected_devices_change}
            </span>
          </div>
          <div className="mt-3">
            <span className="text-xs text-slate-400 font-medium">Affected Devices</span>
            <div className="text-2xl font-bold font-mono text-white mt-0.5">
              {currentKpi.affected_devices}
            </div>
          </div>
          {/* Purple Sparkline */}
          <div className="mt-2 h-7 w-full">
            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 24">
              <path
                d="M 0 14 Q 25 18, 50 10 T 75 12 T 100 6"
                fill="none"
                stroke="#a855f7"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M 0 14 Q 25 18, 50 10 T 75 12 T 100 6 L 100 24 L 0 24 Z"
                fill="rgba(168, 85, 247, 0.1)"
              />
            </svg>
          </div>
        </div>

        {/* Card 5: Security Score */}
        <div className="glass-card p-4 flex flex-col justify-between relative overflow-hidden group hover:border-blue-500/40 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <button
              onClick={() => {
                const el = document.getElementById("posture-card");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className="text-[11px] font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
            >
              View all <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="mt-3">
            <span className="text-xs text-slate-400 font-medium">Security Score</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-bold font-mono text-white">{currentKpi.security_score}</span>
              <span className="text-sm font-mono text-slate-400">/100</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1 mt-1">
              {currentKpi.security_score_change}
            </span>
          </div>
          {/* Blue Sparkline */}
          <div className="mt-2 h-7 w-full">
            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 24">
              <path
                d="M 0 16 Q 20 20, 45 12 T 75 8 T 100 4"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M 0 16 Q 20 20, 45 12 T 75 8 T 100 4 L 100 24 L 0 24 Z"
                fill="rgba(59, 130, 246, 0.1)"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Main SOC Dashboard Grid (12 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left / Center Column (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Global Threat Map (LIVE) */}
          <div className="glass-card p-5 relative overflow-hidden">
            {/* Header & Badges */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <h3 className="text-sm font-bold text-white tracking-tight">Global Threat Map</h3>
                <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                  LIVE
                </span>
              </div>

              {/* Map Floating Controls */}
              <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-700/80 rounded-lg p-1 text-slate-400">
                <button
                  onClick={() => setMapZoom((prev) => Math.min(prev + 0.2, 1.8))}
                  title="Zoom In"
                  className="p-1 hover:text-white hover:bg-slate-800 rounded transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setMapZoom((prev) => Math.max(prev - 0.2, 0.8))}
                  title="Zoom Out"
                  className="p-1 hover:text-white hover:bg-slate-800 rounded transition-colors"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsMapPlaying(!isMapPlaying)}
                  title={isMapPlaying ? "Pause Stream" : "Resume Stream"}
                  className="p-1 hover:text-white hover:bg-slate-800 rounded transition-colors"
                >
                  {isMapPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => setMapZoom(1)}
                  title="Reset Map Center"
                  className="p-1 hover:text-white hover:bg-slate-800 rounded transition-colors"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Interactive Stylized World Vector Canvas */}
            <div className="relative my-4 h-84 sm:h-96 bg-slate-950/80 rounded-xl border border-slate-800/80 overflow-hidden flex items-center justify-center">
              {/* Grid Background Pattern */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:24px_24px]" />

              {/* SVG Stylized World Map with Glowing Attack Trajectories */}
              <div
                className="w-full h-full transition-transform duration-500 ease-out flex items-center justify-center"
                style={{ transform: `scale(${mapZoom})` }}
              >
                <svg
                  viewBox="0 0 800 400"
                  className="w-full h-full max-w-full max-h-full object-contain pointer-events-none"
                >
                  <defs>
                    <linearGradient id="arcGradRed" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity="0.2" />
                    </linearGradient>
                    <linearGradient id="arcGradOrange" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#f97316" stopOpacity="0.2" />
                    </linearGradient>
                    <radialGradient id="destGlow">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                    </radialGradient>
                  </defs>

                  {/* World Continents Rough Geometries (Dark Slate Silhouette) */}
                  <g fill="#1e293b" opacity="0.6">
                    {/* North America */}
                    <path d="M 80 70 Q 140 50 180 90 Q 210 130 170 170 Q 140 180 120 150 Q 80 130 80 70 Z" />
                    {/* South America */}
                    <path d="M 170 200 Q 220 220 200 300 Q 170 340 150 280 Q 140 220 170 200 Z" />
                    {/* Europe */}
                    <path d="M 380 60 Q 440 50 450 90 Q 430 130 380 120 Q 360 80 380 60 Z" />
                    {/* Africa */}
                    <path d="M 370 140 Q 440 140 450 220 Q 420 290 390 280 Q 350 210 370 140 Z" />
                    {/* Asia / Russia */}
                    <path d="M 460 50 Q 640 40 700 110 Q 660 200 540 170 Q 470 130 460 50 Z" />
                    {/* Australia */}
                    <path d="M 620 250 Q 700 240 700 310 Q 640 330 610 290 Z" />
                  </g>

                  {/* King Khalid University SOC Target Node (Saudi Arabia Region ~ x:460, y:155) */}
                  <circle cx="460" cy="155" r="28" fill="url(#destGlow)" />
                  <circle cx="460" cy="155" r="6" fill="#3b82f6" className="animate-ping" />
                  <circle cx="460" cy="155" r="4" fill="#60a5fa" />
                  <text x="475" y="160" fill="#93c5fd" fontSize="10" fontFamily="monospace" fontWeight="bold">
                    KKU Data Center Hub
                  </text>

                  {/* Dynamic Trajectory Attack Arcs */}
                  {/* Origin 1: US East Coast (x:160, y:100) -> Target (x:460, y:155) */}
                  <path
                    d="M 160 100 Q 300 10 460 155"
                    fill="none"
                    stroke="#f43f5e"
                    strokeWidth="2"
                    strokeDasharray={isMapPlaying ? "6 4" : "none"}
                    className={isMapPlaying ? "animate-pulse" : ""}
                  />
                  <circle cx="160" cy="100" r="4" fill="#f43f5e" />

                  {/* Origin 2: China / East Asia (x:650, y:120) -> Target */}
                  <path
                    d="M 650 120 Q 560 50 460 155"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2"
                    strokeDasharray={isMapPlaying ? "6 4" : "none"}
                    className={isMapPlaying ? "animate-pulse" : ""}
                  />
                  <circle cx="650" cy="120" r="4" fill="#f59e0b" />

                  {/* Origin 3: Eastern Europe / Russia (x:560, y:70) -> Target */}
                  <path
                    d="M 560 70 Q 520 80 460 155"
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="1.5"
                    strokeDasharray={isMapPlaying ? "4 3" : "none"}
                  />
                  <circle cx="560" cy="70" r="3.5" fill="#a855f7" />

                  {/* Origin 4: Western Europe (x:400, y:80) -> Target */}
                  <path
                    d="M 400 80 Q 420 90 460 155"
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="1.5"
                    strokeDasharray={isMapPlaying ? "5 4" : "none"}
                  />
                  <circle cx="400" cy="80" r="3" fill="#06b6d4" />
                </svg>
              </div>

              {/* Bottom-Left Overlay: Attack Intensity & Types Breakdown */}
              <div className="absolute bottom-3 left-3 bg-slate-900/90 border border-slate-800 rounded-xl p-3 backdrop-blur-md max-w-xs space-y-2">
                <div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-1">
                    <span>Attack Intensity</span>
                    <span className="text-rose-400 font-bold">High</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-blue-500 via-amber-500 to-rose-500" />
                </div>

                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-[10px] font-semibold text-slate-400 block mb-1.5 uppercase tracking-wider">
                    Attack Type
                  </span>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        Malware
                      </span>
                      <span className="font-mono font-bold text-white">156</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        DDoS
                      </span>
                      <span className="font-mono font-bold text-white">93</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Brute Force
                      </span>
                      <span className="font-mono font-bold text-white">41</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                        Exploits
                      </span>
                      <span className="font-mono font-bold text-white">22</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom-Right Overlay: Top Attacked Countries */}
              <div className="absolute bottom-3 right-3 bg-slate-900/90 border border-slate-800 rounded-xl p-3 backdrop-blur-md min-w-[170px] space-y-2">
                <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">
                  Top Attacked Countries
                </span>
                <div className="space-y-1 text-xs">
                  {MOCK_TOP_ATTACKED_COUNTRIES.map((c) => (
                    <div key={c.country} className="flex items-center justify-between">
                      <span className="text-slate-300">{c.country}</span>
                      <span className="font-mono font-bold text-white">{c.count}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-1.5 border-t border-slate-800">
                  <a
                    href="#recent-events"
                    className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium transition-colors"
                  >
                    View full report →
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Subnet Heatmap & Attack Types Donut (2-Column Subgrid) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Attack Heatmap (Last 24 Hours) */}
            <div className="glass-card p-5 flex flex-col justify-between">
              <div className="pb-3 border-b border-slate-800">
                <h4 className="text-sm font-bold text-white tracking-tight">
                  Attack Heatmap <span className="text-xs font-normal text-slate-400">(Last 24 Hours)</span>
                </h4>
                <p className="text-[11px] text-slate-400">Subnet density vs hourly incursion times</p>
              </div>

              {/* Heatmap Matrix with Right-hand Vertical Scale */}
              <div className="my-4 flex items-center gap-3 overflow-x-auto">
                <div className="flex-1 min-w-[280px] space-y-1.5">
                  {/* Rows by Time */}
                  {MOCK_SUBNET_HEATMAP_DATA.map((row) => (
                    <div key={row.time} className="flex items-center gap-1.5">
                      <span className="w-10 text-[10px] font-mono text-slate-400 text-right shrink-0">
                        {row.time}
                      </span>
                      <div className="flex items-center gap-1.5 flex-1">
                        {row.values.map((val, idx) => {
                          const subnets = [
                            "10.10.1.0/24",
                            "10.10.2.0/24",
                            "10.10.3.0/24",
                            "10.10.4.0/24",
                            "10.10.5.0/24",
                            "10.10.6.0/24",
                          ];
                          let bgClass = "bg-slate-900 border-slate-800 text-slate-500";
                          if (val > 80) bgClass = "bg-rose-500/90 border-rose-400 text-white shadow-sm shadow-rose-500/30";
                          else if (val > 50) bgClass = "bg-amber-500/80 border-amber-400 text-white";
                          else if (val > 25) bgClass = "bg-blue-600/50 border-blue-500/50 text-blue-100";

                          return (
                            <button
                              key={idx}
                              onMouseEnter={() =>
                                setHoveredHeatmapCell({
                                  subnet: subnets[idx],
                                  time: row.time,
                                  value: val,
                                })
                              }
                              onMouseLeave={() => setHoveredHeatmapCell(null)}
                              onClick={() => {
                                setSearchQuery(subnets[idx]);
                                setFeedback(`Filtered recent security events for subnet ${subnets[idx]}`);
                                setTimeout(() => setFeedback(null), 4000);
                              }}
                              className={`h-7 flex-1 min-w-[36px] rounded border transition-all duration-200 flex items-center justify-center text-[10px] font-mono font-bold cursor-pointer ${bgClass}`}
                            >
                              {val}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Subnet Columns Footer Labels */}
                  <div className="flex items-center text-[9px] font-mono text-slate-400 pl-11 gap-1.5 pt-1">
                    <span className="flex-1 text-center truncate">10.10.1.0/24</span>
                    <span className="flex-1 text-center truncate">10.10.2.0/24</span>
                    <span className="flex-1 text-center truncate">10.10.3.0/24</span>
                    <span className="flex-1 text-center truncate">10.10.4.0/24</span>
                    <span className="flex-1 text-center truncate">10.10.5.0/24</span>
                    <span className="flex-1 text-center truncate">10.10.6.0/24</span>
                  </div>
                </div>

                {/* Vertical Color Scale Bar on the Right */}
                <div className="flex flex-col items-center justify-between h-48 py-1 text-[9px] font-mono text-slate-400 shrink-0">
                  <span className="text-rose-400 font-bold">High</span>
                  <div className="w-2 flex-1 my-1.5 rounded-full bg-gradient-to-b from-rose-500 via-amber-500 to-blue-900 border border-slate-800" />
                  <span className="text-slate-500">Low</span>
                </div>
              </div>

              {/* Tooltip & Readout */}
              <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                <span>
                  {hoveredHeatmapCell ? (
                    <span className="text-white font-mono">
                      {hoveredHeatmapCell.subnet} @ {hoveredHeatmapCell.time}:{" "}
                      <strong className="text-amber-400">{hoveredHeatmapCell.value} attacks</strong>
                    </span>
                  ) : (
                    "Click a cell to filter security events"
                  )}
                </span>
                <span className="text-slate-500 font-mono">6 Subnets</span>
              </div>
            </div>

            {/* Attack Types Distribution (Donut Chart) */}
            <div className="glass-card p-5 flex flex-col justify-between">
              <div className="pb-3 border-b border-slate-800">
                <h4 className="text-sm font-bold text-white tracking-tight">Attack Types Distribution</h4>
                <p className="text-[11px] text-slate-400">Classified by Model 02-B & Wazuh Rules</p>
              </div>

              {/* Center Donut Ring Graphic using DonutChart */}
              <div className="py-4 flex flex-col sm:flex-row items-center justify-center gap-6">
                <div className="flex items-center justify-center shrink-0">
                  <DonutChart
                    data={attackDistributionData}
                    size={140}
                    strokeWidth={14}
                    centerLabel="312"
                    centerSub="Total"
                    showLegend={false}
                  />
                </div>

                {/* Legend with exact stats */}
                <div className="space-y-2 text-xs w-full max-w-[170px]">
                  {MOCK_CYBER_ATTACK_DISTRIBUTION.map((item) => (
                    <div
                      key={item.label}
                      onClick={() => {
                        setSearchQuery(item.label);
                        setFeedback(`Filtered events for attack type ${item.label}`);
                        setTimeout(() => setFeedback(null), 3000);
                      }}
                      className="flex items-center justify-between cursor-pointer hover:bg-slate-800/40 px-1.5 py-0.5 rounded transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-slate-300 group-hover:text-white font-medium">{item.label}</span>
                      </div>
                      <span className="font-mono text-slate-400 text-[11px] group-hover:text-slate-200">
                        {item.percentage}% <span className="text-slate-500">({item.value})</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Top Incursion: Malware (XMRig)</span>
                <span className="text-cyan-400 font-bold">50.0% Dominance</span>
              </div>
            </div>
          </div>

          {/* Security Events & Top Vulnerabilities (2-Column Subgrid) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="recent-events">
            {/* Recent Security Events */}
            <div className="glass-card p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h4 className="text-sm font-bold text-white tracking-tight">Recent Security Events</h4>
                    <p className="text-[11px] text-slate-400">SIEM events correlated with telemetry</p>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto my-3">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                        <th className="pb-2">Time</th>
                        <th className="pb-2">Event</th>
                        <th className="pb-2">Source</th>
                        <th className="pb-2">Destination</th>
                        <th className="pb-2">Severity</th>
                        <th className="pb-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {filteredEvents.map((evt) => (
                        <tr
                          key={evt.id}
                          onClick={() => setSelectedEvent(evt)}
                          className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                        >
                          <td className="py-2.5 text-[10px] text-slate-400 whitespace-nowrap">{evt.time}</td>
                          <td className="py-2.5 font-sans font-medium text-white group-hover:text-blue-400 transition-colors">
                            {evt.event}
                          </td>
                          <td className="py-2.5 text-[11px] text-cyan-400 font-mono">{evt.source}</td>
                          <td className="py-2.5 text-[11px] text-slate-300 font-mono">{evt.destination}</td>
                          <td className="py-2.5">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${evt.severity === "Critical"
                                ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                : evt.severity === "High"
                                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                  : evt.severity === "Medium"
                                    ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                                    : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                }`}
                            >
                              {evt.severity}
                            </span>
                          </td>
                          <td className="py-2.5 text-right whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] ${evt.statusColor === "emerald"
                                ? "text-emerald-400"
                                : evt.statusColor === "rose"
                                  ? "text-rose-400"
                                  : evt.statusColor === "amber"
                                    ? "text-amber-400"
                                    : "text-blue-400"
                                }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${evt.statusColor === "emerald"
                                  ? "bg-emerald-400"
                                  : evt.statusColor === "rose"
                                    ? "bg-rose-400"
                                    : evt.statusColor === "amber"
                                      ? "bg-amber-400"
                                      : "bg-blue-400"
                                  }`}
                              />
                              {evt.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <button
                  onClick={() => {
                    setFeedback("Displaying complete security event ledger.");
                    setTimeout(() => setFeedback(null), 3000);
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 transition-colors"
                >
                  View all events →
                </button>
              </div>
            </div>

            {/* Top Vulnerabilities */}
            <div className="glass-card p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h4 className="text-sm font-bold text-white tracking-tight">Top Vulnerabilities</h4>
                    <p className="text-[11px] text-slate-400">CVE exposures identified on university hosts</p>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto my-3">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                        <th className="pb-2">Vulnerability</th>
                        <th className="pb-2">Severity</th>
                        <th className="pb-2 text-center">Affected Assets</th>
                        <th className="pb-2 text-right">CVSS Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {MOCK_TOP_VULNERABILITIES.map((vuln) => (
                        <tr
                          key={vuln.cve}
                          onClick={() => setSelectedVuln(vuln)}
                          className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                        >
                          <td className="py-2.5 font-bold text-blue-400 group-hover:text-blue-300 transition-colors">
                            {vuln.cve}
                          </td>
                          <td className="py-2.5">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${vuln.severity === "Critical"
                                ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                : vuln.severity === "High"
                                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                  : "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                                }`}
                            >
                              {vuln.severity}
                            </span>
                          </td>
                          <td className="py-2.5 text-center text-slate-300 font-bold">{vuln.affected_assets}</td>
                          <td className="py-2.5 text-right font-bold text-sm">
                            <span
                              className={
                                vuln.cvss_score >= 9.0
                                  ? "text-rose-400"
                                  : vuln.cvss_score >= 7.0
                                    ? "text-amber-400"
                                    : "text-yellow-400"
                              }
                            >
                              {vuln.cvss_score.toFixed(1)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <button
                  onClick={() => {
                    setFeedback("Displaying complete university CVE ledger.");
                    setTimeout(() => setFeedback(null), 3000);
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 transition-colors"
                >
                  View all vulnerabilities →
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column Stack (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Card 1: Active Threats */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="text-sm font-bold text-white tracking-tight">Active Threats</h4>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                5 Active
              </span>
            </div>

            <div className="space-y-3">
              {MOCK_ACTIVE_THREATS.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedThreat(t)}
                  className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${t.category === "MALWARE"
                          ? "bg-rose-500/15 text-rose-400"
                          : t.category === "DDOS"
                            ? "bg-amber-500/15 text-amber-400"
                            : t.category === "BRUTE_FORCE"
                              ? "bg-yellow-500/15 text-yellow-400"
                              : t.category === "SQLI"
                                ? "bg-blue-500/15 text-blue-400"
                                : "bg-purple-500/15 text-purple-400"
                          }`}
                      >
                        {t.category === "MALWARE" && <ShieldAlert className="w-4 h-4" />}
                        {t.category === "DDOS" && <Flame className="w-4 h-4" />}
                        {t.category === "BRUTE_FORCE" && <Lock className="w-4 h-4" />}
                        {t.category === "SQLI" && <Globe className="w-4 h-4" />}
                        {t.category === "SUSPICIOUS" && <Radio className="w-4 h-4" />}
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">
                          {t.title}
                        </h5>
                        <p className="text-[11px] text-slate-400 mt-0.5">{t.target_description}</p>
                        <p className="text-[10px] font-mono text-cyan-400 mt-1">{t.target_ip}</p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${t.risk === "Critical"
                          ? "bg-rose-500/20 text-rose-400"
                          : t.risk === "High Risk"
                            ? "bg-amber-500/20 text-amber-400"
                            : t.risk === "Medium"
                              ? "bg-yellow-500/20 text-yellow-400"
                              : "bg-blue-500/20 text-blue-400"
                          }`}
                      >
                        {t.risk}
                      </span>
                      <p className="text-[10px] text-slate-500 mt-1.5">{t.time_ago}</p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${t.statusColor === "emerald"
                            ? "bg-emerald-400"
                            : t.statusColor === "rose"
                              ? "bg-rose-400"
                              : t.statusColor === "amber"
                                ? "bg-amber-400"
                                : "bg-blue-400"
                            }`}
                        />
                        <span className="text-[9px] text-slate-400">{t.status}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card 2: Security Posture */}
          <div className="glass-card p-5 space-y-4" id="posture-card">
            <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
              <h4 className="text-sm font-bold text-white tracking-tight">Security Posture</h4>
              <span className="text-xs font-mono text-emerald-400 font-bold">Good</span>
            </div>

            {/* Circular Posture Gauge */}
            <div className="flex items-center justify-center py-2">
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#1e293b" strokeWidth="9" />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="9"
                    strokeDasharray="251.32"
                    strokeDashoffset="70.37"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-bold font-mono text-white">72</span>
                  <span className="text-[10px] text-slate-400 uppercase font-mono">/100</span>
                  <span className="text-[10px] font-bold text-emerald-400 mt-0.5">Good</span>
                </div>
              </div>
            </div>

            {/* Security Dimensions Progress Bars */}
            <div className="space-y-2.5 pt-2">
              {MOCK_SECURITY_POSTURE_DIMENSIONS.map((dim) => (
                <div key={dim.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">{dim.name}</span>
                    <span className="font-mono text-slate-400 font-semibold">
                      {dim.score}/{dim.max}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(dim.score / dim.max) * 100}%`,
                        backgroundColor: dim.colorHex,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card 3: Threat Intelligence Feed */}
          <div className="glass-card p-5 space-y-4">
            <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
              <h4 className="text-sm font-bold text-white tracking-tight">Threat Intelligence Feed</h4>
              <span className="text-[10px] font-mono text-slate-400">External Advisories</span>
            </div>

            <div className="space-y-3">
              {MOCK_THREAT_INTEL_FEED.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1.5"
                >
                  <div className="flex items-start gap-2">
                    <div className="p-1 rounded bg-rose-500/10 text-rose-400 shrink-0 mt-0.5">
                      {item.type === "phishing" ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <ShieldAlert className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h5 className="text-xs font-bold text-white leading-snug">{item.title}</h5>
                      <p className="text-[11px] text-slate-400 mt-0.5">{item.description}</p>
                      <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-800/60 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3" /> {item.time_ago}
                        </span>
                        <span className="text-blue-400 hover:text-blue-300 cursor-pointer font-medium">
                          Advisory Details
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: Security Event Inspector (SOAR & Wazuh Integration) */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-bold text-white">Security Event Telemetry</h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono">
                <div>
                  <span className="text-slate-500 text-[10px]">EVENT ID</span>
                  <p className="text-white font-bold">{selectedEvent.id}</p>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px]">TIME OCCURRED</span>
                  <p className="text-slate-300">{selectedEvent.time}</p>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px]">SOURCE IP / HOST</span>
                  <p className="text-cyan-400 font-bold">{selectedEvent.source}</p>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px]">TARGET DESTINATION</span>
                  <p className="text-amber-400 font-bold">{selectedEvent.destination}</p>
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Incident Classification:</span>
                  <span className="text-rose-400 font-bold">{selectedEvent.event}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Severity Level:</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    {selectedEvent.severity}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">SOAR Correlation Status:</span>
                  <span className="text-emerald-400 font-medium">{selectedEvent.status}</span>
                </div>
              </div>

              <div className="p-3 bg-blue-950/40 border border-blue-800/40 rounded-xl text-[11px] text-blue-200">
                <strong>SIEM/XDR Rule Verification:</strong> This event matched Wazuh Rule ID <code>100204</code>{" "}
                (Outbound Connection to Known Mining Pool / C2). University IdP verified active session without
                authorized research approval.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium"
              >
                Dismiss
              </button>
              <button
                onClick={() => {
                  const target = selectedEvent.source;
                  setSelectedEvent(null);
                  handleIsolateClick(target);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-colors"
              >
                Isolate Host Source
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Active Threat Action & Containment Modal */}
      {selectedThreat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">{selectedThreat.title}</h3>
              </div>
              <button
                onClick={() => setSelectedThreat(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">CATEGORY</span>
                  <span className="text-white font-bold">{selectedThreat.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">TARGET</span>
                  <span className="text-cyan-400">{selectedThreat.target_ip}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">RISK LEVEL</span>
                  <span className="text-rose-400 font-bold">{selectedThreat.risk}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">DISCOVERED</span>
                  <span className="text-slate-300">{selectedThreat.time_ago}</span>
                </div>
              </div>

              <p className="text-slate-300 leading-relaxed">{selectedThreat.target_description}</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setSelectedThreat(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const target = selectedThreat.target_ip;
                  setSelectedThreat(null);
                  handleIsolateClick(target);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-colors"
              >
                Execute Surgical Containment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Vulnerability Advisory Modal */}
      {selectedVuln && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">{selectedVuln.cve}</h3>
              </div>
              <button
                onClick={() => setSelectedVuln(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-500 text-[10px]">CVSS 3.1 BASE SCORE</span>
                  <div className="text-2xl font-bold font-mono text-rose-400">{selectedVuln.cvss_score}</div>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 text-[10px]">SEVERITY RATING</span>
                  <div className="text-sm font-bold text-rose-400">{selectedVuln.severity}</div>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 text-[10px]">AFFECTED HOSTS</span>
                  <div className="text-sm font-bold text-white font-mono">{selectedVuln.affected_assets} Devices</div>
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                <h5 className="font-bold text-white">Recommended Remediation:</h5>
                <p className="text-slate-300 leading-relaxed">
                  Update Apache HTTP Server to version 2.4.60 or later using the automated playbook. Restrict untrusted
                  proxy headers and verify reverse-proxy configurations.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setSelectedVuln(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setSelectedVuln(null);
                  setFeedback(`Scheduled automated patch playbook for ${selectedVuln.cve} across ${selectedVuln.affected_assets} affected devices.`);
                  setTimeout(() => setFeedback(null), 5000);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors"
              >
                Schedule Fleet Patch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Surgical Network Isolation Confirmation (Rule 19 & 20) */}
      {showIsolationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400 pb-3 border-b border-slate-800">
              <div className="p-2 rounded-xl bg-rose-500/20 border border-rose-500/30">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Confirm Surgical Isolation</h3>
                <p className="text-xs text-slate-400">Rule 19: Non-Reboot Network Packet Containment</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <p>
                You are executing surgical isolation for target{" "}
                <code className="text-rose-400 font-mono font-bold">{isolationTarget}</code>.
              </p>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Method:</span>
                  <span className="text-white">OS Kernel Packet Filter (iptables/WFP)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Host Reboot:</span>
                  <span className="text-emerald-400 font-bold">None (State Preserved)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Management Port:</span>
                  <span className="text-blue-400">Allowed (SSH/Agent Telemetry)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Audit Logging:</span>
                  <span className="text-white">Enabled (Admin Authorized)</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/50 text-amber-200 text-[11px]">
                <strong>Researcher Protection Notice:</strong> If this node belongs to an active research workload,
                in-memory experiment state will remain intact while untrusted network egress is severed.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowIsolationModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmIsolation}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-colors"
              >
                Confirm Surgical Containment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
