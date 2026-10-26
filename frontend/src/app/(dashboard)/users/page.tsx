"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Users,
  Search,
  ShieldCheck,
  CheckCircle,
  XCircle,
  Clock,
  Lock,
  Unlock,
} from "lucide-react";
import {
  getUsers,
  updateUser,
  getAuditLogs,
} from "@/lib/api";
import { UserRole, UserManagementItem } from "@/types";
import { DonutChart } from "@/components/charts/DonutChart";

const ROLE_DEPT_MAP: Record<UserRole, string> = {
  ADMIN: "Administration & SOC",
  RESEARCHER: "AI & Scientific Computing Lab",
  STUDENT: "Academic Computing",
};

function mapBackendUserToItem(u: any): UserManagementItem {
  const roleMap: Record<string, UserRole> = {
    ADMIN: "ADMIN",
    RESEARCHER: "RESEARCHER",
    STUDENT: "STUDENT",
  };
  const role: UserRole = roleMap[String(u.role || "").toUpperCase()] || "STUDENT";
  const rawStatus = String(u.status || "active").toLowerCase();
  const status: "ACTIVE" | "PENDING" | "SUSPENDED" =
    rawStatus === "active"
      ? "ACTIVE"
      : rawStatus === "inactive" || rawStatus === "pending"
        ? "PENDING"
        : "SUSPENDED";
  const lastLogin = u.last_login_at
    ? new Date(u.last_login_at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Never";

  return {
    id: String(u.id),
    full_name: u.full_name || u.username || u.email.split("@")[0],
    email: u.email,
    role,
    department: ROLE_DEPT_MAP[role] || "Academic Computing",
    status,
    last_login: lastLogin,
    two_factor_enabled: true,
  };
}

interface UserActivityItem {
  action: string;
  user: string;
  time: string;
}

export default function UsersManagementPage() {
  const [users, setUsers] = useState<UserManagementItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"ALL" | "ACTIVE" | "PENDING" | "SUSPENDED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [recentUserActivity, setRecentUserActivity] = useState<UserActivityItem[]>([]);

  const loadLiveUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getUsers({ page: 1, pageSize: 100 });
      if (res && Array.isArray(res.items)) {
        const liveItems = res.items.map(mapBackendUserToItem);
        setUsers(liveItems);

        try {
          const auditRes = await getAuditLogs({ page: 1, pageSize: 8 });
          if (auditRes && Array.isArray(auditRes.items) && auditRes.items.length > 0) {
            const userLookup = new Map(liveItems.map((u) => [u.id, u.full_name]));
            const mappedActivity: UserActivityItem[] = auditRes.items.slice(0, 5).map((item) => {
              const actorName = userLookup.get(item.actor) || item.actor;
              const ts = item.timestamp
                ? new Date(item.timestamp).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Recent";
              return {
                action: `${item.action} (${item.result})`,
                user: `${actorName} → ${item.resource}`,
                time: ts,
              };
            });
            setRecentUserActivity(mappedActivity);
          } else {
            setRecentUserActivity([]);
          }
        } catch {
          setRecentUserActivity([]);
        }
      } else {
        setUsers([]);
      }
    } catch {
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLiveUsers();
  }, [loadLiveUsers]);

  // Dynamic KPIs computed strictly from database users
  const kpiStats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.status === "ACTIVE").length;
    const pendingOrInactive = users.filter((u) => u.status === "PENDING").length;
    const suspended = users.filter((u) => u.status === "SUSPENDED").length;
    const activeRate = total > 0 ? ((active / total) * 100).toFixed(1) : "0.0";
    return { total, active, pendingOrInactive, suspended, activeRate };
  }, [users]);

  // Dynamic Role Breakdown computed strictly from database users
  const roleStats = useMemo(() => {
    const total = users.length;
    const counts = {
      STUDENT: users.filter((u) => u.role === "STUDENT").length,
      RESEARCHER: users.filter((u) => u.role === "RESEARCHER").length,
      ADMIN: users.filter((u) => u.role === "ADMIN").length,
    };
    const pct = (count: number) => (total > 0 ? ((count / total) * 100).toFixed(1) : "0.0");
    return {
      total,
      counts,
      percentages: {
        STUDENT: pct(counts.STUDENT),
        RESEARCHER: pct(counts.RESEARCHER),
        ADMIN: pct(counts.ADMIN),
      },
      donutData: [
        { label: "Students", value: counts.STUDENT, color: "#10b981" },
        { label: "Researchers", value: counts.RESEARCHER, color: "#f59e0b" },
        { label: "Administrators", value: counts.ADMIN, color: "#8b5cf6" },
      ],
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Tab filter
      if (activeTab === "ACTIVE" && u.status !== "ACTIVE") return false;
      if (activeTab === "PENDING" && u.status !== "PENDING") return false;
      if (activeTab === "SUSPENDED" && u.status !== "SUSPENDED") return false;

      // Role filter
      if (selectedRole !== "ALL" && u.role !== selectedRole) return false;

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          u.full_name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.department.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [users, activeTab, selectedRole, searchQuery]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, selectedRole, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage]);

  const handleToggleStatus = async (id: string) => {
    const targetUser = users.find((u) => u.id === id);
    if (!targetUser) return;
    const nextStatus: "ACTIVE" | "SUSPENDED" =
      targetUser.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    try {
      await updateUser(id, { status: nextStatus.toLowerCase() });
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, status: nextStatus } : u))
      );
      setFeedbackMsg(`User ${targetUser.full_name} status changed to ${nextStatus}`);
    } catch (err: any) {
      setFeedbackMsg(err?.message || `Failed to update status for ${targetUser.full_name}`);
    }
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case "ADMIN":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">ADMIN</span>;
      case "RESEARCHER":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">RESEARCHER</span>;
      case "STUDENT":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">STUDENT</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-700 text-slate-300">{role}</span>;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(/[\s._-]+/)
      .filter(Boolean)
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {feedbackMsg && (
        <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs flex items-center justify-between shadow-lg shadow-emerald-950/50 animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>{feedbackMsg}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-emerald-400 hover:text-emerald-200">
            ×
          </button>
        </div>
      )}

      {/* 4 Top KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Users</span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-400">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-1">{kpiStats.total}</p>
          <p className="text-[11px] text-emerald-400 mt-1 font-mono">Database accounts</p>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Active Users</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
              <CheckCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{kpiStats.active}</p>
          <p className="text-[11px] text-emerald-400 mt-1 font-mono">{kpiStats.activeRate}% active rate</p>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Pending / Inactive</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-400 mt-1">{kpiStats.pendingOrInactive}</p>
          <p className="text-[11px] text-amber-400 mt-1 font-mono">Inactive accounts</p>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Suspended Users</span>
            <div className="w-7 h-7 rounded-lg bg-rose-500/15 flex items-center justify-center text-rose-400">
              <XCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-1">{kpiStats.suspended}</p>
          <p className="text-[11px] text-emerald-400 mt-1 font-mono">{kpiStats.suspended} policy lockouts</p>
        </div>
      </div>

      {/* Main Content Layout: Users Table (8 cols) + Right Analytics Column (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Users Directory Table */}
        <div className="lg:col-span-8 space-y-4">
          <div className="glass-card p-5">
            {/* Table Header & Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-white">Users List</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                  {filteredUsers.length}
                </span>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-lg border border-slate-800 text-xs">
                {(["ALL", "ACTIVE", "PENDING", "SUSPENDED"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1 rounded font-medium transition-all ${activeTab === tab
                      ? "bg-brand-blue text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                      }`}
                  >
                    {tab === "ALL" ? "All Users" : tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter name, email, dept..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-blue"
                />
              </div>

              <div>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-brand-blue"
                >
                  <option value="ALL">All Roles</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="RESEARCHER">RESEARCHER</option>
                  <option value="STUDENT">STUDENT</option>
                </select>
              </div>

              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedRole("ALL");
                    setActiveTab("ALL");
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-400 text-xs font-medium transition-colors"
                >
                  Reset Filters
                </button>
              </div>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-left">
                    <th className="pb-3 font-medium">User</th>
                    <th className="pb-3 font-medium">Role</th>
                    <th className="pb-3 font-medium">Department</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Last Login</th>
                    <th className="pb-3 font-medium text-center">2FA</th>
                    <th className="pb-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Loading users from database...
                      </td>
                    </tr>
                  ) : paginatedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No users found in database matching current filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                              {getInitials(u.full_name)}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-200">{u.full_name}</p>
                              <p className="text-[11px] text-slate-400 font-mono">{u.email}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3">{getRoleBadge(u.role)}</td>

                        <td className="py-3 text-slate-300">{u.department}</td>

                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${u.status === "ACTIVE"
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                            : u.status === "PENDING"
                              ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                              : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                            }`}>
                            {u.status}
                          </span>
                        </td>

                        <td className="py-3 font-mono text-slate-400">{u.last_login}</td>

                        <td className="py-3 text-center">
                          {u.two_factor_enabled ? (
                            <ShieldCheck className="w-4 h-4 text-emerald-400 inline" />
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>

                        <td className="py-3 text-right">
                          <button
                            onClick={() => handleToggleStatus(u.id)}
                            title={u.status === "ACTIVE" ? "Suspend user" : "Reactivate user"}
                            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors inline-flex items-center gap-1"
                          >
                            {u.status === "ACTIVE" ? (
                              <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Lock className="w-3.5 h-3.5 text-rose-400" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs text-slate-400">
              <span>
                Showing {filteredUsers.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{" "}
                {Math.min(currentPage * pageSize, filteredUsers.length)} of {filteredUsers.length} users
              </span>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-2.5 py-1 rounded font-medium ${
                      currentPage === page
                        ? "bg-brand-blue text-white"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                    }`}
                  >
                    {page}
                  </button>
                ))}
                {totalPages > 1 && (
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40"
                  >
                    Next
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Analytics & Activity Feed */}
        <div className="lg:col-span-4 space-y-6">
          {/* Users by Role Donut */}
          <div className="glass-card p-5">
            <h3 className="text-base font-semibold text-white mb-1">Users by Role</h3>
            <p className="text-xs text-slate-400 mb-4">University IdP role breakdown</p>

            <div className="flex justify-center my-2">
              <DonutChart
                data={roleStats.donutData}
                size={170}
                strokeWidth={18}
                centerLabel={String(roleStats.total)}
                centerSub="Total Users"
              />
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> Students
                </span>
                <span className="font-mono text-slate-400">
                  {roleStats.percentages.STUDENT}% ({roleStats.counts.STUDENT})
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" /> Researchers
                </span>
                <span className="font-mono text-slate-400">
                  {roleStats.percentages.RESEARCHER}% ({roleStats.counts.RESEARCHER})
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-400" /> Administrators
                </span>
                <span className="font-mono text-slate-400">
                  {roleStats.percentages.ADMIN}% ({roleStats.counts.ADMIN})
                </span>
              </div>
            </div>
          </div>

          {/* Recent User Activity */}
          <div className="glass-card p-5">
            <h3 className="text-base font-semibold text-white mb-1">Recent User Activity</h3>
            <p className="text-xs text-slate-400 mb-4">Audit stream for user accounts</p>

            <div className="space-y-3">
              {recentUserActivity.length === 0 ? (
                <p className="text-xs text-slate-500">No recent audit events in database.</p>
              ) : (
                recentUserActivity.map((act, i) => (
                  <div key={i} className="flex items-start gap-3 text-xs">
                    <div className="w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Clock className="w-3 h-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-200 font-medium truncate">{act.action}</p>
                      <p className="text-[11px] text-slate-400 truncate">{act.user}</p>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0">{act.time}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

