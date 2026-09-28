"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Server,
  AlertTriangle,
  ShieldAlert,
  Sparkles,
  Calendar,
  FileText,
  Users,
  ScrollText,
  Settings,
  HelpCircle,
  LogOut,
  ChevronRight,
  Menu,
  X,
  Shield,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: number | string;
  badgeColor?: string;
}

const NAV_ITEMS: NavItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Device Monitoring", href: "/devices", icon: Server },
  { name: "Alerts", href: "/alerts", icon: AlertTriangle, badge: 6, badgeColor: "bg-rose-500" },
  { name: "Cybersecurity", href: "/cybersecurity", icon: ShieldAlert },
  { name: "AI Predictions", href: "/predictions", icon: Sparkles, badge: "AI", badgeColor: "bg-purple-500" },
  { name: "Maintenance", href: "/maintenance", icon: Calendar },
  { name: "Reports", href: "/reports", icon: FileText },
  { name: "Users Management", href: "/users", icon: Users },
  { name: "Activity Logs", href: "/activity-logs", icon: ScrollText },
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Help & Support", href: "/help", icon: HelpCircle },
];

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile Hamburger Button */}
      <div className="lg:hidden fixed top-3 left-4 z-50">
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-2 rounded-xl glass-card border border-slate-700/80 text-slate-300 hover:text-white"
          aria-label="Toggle navigation menu"
        >
          {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-40 w-64 border-r border-slate-800/80 bg-[#070d1e]/95 backdrop-blur-xl flex flex-col justify-between transition-transform duration-300 ease-in-out",
          "lg:translate-x-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Top Branding */}
        <div>
          <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-800/80">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20 flex-shrink-0">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm tracking-tight text-white font-sans">
                  Secure-MaintAI
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 font-semibold border border-blue-500/30">
                  KKU
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">Resilience Platform</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-190px)]">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={cn(
                    "flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 group relative",
                    active
                      ? "bg-blue-600/15 text-blue-400 border border-blue-500/30 font-semibold shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  )}
                >
                  <div className="flex items-center gap-3 truncate">
                    <Icon
                      className={cn(
                        "w-4 h-4 transition-colors",
                        active ? "text-blue-400" : "text-slate-400 group-hover:text-slate-200"
                      )}
                    />
                    <span className="truncate">{item.name}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {item.badge && (
                      <span
                        className={cn(
                          "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full text-white",
                          item.badgeColor || "bg-blue-600"
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                    {active && <ChevronRight className="w-3.5 h-3.5 text-blue-400 opacity-80" />}
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom User Profile Card */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-900/40">
          <div className="p-2.5 rounded-xl border border-slate-800 bg-[#091124] flex items-center justify-between">
            <div className="flex items-center gap-2.5 truncate">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                {user?.full_name?.charAt(0) || "U"}
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold text-white truncate">
                  {user?.full_name || "Admin User"}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium border border-emerald-500/30">
                    {user?.role || "ADMIN"}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
