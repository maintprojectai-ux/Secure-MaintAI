"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  Bell,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Calendar,
  ChevronDown,
  Moon,
  Ticket,
} from "lucide-react";
import { MOCK_ALERTS } from "@/lib/api";

const ROUTE_TITLES: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Dashboard", subtitle: "Overview of your infrastructure and security status" },
  "/devices": { title: "Devices Monitoring", subtitle: "Monitor and manage all university infrastructure devices in real-time" },
  "/alerts": { title: "Incident & Alert Management", subtitle: "Anomaly screening triage, evidence inspection, and SOAR response" },
  "/cybersecurity": { title: "Cybersecurity & Threat Intelligence", subtitle: "SIEM correlation, attack matrix, and geographic intrusion origins" },
  "/predictions": { title: "AI Predictive", subtitle: "Model 01, 02-A, 02-B inference, confidence metrics, and What-If analysis" },
  "/maintenance": { title: "Predictive Maintenance Schedule", subtitle: "Autonomous task orchestration, calendar dispatch, and hardware health" },
  "/reports": { title: "Reports", subtitle: "Comprehensive overview of your infrastructure performance and security posture" },
  "/users": { title: "Users Management", subtitle: "Manage system users, roles, permissions, and access control." },
  "/activity-logs": { title: "Activity Logs", subtitle: "Monitor and review all system activities and user actions" },
  "/settings": { title: "Settings", subtitle: "Configure system preferences, security, and integrations" },
  "/help": { title: "Help / Support", subtitle: "We're here to help you. Find answers, guides, and get support." },
};

export const TopNavbar: React.FC = () => {
  const pathname = usePathname();
  const [currentTime, setCurrentTime] = useState<string>("");
  const [showNotifications, setShowNotifications] = useState(false);

  // Client-only clock to prevent SSR hydration mismatch
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Determine current page metadata
  const currentRouteMeta =
    ROUTE_TITLES[pathname] || {
      title: pathname.split("/").filter(Boolean).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(" > ") || "Overview",
      subtitle: "Secure-MaintAI Platform",
    };

  return (
    <header className="h-16 px-6 border-b border-slate-800/80 bg-[#070d1e]/80 backdrop-blur-xl sticky top-0 z-30 flex items-center justify-between gap-4">
      {/* Page Title & Breadcrumb */}
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <h1 className="text-base sm:text-lg font-bold text-white tracking-tight font-sans">
            {currentRouteMeta.title}
          </h1>
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE TELEMETRY
          </span>
        </div>
        <p className="hidden md:block text-[11px] text-slate-400 truncate max-w-lg">
          {currentRouteMeta.subtitle}
        </p>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Tickets Shortcut Button (for /help) */}
        {pathname === "/help" && (
          <a
            href="#tickets"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700/80 bg-[#091124] hover:bg-slate-800 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
          >
            <Ticket className="w-3.5 h-3.5 text-blue-400" />
            <span>Tickets</span>
          </a>
        )}

        {/* Date Selector Pill */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-800 bg-[#091124] text-slate-300 text-xs font-sans select-none">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>Sep 16, 2026</span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </div>

        {/* Live Clock */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-800 bg-[#091124] text-slate-300 text-xs font-mono">
          <Clock className="w-3.5 h-3.5 text-blue-400" />
          <span>{currentTime || "12:00:00"}</span>
        </div>

        {/* Dark/Light Theme Toggle Icon */}
        <button
          className="p-2 rounded-xl border border-slate-700/80 bg-[#091124] text-slate-400 hover:text-white transition-colors"
          title="Toggle Theme"
        >
          <Moon className="w-4 h-4" />
        </button>

        {/* Notification Bell Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-xl border border-slate-700/80 bg-[#091124] text-slate-300 hover:text-white hover:border-blue-500/50 transition-colors relative"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white font-mono text-[9px] font-bold flex items-center justify-center animate-pulse">
              5
            </span>
          </button>

          {/* Notifications Drawer */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-700 bg-[#0c1427]/98 backdrop-blur-xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-rose-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Recent Critical Alerts
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">3 Unacknowledged</span>
              </div>

              <div className="py-2 space-y-2 max-h-72 overflow-y-auto">
                {MOCK_ALERTS.slice(0, 3).map((alert) => (
                  <div
                    key={alert.id}
                    className="p-2.5 rounded-xl border border-slate-800/80 bg-slate-900/60 hover:bg-slate-800/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-white truncate">
                        {alert.title}
                      </p>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30">
                        {alert.severity}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                      {alert.description}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2 font-mono">
                      <span>{alert.workstation_hostname}</span>
                      <span>14m ago</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-800 text-center">
                <a
                  href="/alerts"
                  onClick={() => setShowNotifications(false)}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> View all in Alert Center
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
