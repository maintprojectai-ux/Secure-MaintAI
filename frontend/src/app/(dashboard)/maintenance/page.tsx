"use client";

import React, { useState, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Search,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Eye,
  Edit3,
  MoreVertical,
  Server,
  Shield,
  Database,
  Network,
  HardDrive,
  Cpu,
  Layers,
  X,
  Check,
  Zap,
  Sparkles,
  SlidersHorizontal,
} from "lucide-react";
import {
  ScheduledTaskItem,
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceStatus,
} from "@/types";
import {
  MOCK_MAINTENANCE_KPIS,
  MOCK_UPCOMING_TASKS,
  MOCK_ALL_MAINTENANCE_SCHEDULE,
} from "@/lib/api";

// Category badge visual helper
const getCategoryBadge = (category: MaintenanceCategory) => {
  switch (category) {
    case "Database":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/15 text-purple-300 border border-purple-500/30">
          <Database className="w-3 h-3 text-purple-400" />
          {category}
        </span>
      );
    case "Security":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/15 text-rose-300 border border-rose-500/30">
          <Shield className="w-3 h-3 text-rose-400" />
          {category}
        </span>
      );
    case "Network":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
          <Network className="w-3 h-3 text-cyan-400" />
          {category}
        </span>
      );
    case "Backup":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
          <HardDrive className="w-3 h-3 text-amber-400" />
          {category}
        </span>
      );
    case "Virtualization":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
          <Layers className="w-3 h-3 text-indigo-400" />
          {category}
        </span>
      );
    case "Application":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          <Zap className="w-3 h-3 text-emerald-400" />
          {category}
        </span>
      );
    case "System":
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30">
          <Cpu className="w-3 h-3 text-blue-400" />
          {category}
        </span>
      );
  }
};

// Priority badge visual helper
const getPriorityBadge = (priority: MaintenancePriority) => {
  switch (priority) {
    case "High":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
          High
        </span>
      );
    case "Medium":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
          Medium
        </span>
      );
    case "Low":
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
          Low
        </span>
      );
  }
};

// Status badge visual helper
const getStatusBadge = (status: MaintenanceStatus) => {
  switch (status) {
    case "Completed":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          Completed
        </span>
      );
    case "In Progress":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
          In Progress
        </span>
      );
    case "Overdue":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/15 text-rose-300 border border-rose-500/30">
          Overdue
        </span>
      );
    case "Upcoming":
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30">
          Upcoming
        </span>
      );
  }
};

export default function MaintenanceSchedulePage() {
  // Master state
  const [allTasks, setAllTasks] = useState<ScheduledTaskItem[]>(MOCK_ALL_MAINTENANCE_SCHEDULE);
  const [kpis, setKpis] = useState(MOCK_MAINTENANCE_KPIS);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Global search & filters toggle
  const [globalSearch, setGlobalSearch] = useState("");
  const [showFiltersBar, setShowFiltersBar] = useState(false);

  // Middle section tab: "Upcoming Maintenance" | "In Progress" | "Overdue" | "Completed"
  const [middleTab, setMiddleTab] = useState<MaintenanceStatus>("Upcoming");
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);

  // Calendar state (Default to current date: September 2026)
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(8); // 0-indexed, 8 = September
  const [selectedDay, setSelectedDay] = useState<number | null>(16); // Today: Sep 16, 2026

  // Bottom table filters & search
  const [tableSearch, setTableSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All Categories");
  const [selectedPriority, setSelectedPriority] = useState<string>("All Priorities");
  const [selectedStatus, setSelectedStatus] = useState<string>("All Statuses");
  const [sortAscending, setSortAscending] = useState(true);

  // Bottom table pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [inspectTask, setInspectTask] = useState<ScheduledTaskItem | null>(null);
  const [editTask, setEditTask] = useState<ScheduledTaskItem | null>(null);

  // Schedule Modal Form
  const [formSystem, setFormSystem] = useState("DB-Server-01");
  const [formTaskName, setFormTaskName] = useState("");
  const [formCategory, setFormCategory] = useState<MaintenanceCategory>("Database");
  const [formDateTime, setFormDateTime] = useState("Sep 20, 2026 03:00 AM");
  const [formDuration, setFormDuration] = useState("1h 30m");
  const [formPriority, setFormPriority] = useState<MaintenancePriority>("High");
  const [formCreator, setFormCreator] = useState("Admin");
  const [formPlaybook, setFormPlaybook] = useState(true);

  // Edit Modal Form
  const [editDateTime, setEditDateTime] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editPriority, setEditPriority] = useState<MaintenancePriority>("Medium");
  const [editStatus, setEditStatus] = useState<MaintenanceStatus>("Upcoming");

  // Middle Upcoming List filtered by middleTab and search
  const middleUpcomingFiltered = useMemo(() => {
    return allTasks.filter((task) => {
      const matchesTab = task.status === middleTab;
      const matchesSearch =
        !globalSearch ||
        task.task_name.toLowerCase().includes(globalSearch.toLowerCase()) ||
        task.target_system.toLowerCase().includes(globalSearch.toLowerCase()) ||
        task.category.toLowerCase().includes(globalSearch.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [allTasks, middleTab, globalSearch]);

  // Bottom table filtered & sorted
  const bottomTableFiltered = useMemo(() => {
    let result = allTasks.filter((task) => {
      const matchesSearch =
        !tableSearch ||
        task.task_name.toLowerCase().includes(tableSearch.toLowerCase()) ||
        task.target_system.toLowerCase().includes(tableSearch.toLowerCase()) ||
        task.category.toLowerCase().includes(tableSearch.toLowerCase()) ||
        (task.created_by && task.created_by.toLowerCase().includes(tableSearch.toLowerCase()));

      const matchesCat =
        selectedCategory === "All Categories" || task.category === selectedCategory;
      const matchesPrio =
        selectedPriority === "All Priorities" || task.priority === selectedPriority;
      const matchesStat =
        selectedStatus === "All Statuses" || task.status === selectedStatus;

      return matchesSearch && matchesCat && matchesPrio && matchesStat;
    });

    // Sort by scheduled_date_time string
    result.sort((a, b) => {
      return sortAscending
        ? a.scheduled_date_time.localeCompare(b.scheduled_date_time)
        : b.scheduled_date_time.localeCompare(a.scheduled_date_time);
    });

    return result;
  }, [allTasks, tableSearch, selectedCategory, selectedPriority, selectedStatus, sortAscending]);

  // Pagination calculation
  const totalItems = bottomTableFiltered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return bottomTableFiltered.slice(start, start + pageSize);
  }, [bottomTableFiltered, currentPage, pageSize]);

  // Actions
  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newTask: ScheduledTaskItem = {
      id: `sch-${Date.now().toString().slice(-4)}`,
      task_name: formTaskName.trim() || "Automated Infrastructure Maintenance",
      category: formCategory,
      target_system: formSystem,
      scheduled_date_time: formDateTime,
      duration: formDuration,
      priority: formPriority,
      status: "Upcoming",
      created_by: formCreator,
      description: formPlaybook
        ? "SOAR automated pre-maintenance health check & isolation snapshot verified."
        : "Standard manual maintenance schedule window.",
    };

    setAllTasks((prev) => [newTask, ...prev]);
    setKpis((prev) => ({
      ...prev,
      total_scheduled: prev.total_scheduled + 1,
      upcoming: prev.upcoming + 1,
    }));
    setShowScheduleModal(false);
    setFormTaskName("");
    setFeedbackMsg(`Successfully scheduled "${newTask.task_name}" for ${newTask.target_system}.`);
    setTimeout(() => setFeedbackMsg(null), 4500);
  };

  const handleUpdateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTask) return;
    setAllTasks((prev) =>
      prev.map((t) =>
        t.id === editTask.id
          ? {
            ...t,
            scheduled_date_time: editDateTime,
            duration: editDuration,
            priority: editPriority,
            status: editStatus,
          }
          : t
      )
    );
    setEditTask(null);
    setFeedbackMsg(`Task "${editTask.task_name}" updated successfully.`);
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleQuickStatusChange = (taskId: string, newStatus: MaintenanceStatus) => {
    setAllTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );
    setActiveActionMenuId(null);
    setFeedbackMsg(`Task marked as ${newStatus}.`);
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const handleOpenEdit = (task: ScheduledTaskItem) => {
    setEditTask(task);
    setEditDateTime(task.scheduled_date_time);
    setEditDuration(task.duration);
    setEditPriority(task.priority);
    setEditStatus(task.status);
    setActiveActionMenuId(null);
  };

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      "Task ID",
      "Task Name",
      "Category",
      "Target System",
      "Scheduled Date & Time",
      "Duration",
      "Priority",
      "Status",
      "Created By",
    ];

    const rows = bottomTableFiltered.map((t) => [
      t.id,
      `"${t.task_name.replace(/"/g, '""')}"`,
      t.category,
      t.target_system,
      `"${t.scheduled_date_time}"`,
      t.duration,
      t.priority,
      t.status,
      t.created_by || "System",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `maintenance-schedule-export-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setFeedbackMsg("Maintenance schedule exported as CSV successfully.");
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  // Month data calculation (Current: September 2026)
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Days with active maintenance events in September 2026
  const septemberTaskEvents: Record<number, { count: number; statuses: MaintenanceStatus[] }> = {
    5: { count: 1, statuses: ["Completed"] },
    7: { count: 1, statuses: ["Overdue"] },
    8: { count: 1, statuses: ["Completed"] },
    10: { count: 2, statuses: ["Overdue", "Completed"] },
    12: { count: 1, statuses: ["Completed"] },
    15: { count: 1, statuses: ["In Progress"] },
    16: { count: 2, statuses: ["In Progress"] },
    18: { count: 2, statuses: ["Upcoming"] },
    20: { count: 2, statuses: ["Upcoming"] },
    22: { count: 1, statuses: ["Upcoming"] },
    25: { count: 1, statuses: ["Upcoming"] },
    28: { count: 1, statuses: ["Upcoming"] },
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback Notification */}
      {feedbackMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs flex items-center justify-between shadow-lg shadow-emerald-950/40 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="text-emerald-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sub-Toolbar: Search, Filters toggle, and + Schedule Maintenance */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Left Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            placeholder="Search maintenance tasks..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-900/80 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/60 transition-colors"
          />
          {globalSearch && (
            <button
              onClick={() => setGlobalSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Right Actions: Filters toggle + Primary CTA */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowFiltersBar(!showFiltersBar)}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 border transition-all ${showFiltersBar
              ? "bg-blue-600/20 text-blue-300 border-blue-500/40"
              : "bg-slate-900/80 text-slate-300 border-slate-800 hover:bg-slate-800/80 hover:text-white"
              }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters</span>
          </button>

          <button
            onClick={() => setShowScheduleModal(true)}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 transition-colors shadow-lg shadow-blue-600/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Maintenance</span>
          </button>
        </div>
      </div>

      {/* Expandable Quick Filter Toolbar */}
      {showFiltersBar && (
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 flex flex-wrap items-center gap-3 animate-fade-in text-xs">
          <span className="text-slate-400 font-medium">Quick Filter:</span>
          <button
            onClick={() => {
              setSelectedStatus("All Statuses");
              setSelectedCategory("All Categories");
              setSelectedPriority("All Priorities");
              setGlobalSearch("");
              setTableSearch("");
            }}
            className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            Reset All
          </button>
          <button
            onClick={() => {
              setSelectedStatus("Upcoming");
              setMiddleTab("Upcoming");
            }}
            className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/30 hover:bg-blue-500/20"
          >
            Only Upcoming
          </button>
          <button
            onClick={() => {
              setSelectedStatus("In Progress");
              setMiddleTab("In Progress");
            }}
            className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20"
          >
            Only In Progress
          </button>
          <button
            onClick={() => {
              setSelectedStatus("Overdue");
              setMiddleTab("Overdue");
            }}
            className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20"
          >
            Only Overdue
          </button>
          <button
            onClick={() => {
              setSelectedCategory("Security");
            }}
            className="px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/30 hover:bg-purple-500/20"
          >
            Security Patches
          </button>
        </div>
      )}

      {/* Top 5 KPI Summary Cards matching Maintenance Schedule.jpeg */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Total Scheduled */}
        <div
          onClick={() => {
            setSelectedStatus("All Statuses");
            setMiddleTab("Upcoming");
          }}
          className="glass-card p-4 rounded-2xl border border-slate-800 hover:border-blue-500/40 cursor-pointer transition-all hover:bg-slate-800/40 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium group-hover:text-slate-200 transition-colors">
              Total Scheduled
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <CalendarIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white tracking-tight">
              {kpis.total_scheduled}
            </span>
            <span className="text-[11px] font-medium text-emerald-400">
              {kpis.total_scheduled_change}
            </span>
          </div>
        </div>

        {/* Card 2: Completed */}
        <div
          onClick={() => {
            setSelectedStatus("Completed");
            setMiddleTab("Completed");
          }}
          className="glass-card p-4 rounded-2xl border border-slate-800 hover:border-emerald-500/40 cursor-pointer transition-all hover:bg-slate-800/40 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium group-hover:text-slate-200 transition-colors">
              Completed
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white tracking-tight">
              {kpis.completed}
            </span>
            <span className="text-[11px] font-medium text-emerald-400">
              {kpis.completed_change}
            </span>
          </div>
        </div>

        {/* Card 3: In Progress */}
        <div
          onClick={() => {
            setSelectedStatus("In Progress");
            setMiddleTab("In Progress");
          }}
          className="glass-card p-4 rounded-2xl border border-slate-800 hover:border-amber-500/40 cursor-pointer transition-all hover:bg-slate-800/40 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium group-hover:text-slate-200 transition-colors">
              In Progress
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white tracking-tight">
              {kpis.in_progress}
            </span>
            <span className="text-[11px] font-medium text-slate-400">
              {kpis.in_progress_change}
            </span>
          </div>
        </div>

        {/* Card 4: Upcoming */}
        <div
          onClick={() => {
            setSelectedStatus("Upcoming");
            setMiddleTab("Upcoming");
          }}
          className="glass-card p-4 rounded-2xl border border-slate-800 hover:border-purple-500/40 cursor-pointer transition-all hover:bg-slate-800/40 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium group-hover:text-slate-200 transition-colors">
              Upcoming
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white tracking-tight">
              {kpis.upcoming}
            </span>
            <span className="text-[11px] font-medium text-emerald-400">
              {kpis.upcoming_change}
            </span>
          </div>
        </div>

        {/* Card 5: Overdue */}
        <div
          onClick={() => {
            setSelectedStatus("Overdue");
            setMiddleTab("Overdue");
          }}
          className="glass-card p-4 rounded-2xl border border-slate-800 hover:border-rose-500/40 cursor-pointer transition-all hover:bg-slate-800/40 group col-span-2 sm:col-span-1"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium group-hover:text-slate-200 transition-colors">
              Overdue
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white tracking-tight">
              {kpis.overdue}
            </span>
            <span className="text-[11px] font-medium text-rose-400">
              {kpis.overdue_change}
            </span>
          </div>
        </div>
      </div>

      {/* Middle Section: 12 Cols (8 cols left: Upcoming Maintenance List, 4 cols right: Calendar Card) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 8 Cols: Upcoming Maintenance List */}
        <div className="lg:col-span-8 glass-card rounded-2xl border border-slate-800 flex flex-col justify-between overflow-hidden">
          <div>
            {/* 4 Tabs Header */}
            <div className="flex items-center border-b border-slate-800 px-4 pt-3 overflow-x-auto gap-6 scrollbar-none">
              {(["Upcoming", "In Progress", "Overdue", "Completed"] as MaintenanceStatus[]).map(
                (tab) => {
                  const label =
                    tab === "Upcoming" ? "Upcoming Maintenance" : tab;
                  const isActive = middleTab === tab;
                  const count = allTasks.filter((t) => t.status === tab).length;

                  return (
                    <button
                      key={tab}
                      onClick={() => setMiddleTab(tab)}
                      className={`pb-3 text-xs font-semibold tracking-wide whitespace-nowrap transition-all relative flex items-center gap-2 cursor-pointer ${isActive
                        ? "text-blue-400 border-b-2 border-blue-500"
                        : "text-slate-400 hover:text-slate-200"
                        }`}
                    >
                      <span>{label}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive
                          ? "bg-blue-500/20 text-blue-300 font-bold"
                          : "bg-slate-800 text-slate-400"
                          }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                }
              )}
            </div>

            {/* Middle Tasks Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800/80 bg-slate-900/30">
                    <th className="py-3 px-4 font-semibold">Task Name</th>
                    <th className="py-3 px-3 font-semibold">Category</th>
                    <th className="py-3 px-3 font-semibold">Target System</th>
                    <th className="py-3 px-3 font-semibold">Scheduled Date & Time</th>
                    <th className="py-3 px-3 font-semibold">Duration</th>
                    <th className="py-3 px-3 font-semibold">Priority</th>
                    <th className="py-3 px-3 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {middleUpcomingFiltered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        No maintenance tasks found for status &quot;{middleTab}&quot;.
                      </td>
                    </tr>
                  ) : (
                    middleUpcomingFiltered.map((task) => (
                      <tr
                        key={task.id}
                        className="hover:bg-slate-800/40 transition-colors group"
                      >
                        <td className="py-3 px-4">
                          <span className="font-semibold text-white group-hover:text-blue-300 transition-colors">
                            {task.task_name}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {getCategoryBadge(task.category)}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap font-mono text-slate-300">
                          {task.target_system}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-slate-300 font-sans">
                          {task.scheduled_date_time}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-slate-400">
                          {task.duration}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {getPriorityBadge(task.priority)}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {getStatusBadge(task.status)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-right relative">
                          <button
                            onClick={() =>
                              setActiveActionMenuId(
                                activeActionMenuId === task.id ? null : task.id
                              )
                            }
                            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {/* Context dropdown menu */}
                          {activeActionMenuId === task.id && (
                            <div className="absolute right-4 top-10 w-44 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30 py-1 text-xs text-left animate-fade-in">
                              <button
                                onClick={() => {
                                  setInspectTask(task);
                                  setActiveActionMenuId(null);
                                }}
                                className="w-full px-3 py-1.5 flex items-center gap-2 text-slate-300 hover:bg-slate-800 hover:text-white"
                              >
                                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                                <span>View Details</span>
                              </button>
                              <button
                                onClick={() => handleOpenEdit(task)}
                                className="w-full px-3 py-1.5 flex items-center gap-2 text-slate-300 hover:bg-slate-800 hover:text-white"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                                <span>Edit Task</span>
                              </button>
                              <div className="my-1 border-t border-slate-800" />
                              {task.status !== "In Progress" && (
                                <button
                                  onClick={() =>
                                    handleQuickStatusChange(task.id, "In Progress")
                                  }
                                  className="w-full px-3 py-1.5 flex items-center gap-2 text-amber-300 hover:bg-amber-950/40"
                                >
                                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                                  <span>Mark In Progress</span>
                                </button>
                              )}
                              {task.status !== "Completed" && (
                                <button
                                  onClick={() =>
                                    handleQuickStatusChange(task.id, "Completed")
                                  }
                                  className="w-full px-3 py-1.5 flex items-center gap-2 text-emerald-300 hover:bg-emerald-950/40"
                                >
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Mark Completed</span>
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer Link */}
          <div className="p-3 border-t border-slate-800/80 bg-slate-900/40 text-center">
            <button
              onClick={() => {
                setSelectedStatus("Upcoming");
                const target = document.getElementById("master-schedule-list");
                if (target) target.scrollIntoView({ behavior: "smooth" });
              }}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-1 cursor-pointer"
            >
              <span>View all upcoming tasks</span>
              <span>→</span>
            </button>
          </div>
        </div>

        {/* Right 4 Cols: Interactive Calendar Card (September 2026) */}
        <div className="lg:col-span-4 glass-card p-5 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div>
            {/* Header: Month & Navigation Controls */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-sm font-bold text-white tracking-wide">
                {monthNames[currentMonthIndex]} {currentYear}
              </span>
              <div className="flex items-center gap-1 text-slate-400">
                <button
                  onClick={() => {
                    if (currentMonthIndex === 0) {
                      setCurrentMonthIndex(11);
                      setCurrentYear(currentYear - 1);
                    } else {
                      setCurrentMonthIndex(currentMonthIndex - 1);
                    }
                  }}
                  className="p-1 rounded hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    if (currentMonthIndex === 11) {
                      setCurrentMonthIndex(0);
                      setCurrentYear(currentYear + 1);
                    } else {
                      setCurrentMonthIndex(currentMonthIndex + 1);
                    }
                  }}
                  className="p-1 rounded hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setCurrentMonthIndex(8);
                    setCurrentYear(2026);
                    setSelectedDay(16);
                  }}
                  className="ml-1 px-2 py-0.5 text-[11px] font-semibold text-blue-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                >
                  Today &gt;
                </button>
              </div>
            </div>

            {/* Calendar Days of Week Header */}
            <div className="grid grid-cols-7 gap-1 text-center font-mono text-[11px] text-slate-400 py-2.5 font-semibold">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            {/* Days Grid: Dynamic computation for current month and year */}
            {(() => {
              const daysInMonth = new Date(currentYear, currentMonthIndex + 1, 0).getDate();
              const firstDayOfWeek = new Date(currentYear, currentMonthIndex, 1).getDay(); // 0 = Sun
              const daysInPrevMonth = new Date(currentYear, currentMonthIndex, 0).getDate();
              const prevDays = Array.from(
                { length: firstDayOfWeek },
                (_, i) => daysInPrevMonth - firstDayOfWeek + 1 + i
              );
              const currentMonthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
              const totalGridCells = prevDays.length + currentMonthDays.length;
              const nextDaysCount = (7 - (totalGridCells % 7)) % 7;
              const nextDays = Array.from({ length: nextDaysCount }, (_, i) => i + 1);

              const isCurrentSeptember2026 = currentYear === 2026 && currentMonthIndex === 8;

              return (
                <div className="grid grid-cols-7 gap-1 text-center text-xs">
                  {/* Offset days from previous month */}
                  {prevDays.map((d) => (
                    <div
                      key={`prev-${d}`}
                      className="h-8 flex items-center justify-center text-slate-600 cursor-default"
                    >
                      {d}
                    </div>
                  ))}

                  {/* Current month days */}
                  {currentMonthDays.map((day) => {
                    const isSelected = selectedDay === day;
                    const eventInfo = isCurrentSeptember2026 ? septemberTaskEvents[day] : undefined;

                    let dotColorClass = "";
                    if (eventInfo) {
                      if (eventInfo.statuses.includes("Overdue")) dotColorClass = "bg-rose-400";
                      else if (eventInfo.statuses.includes("In Progress")) dotColorClass = "bg-amber-400";
                      else if (eventInfo.statuses.includes("Upcoming")) dotColorClass = "bg-blue-400";
                      else if (eventInfo.statuses.includes("Completed")) dotColorClass = "bg-emerald-400";
                    }

                    return (
                      <div
                        key={`day-${day}`}
                        onClick={() => {
                          setSelectedDay(day);
                          setFeedbackMsg(
                            `${monthNames[currentMonthIndex]} ${day}, ${currentYear}: Filtered to tasks on this date.`
                          );
                        }}
                        className={`h-8 rounded-lg cursor-pointer transition-all relative flex flex-col items-center justify-center text-xs font-medium ${isSelected
                          ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30"
                          : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                          }`}
                      >
                        <span>{day}</span>
                        {eventInfo && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full absolute bottom-0.5 ${dotColorClass}`}
                          />
                        )}
                      </div>
                    );
                  })}

                  {/* Offset days from next month */}
                  {nextDays.map((d) => (
                    <div
                      key={`next-${d}`}
                      className="h-8 flex items-center justify-center text-slate-600 cursor-default"
                    >
                      {d}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Bottom Status Legend matching mockup */}
          <div className="pt-4 border-t border-slate-800/80 mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span>Upcoming</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>In Progress</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Completed</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              <span>Overdue</span>
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Section: Maintenance Schedule List (Master Table) */}
      <div
        id="master-schedule-list"
        className="glass-card p-5 rounded-2xl border border-slate-800 space-y-4"
      >
        {/* Table Header and Master Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              Maintenance Schedule List
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Comprehensive schedule of all planned and executed infrastructure maintenance
            </p>
          </div>

          {/* Filter Dropdowns + Search + Export */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search tasks... */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => {
                  setTableSearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search tasks..."
                className="pl-8.5 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-700/80 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/60"
              />
            </div>

            {/* Category Filter */}
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setCurrentPage(1);
                }}
                className="appearance-none pl-3 pr-8 py-1.5 text-xs bg-slate-900 border border-slate-700/80 rounded-xl text-slate-300 focus:outline-none focus:border-blue-500/60"
              >
                <option value="All Categories">All Categories</option>
                <option value="Database">Database</option>
                <option value="Security">Security</option>
                <option value="Network">Network</option>
                <option value="Backup">Backup</option>
                <option value="System">System</option>
                <option value="Application">Application</option>
                <option value="Virtualization">Virtualization</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Priority Filter */}
            <div className="relative">
              <select
                value={selectedPriority}
                onChange={(e) => {
                  setSelectedPriority(e.target.value);
                  setCurrentPage(1);
                }}
                className="appearance-none pl-3 pr-8 py-1.5 text-xs bg-slate-900 border border-slate-700/80 rounded-xl text-slate-300 focus:outline-none focus:border-blue-500/60"
              >
                <option value="All Priorities">All Priorities</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="appearance-none pl-3 pr-8 py-1.5 text-xs bg-slate-900 border border-slate-700/80 rounded-xl text-slate-300 focus:outline-none focus:border-blue-500/60"
              >
                <option value="All Statuses">All Statuses</option>
                <option value="Upcoming">Upcoming</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Overdue">Overdue</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Export CSV Button */}
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* 9-Column Master Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800/80">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800 bg-slate-900/60">
                <th className="py-3 px-4 font-semibold">Task Name</th>
                <th className="py-3 px-3 font-semibold">Category</th>
                <th className="py-3 px-3 font-semibold">Target System</th>
                <th
                  onClick={() => setSortAscending(!sortAscending)}
                  className="py-3 px-3 font-semibold cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Scheduled Date & Time</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform ${sortAscending ? "" : "rotate-180"
                        }`}
                    />
                  </div>
                </th>
                <th className="py-3 px-3 font-semibold">Duration</th>
                <th className="py-3 px-3 font-semibold">Priority</th>
                <th className="py-3 px-3 font-semibold">Status</th>
                <th className="py-3 px-3 font-semibold">Created By</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {paginatedTasks.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No maintenance records match your search or active filters.
                  </td>
                </tr>
              ) : (
                paginatedTasks.map((task) => (
                  <tr
                    key={task.id}
                    className="hover:bg-slate-800/35 transition-colors group"
                  >
                    <td className="py-3 px-4 font-semibold text-white group-hover:text-blue-300 transition-colors">
                      {task.task_name}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getCategoryBadge(task.category)}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap font-mono text-slate-300">
                      {task.target_system}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-slate-300">
                      {task.scheduled_date_time}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-slate-400">
                      {task.duration}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getPriorityBadge(task.priority)}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getStatusBadge(task.status)}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-slate-400">
                      {task.created_by || "System"}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          title="View Details"
                          onClick={() => setInspectTask(task)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          title="Edit Task"
                          onClick={() => handleOpenEdit(task)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Master Table Pagination Footer */}
        <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div>
            Showing{" "}
            <span className="font-semibold text-white">
              {totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-white">
              {Math.min(currentPage * pageSize, totalItems)}
            </span>{" "}
            of <span className="font-semibold text-white">{totalItems}</span> tasks
          </div>

          <div className="flex items-center gap-3">
            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 text-slate-300 focus:outline-none"
              >
                <option value={5}>5 / page</option>
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
              </select>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-700/80 disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-800 text-slate-300"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors ${currentPage === page
                    ? "bg-blue-600 text-white"
                    : "border border-slate-700/80 text-slate-400 hover:bg-slate-800 hover:text-white"
                    }`}
                >
                  {page}
                </button>
              ))}

              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-700/80 disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-800 text-slate-300"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Maintenance Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700/90 rounded-2xl w-full max-w-xl p-6 space-y-4 shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Schedule Maintenance Window
                  </h3>
                  <p className="text-xs text-slate-400">
                    Dispatch an orchestrated maintenance playbook to university infrastructure
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Target Workstation / Server
                </label>
                <select
                  value={formSystem}
                  onChange={(e) => setFormSystem(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                >
                  <option value="DB-Server-01">DB-Server-01 (Database Cluster Primary)</option>
                  <option value="Web-Server-02">Web-Server-02 (University Web Portal)</option>
                  <option value="Core-Switch-01">Core-Switch-01 (Campus Backbone)</option>
                  <option value="Backup-Server-01">Backup-Server-01 (LTO Tape Vault)</option>
                  <option value="App-Server-01">App-Server-01 (LMS & Grading System)</option>
                  <option value="Firewall-01">Firewall-01 (Perimeter Security Appliance)</option>
                  <option value="VM-Host-01">VM-Host-01 (ESXi Hypervisor Node)</option>
                  <option value="HPC-RESEARCH-NODE-04">HPC-RESEARCH-NODE-04 (GPU Cluster)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Maintenance Task Name
                </label>
                <input
                  type="text"
                  required
                  value={formTaskName}
                  onChange={(e) => setFormTaskName(e.target.value)}
                  placeholder="e.g. Kernel Security Patch & Database Vacuum"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as MaintenanceCategory)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Database">Database</option>
                    <option value="Security">Security</option>
                    <option value="Network">Network</option>
                    <option value="Backup">Backup</option>
                    <option value="System">System</option>
                    <option value="Application">Application</option>
                    <option value="Virtualization">Virtualization</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Priority Level
                  </label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as MaintenancePriority)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="High">High Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="Low">Low Priority</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Scheduled Date & Time
                  </label>
                  <input
                    type="text"
                    value={formDateTime}
                    onChange={(e) => setFormDateTime(e.target.value)}
                    placeholder="e.g. Sep 20, 2026 03:00 AM"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Estimated Duration
                  </label>
                  <select
                    value={formDuration}
                    onChange={(e) => setFormDuration(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="30m">30 Minutes</option>
                    <option value="45m">45 Minutes</option>
                    <option value="1h">1 Hour</option>
                    <option value="1h 30m">1 Hour 30 Minutes</option>
                    <option value="2h">2 Hours</option>
                    <option value="3h">3 Hours</option>
                    <option value="4h">4 Hours</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Responsible Admin / Team
                </label>
                <input
                  type="text"
                  value={formCreator}
                  onChange={(e) => setFormCreator(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* SOAR Automation Checkbox */}
              <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-500/30 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="soar-playbook"
                  checked={formPlaybook}
                  onChange={(e) => setFormPlaybook(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <label htmlFor="soar-playbook" className="cursor-pointer">
                  <span className="font-semibold text-blue-300 block">
                    Execute SOAR Automated Pre-Flight Health Check
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Ensures VM snapshot is captured, IdP active research sessions are preserved, and automatic rollback triggers are armed.
                  </span>
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-600/25 transition-colors"
                >
                  Confirm & Schedule Window
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Details Inspection Modal */}
      {inspectTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700/90 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Task Details & SOAR Telemetry
                  </h3>
                  <p className="text-xs font-mono text-slate-400">ID: {inspectTask.id}</p>
                </div>
              </div>
              <button
                onClick={() => setInspectTask(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Task Name</span>
                <span className="text-sm font-bold text-white">{inspectTask.task_name}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 block mb-0.5">Category</span>
                  {getCategoryBadge(inspectTask.category)}
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Target System</span>
                  <span className="font-mono text-cyan-300 font-semibold">
                    {inspectTask.target_system}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Scheduled Time</span>
                  <span className="text-slate-200">{inspectTask.scheduled_date_time}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Estimated Duration</span>
                  <span className="text-slate-200">{inspectTask.duration}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Priority</span>
                  {getPriorityBadge(inspectTask.priority)}
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Current Status</span>
                  {getStatusBadge(inspectTask.status)}
                </div>
              </div>

              {inspectTask.description && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                    Playbook Execution Context
                  </span>
                  {inspectTask.description}
                </div>
              )}

              {/* Pre-maintenance checklist */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <span className="text-[11px] font-semibold text-slate-300 block">
                  Automated Resilience Pre-Checks:
                </span>
                <div className="flex items-center gap-2 text-emerald-400 text-[11px]">
                  <Check className="w-3.5 h-3.5" />
                  <span>IdP session state & researcher active jobs checked</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-400 text-[11px]">
                  <Check className="w-3.5 h-3.5" />
                  <span>Incremental volume snapshot armed for instant rollback</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-400 text-[11px]">
                  <Check className="w-3.5 h-3.5" />
                  <span>Telemetry agent heartbeat healthy (latency &lt; 12ms)</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {inspectTask.status !== "Completed" && (
                    <button
                      onClick={() => {
                        handleQuickStatusChange(inspectTask.id, "Completed");
                        setInspectTask(null);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors"
                    >
                      Mark Completed
                    </button>
                  )}
                  {inspectTask.status !== "In Progress" && inspectTask.status !== "Completed" && (
                    <button
                      onClick={() => {
                        handleQuickStatusChange(inspectTask.id, "In Progress");
                        setInspectTask(null);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-colors"
                    >
                      Start Execution
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setInspectTask(null)}
                  className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {editTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700/90 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Edit Maintenance Window</h3>
                  <p className="text-xs text-slate-400 font-mono">{editTask.task_name}</p>
                </div>
              </div>
              <button
                onClick={() => setEditTask(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateTask} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Scheduled Date & Time
                </label>
                <input
                  type="text"
                  value={editDateTime}
                  onChange={(e) => setEditDateTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Duration
                </label>
                <input
                  type="text"
                  value={editDuration}
                  onChange={(e) => setEditDuration(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as MaintenancePriority)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as MaintenanceStatus)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Upcoming">Upcoming</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Overdue">Overdue</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditTask(null)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
