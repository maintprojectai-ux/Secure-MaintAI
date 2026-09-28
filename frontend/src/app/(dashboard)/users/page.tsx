"use client";

import React, { useState, useMemo } from "react";
import {
  Users,
  UserPlus,
  Filter,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  MoreVertical,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  KeyRound,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Lock,
  Unlock,
  AlertCircle,
} from "lucide-react";
import { MOCK_USER_MANAGEMENT_LIST } from "@/lib/api";
import { UserRole, UserManagementItem } from "@/types";
import { DonutChart } from "@/components/charts/DonutChart";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/context/AuthContext";

export default function UsersManagementPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserManagementItem[]>(MOCK_USER_MANAGEMENT_LIST);
  const [activeTab, setActiveTab] = useState<"ALL" | "ACTIVE" | "PENDING" | "SUSPENDED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("ALL");
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // New user form state
  const [newUser, setNewUser] = useState({
    full_name: "",
    email: "",
    role: "STUDENT" as UserRole,
    department: "Computer Science",
    two_factor_enabled: true,
  });

  const roleDonutData = [
    { label: "Students", value: 65, color: "#10b981" },
    { label: "IT Operators", value: 28, color: "#3b82f6" },
    { label: "Researchers", value: 26, color: "#f59e0b" },
    { label: "Administrators", value: 18, color: "#8b5cf6" },
    { label: "Guests", value: 5, color: "#64748b" },
  ];

  const recentUserActivity = [
    { action: "User account created", user: "Fahad Al-Khatib", time: "10 mins ago", type: "create" },
    { action: "Password reset requested", user: "Alex Rivera", time: "1 hour ago", type: "security" },
    { action: "Role upgraded to IT_OPERATOR", user: "Yousef Salem", time: "3 hours ago", type: "role" },
    { action: "MFA Key Registered", user: "Dr. Tariq Al-Omari", time: "Yesterday", type: "mfa" },
    { action: "Successful IdP SSO Login", user: "Khalid Mansoor", time: "Yesterday", type: "login" },
  ];

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

  const handleToggleStatus = (id: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === id) {
          const nextStatus = u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
          setFeedbackMsg(`User ${u.full_name} status changed to ${nextStatus}`);
          setTimeout(() => setFeedbackMsg(null), 3000);
          return { ...u, status: nextStatus };
        }
        return u;
      })
    );
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.full_name || !newUser.email) return;

    const created: UserManagementItem = {
      id: `usr-${Date.now()}`,
      full_name: newUser.full_name,
      email: newUser.email,
      role: newUser.role,
      department: newUser.department,
      status: "ACTIVE",
      last_login: "Just now",
      two_factor_enabled: newUser.two_factor_enabled,
    };

    setUsers([created, ...users]);
    setIsAddUserOpen(false);
    setNewUser({
      full_name: "",
      email: "",
      role: "STUDENT",
      department: "Computer Science",
      two_factor_enabled: true,
    });
    setFeedbackMsg(`User ${created.full_name} created successfully!`);
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case "ADMIN":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">ADMIN</span>;
      case "IT_OPERATOR":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">IT_OPERATOR</span>;
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
      .split(" ")
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

      {/* 5 Top KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Users</span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-400">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-1">142</p>
          <p className="text-[11px] text-emerald-400 mt-1 font-mono">+12 this month</p>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Active Users</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
              <CheckCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-1">128</p>
          <p className="text-[11px] text-emerald-400 mt-1 font-mono">90.1% active rate</p>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">IT Operators</span>
            <div className="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center text-purple-400">
              <Shield className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-purple-400 mt-1">18</p>
          <p className="text-[11px] text-slate-400 mt-1 font-mono">24/7 coverage</p>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Pending Approval</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-400 mt-1">14</p>
          <p className="text-[11px] text-amber-400 mt-1 font-mono">Requires ID verify</p>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Suspended Users</span>
            <div className="w-7 h-7 rounded-lg bg-rose-500/15 flex items-center justify-center text-rose-400">
              <XCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-1">0</p>
          <p className="text-[11px] text-emerald-400 mt-1 font-mono">0 policy lockouts</p>
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
                  <option value="IT_OPERATOR">IT_OPERATOR</option>
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
                  {filteredUsers.map((u) => (
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
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs text-slate-400">
              <span>Showing 1 to {filteredUsers.length} of {filteredUsers.length} users</span>
              <div className="flex items-center gap-1">
                <button className="px-2.5 py-1 rounded bg-brand-blue text-white font-medium">1</button>
                <button className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300">2</button>
                <button className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300">3</button>
                <button className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300">Next</button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Analytics, Feed, Quick Actions */}
        <div className="lg:col-span-4 space-y-6">
          {/* Users by Role Donut */}
          <div className="glass-card p-5">
            <h3 className="text-base font-semibold text-white mb-1">Users by Role</h3>
            <p className="text-xs text-slate-400 mb-4">University IdP role breakdown</p>

            <div className="flex justify-center my-2">
              <DonutChart
                data={roleDonutData}
                size={170}
                strokeWidth={18}
                centerLabel="142"
                centerSub="Total Users"
              />
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> Students
                </span>
                <span className="font-mono text-slate-400">45.8% (65)</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400" /> IT Operators
                </span>
                <span className="font-mono text-slate-400">19.7% (28)</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" /> Researchers
                </span>
                <span className="font-mono text-slate-400">18.3% (26)</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-400" /> Administrators
                </span>
                <span className="font-mono text-slate-400">12.7% (18)</span>
              </div>
            </div>
          </div>

          {/* Recent User Activity */}
          <div className="glass-card p-5">
            <h3 className="text-base font-semibold text-white mb-1">Recent User Activity</h3>
            <p className="text-xs text-slate-400 mb-4">Audit stream for user accounts</p>

            <div className="space-y-3">
              {recentUserActivity.map((act, i) => (
                <div key={i} className="flex items-start gap-3 text-xs">
                  <div className="w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Clock className="w-3 h-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-200 font-medium truncate">{act.action}</p>
                    <p className="text-[11px] text-slate-400">{act.user}</p>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono shrink-0">{act.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="glass-card p-5">
            <h3 className="text-base font-semibold text-white mb-3">Directory Quick Actions</h3>

            <div className="space-y-2 text-xs">
              <button
                onClick={() => setIsAddUserOpen(true)}
                className="w-full flex items-center justify-between p-2.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-200 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <UserPlus className="w-4 h-4 text-brand-blue" />
                  <span>Add Single User</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
              </button>

              <button
                onClick={() => {
                  setFeedbackMsg("LDAP / IdP sync initiated. 142 records refreshed.");
                  setTimeout(() => setFeedbackMsg(null), 3000);
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-200 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <RefreshCw className="w-4 h-4 text-brand-cyan" />
                  <span>Trigger LDAP / IdP Sync</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
              </button>

              <button
                onClick={() => {
                  setFeedbackMsg("Audit log export started.");
                  setTimeout(() => setFeedbackMsg(null), 2500);
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-200 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Download className="w-4 h-4 text-brand-purple" />
                  <span>Export User Directory CSV</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      <Modal
        isOpen={isAddUserOpen}
        onClose={() => setIsAddUserOpen(false)}
        title="Add New User Account"
      >
        <form onSubmit={handleAddUser} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1">Full Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Dr. Mohammed Al-Qahtani"
              value={newUser.full_name}
              onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-brand-blue"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">University Email</label>
            <input
              type="email"
              required
              placeholder="e.g. m.qahtani@university.edu"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-brand-blue"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Role</label>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-brand-blue"
              >
                <option value="STUDENT">STUDENT</option>
                <option value="RESEARCHER">RESEARCHER</option>
                <option value="IT_OPERATOR">IT_OPERATOR</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Department</label>
              <select
                value={newUser.department}
                onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-brand-blue"
              >
                <option value="Computer Science">Computer Science</option>
                <option value="Artificial Intelligence Lab">AI Lab</option>
                <option value="Administration">Administration</option>
                <option value="Medical Sciences">Medical Sciences</option>
                <option value="Mechanical Engineering">Mechanical Engineering</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="two_factor_check"
              checked={newUser.two_factor_enabled}
              onChange={(e) => setNewUser({ ...newUser, two_factor_enabled: e.target.checked })}
              className="rounded bg-slate-950 border-slate-800 text-brand-blue focus:ring-0"
            />
            <label htmlFor="two_factor_check" className="text-slate-300 select-none">
              Enforce Multi-Factor Authentication (MFA) on first login
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddUserOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-brand-blue text-white font-semibold hover:bg-blue-600 transition-colors"
            >
              Create Account
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
