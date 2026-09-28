"use client";

import React, { useState, useMemo } from "react";
import {
  HelpCircle,
  Search,
  Rocket,
  Shield,
  Bell,
  Wrench,
  BarChart3,
  Lock,
  Headphones,
  Mail,
  MessageCircle,
  Phone,
  ChevronDown,
  ChevronRight,
  Download,
  Video,
  FileText,
  Plus,
  CheckCircle2,
  Clock,
  Send,
  Ticket,
  ExternalLink,
  ShieldAlert,
  Server,
  Activity,
  Cpu,
  Database,
  Radio,
  Check,
  User,
  AlertTriangle,
  Info,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

interface SupportTicketItem {
  id: string;
  ticket_number: string;
  title: string;
  category: string;
  status: "Open" | "In Progress" | "Resolved" | "Closed";
  priority: "Low" | "Medium" | "High" | "Critical";
  created_at: string;
  author: string;
  description: string;
}

interface GuideResource {
  id: string;
  title: string;
  description: string;
  size: string;
  type: "pdf" | "video";
  category: string;
  iconType: "doc" | "shield" | "video";
}

const INITIAL_TICKETS: SupportTicketItem[] = [
  {
    id: "tkt-001",
    ticket_number: "#TK-2026-00124",
    title: "Database connection issue",
    category: "Database & Backend",
    status: "Open",
    priority: "High",
    created_at: "Sep 14, 2026",
    author: "Ziyad Hassan (IT Operator)",
    description: "Intermittent query timeouts observed during high telemetry ingestion batches from Lab 3 workstations.",
  },
  {
    id: "tkt-002",
    ticket_number: "#TK-2026-00118",
    title: "Alert not triggered for high CPU",
    category: "Alerts & Notifications",
    status: "In Progress",
    priority: "Medium",
    created_at: "Sep 12, 2026",
    author: "Alex Rivera (IT Operator)",
    description: "Host SRV-AI-03 sustained >95% CPU for 25 minutes without generating a Level 3 warning alert.",
  },
  {
    id: "tkt-003",
    ticket_number: "#TK-2026-00105",
    title: "Report generation takes too long",
    category: "Reports & Analytics",
    status: "Resolved",
    priority: "Low",
    created_at: "Sep 08, 2026",
    author: "Dr. Sarah Al-Rashid (Admin)",
    description: "Monthly infrastructure resilience PDF export timed out after 60 seconds. Resolved via query indexing.",
  },
  {
    id: "tkt-004",
    ticket_number: "#TK-2026-00098",
    title: "Adding new device fails",
    category: "Device Monitoring",
    status: "Closed",
    priority: "Medium",
    created_at: "Sep 02, 2026",
    author: "Sultan Al-Harbi (NOC)",
    description: "macOS agent enrollment token expired during initial daemon initialization. Token lifetime extended.",
  },
];

const INITIAL_FAQS: FAQItem[] = [
  {
    id: "faq-1",
    question: "How do I add a new user?",
    answer: "Navigate to the Users Management page and click '+ Add User'. Enter the user's full name, academic email, department, and assign one of the 4 RBAC roles (Admin, IT Operator, Researcher, or Student). Role permissions are enforced cryptographically server-side across all endpoints.",
    category: "Account & Access",
  },
  {
    id: "faq-2",
    question: "How can I schedule a maintenance task?",
    answer: "Go to Maintenance Schedule and click '+ Schedule Maintenance'. Select the target workstation or server, specify the maintenance type (Kernel Patching, Hardware Diagnostics, or Security Optimization), set the downtime window, and assign an operator.",
    category: "Maintenance",
  },
  {
    id: "faq-3",
    question: "How do alerts and notifications work?",
    answer: "Secure-MaintAI continuously analyzes telemetry streams. When SMD models detect anomalous deviation (e.g. cryptojacking strain, thermal runaway), an alert is generated with confidence scores, MITRE ATT&CK mapping, and automated SOAR containment recommendations.",
    category: "Alerts & Notifications",
  },
  {
    id: "faq-4",
    question: "How can I generate a report?",
    answer: "Navigate to Reports & Analytics and click 'Export / Generate'. Select your report category (System Health, Security Incident, or Compliance Audit), choose the target timeframe (e.g., September 2026), and export directly to PDF, CSV, or JSON.",
    category: "Reports",
  },
  {
    id: "faq-5",
    question: "How do I reset my password?",
    answer: "Since Secure-MaintAI is integrated with King Khalid University Identity Provider (IdP / LDAP / OIDC), password resets must be initiated through the central university Single Sign-On (SSO) portal at portal.kku.edu.sa.",
    category: "Account & Access",
  },
];

const GUIDES_RESOURCES: GuideResource[] = [
  {
    id: "guide-1",
    title: "User Guide",
    description: "Complete guide to using Secure-MaintAI platform",
    size: "PDF • 4.2 MB",
    type: "pdf",
    category: "Documentation",
    iconType: "doc",
  },
  {
    id: "guide-2",
    title: "Administrator Guide",
    description: "System administration and configuration",
    size: "PDF • 3.1 MB",
    type: "pdf",
    category: "Administration",
    iconType: "doc",
  },
  {
    id: "guide-3",
    title: "Best Practices",
    description: "Security and maintenance best practices",
    size: "PDF • 2.7 MB",
    type: "pdf",
    category: "Security",
    iconType: "shield",
  },
  {
    id: "guide-4",
    title: "Video Tutorials",
    description: "Step-by-step video tutorials",
    size: "12 videos",
    type: "video",
    category: "Tutorials",
    iconType: "video",
  },
];

const HELP_TOPICS = [
  {
    id: "topic-1",
    title: "Getting Started",
    desc: "Learn the basics and set up your system.",
    articles: 12,
    icon: Rocket,
    color: "text-blue-400",
    bg: "bg-blue-500/20",
    border: "border-blue-500/30",
  },
  {
    id: "topic-2",
    title: "Account & Access",
    desc: "Manage your account, roles and permissions.",
    articles: 8,
    icon: Shield,
    color: "text-emerald-400",
    bg: "bg-emerald-500/20",
    border: "border-emerald-500/30",
  },
  {
    id: "topic-3",
    title: "Alerts & Notifications",
    desc: "Configure alerts and notification channels.",
    articles: 10,
    icon: Bell,
    color: "text-amber-400",
    bg: "bg-amber-500/20",
    border: "border-amber-500/30",
  },
  {
    id: "topic-4",
    title: "Maintenance",
    desc: "Schedule and manage maintenance tasks.",
    articles: 14,
    icon: Wrench,
    color: "text-purple-400",
    bg: "bg-purple-500/20",
    border: "border-purple-500/30",
  },
  {
    id: "topic-5",
    title: "Reports & Analytics",
    desc: "Generate and understand reports and insights.",
    articles: 9,
    icon: BarChart3,
    color: "text-blue-400",
    bg: "bg-blue-500/20",
    border: "border-blue-500/30",
  },
  {
    id: "topic-6",
    title: "Security",
    desc: "Security settings and best practices.",
    articles: 11,
    icon: Lock,
    color: "text-teal-400",
    bg: "bg-teal-500/20",
    border: "border-teal-500/30",
  },
];

export default function HelpSupportPage() {
  const [faqs] = useState<FAQItem[]>(INITIAL_FAQS);
  const [tickets, setTickets] = useState<SupportTicketItem[]>(INITIAL_TICKETS);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFaq, setExpandedFaq] = useState<string | null>("faq-1");
  const [activeTopicFilter, setActiveTopicFilter] = useState<string | null>(null);

  // Modals
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicketItem | null>(null);
  const [selectedResource, setSelectedResource] = useState<GuideResource | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isLiveChatOpen, setIsLiveChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: "user" | "agent"; text: string; time: string }>>([
    {
      sender: "agent",
      text: "Hello! You are connected with KKU NOC Engineering. How can we assist your infrastructure today?",
      time: "10:30 AM",
    },
  ]);
  const [chatInput, setChatInput] = useState("");

  // Feedback Toast
  const [feedback, setFeedback] = useState<string | null>(null);

  // New Ticket Form State
  const [newTicketForm, setNewTicketForm] = useState({
    title: "",
    category: "Device Monitoring",
    priority: "Medium" as "Low" | "Medium" | "High" | "Critical",
    description: "",
  });

  const filteredFaqs = useMemo(() => {
    let result = faqs;
    if (activeTopicFilter) {
      result = result.filter(
        (f) =>
          f.category.toLowerCase().includes(activeTopicFilter.toLowerCase()) ||
          f.question.toLowerCase().includes(activeTopicFilter.toLowerCase())
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (f) =>
          f.question.toLowerCase().includes(q) ||
          f.answer.toLowerCase().includes(q) ||
          f.category.toLowerCase().includes(q)
      );
    }
    return result;
  }, [faqs, searchQuery, activeTopicFilter]);

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketForm.title.trim()) return;

    const createdTicket: SupportTicketItem = {
      id: `tkt-${Date.now()}`,
      ticket_number: `#TK-2026-00${Math.floor(Math.random() * 900 + 130)}`,
      title: newTicketForm.title,
      description: newTicketForm.description || "No additional description provided.",
      category: newTicketForm.category,
      status: "Open",
      priority: newTicketForm.priority,
      created_at: "Sep 16, 2026",
      author: "Admin (Current Session)",
    };

    setTickets([createdTicket, ...tickets]);
    setIsTicketModalOpen(false);
    setNewTicketForm({
      title: "",
      category: "Device Monitoring",
      priority: "Medium",
      description: "",
    });
    setFeedback(`Support Ticket ${createdTicket.ticket_number} created successfully.`);
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = { sender: "user" as const, text: chatInput, time: "Just now" };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");

    setTimeout(() => {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: "agent" as const,
          text: "Thank you for the message. An on-duty engineer has received your telemetry inquiry and will follow up shortly.",
          time: "Just now",
        },
      ]);
    }, 1000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Open":
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
            Open
          </span>
        );
      case "In Progress":
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            In Progress
          </span>
        );
      case "Resolved":
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            Resolved
          </span>
        );
      case "Closed":
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            Closed
          </span>
        );
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Toast Notification */}
      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 text-xs flex items-center justify-between shadow-2xl shadow-emerald-950/60 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{feedback}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-emerald-400 hover:text-white p-1">
            ×
          </button>
        </div>
      )}

      {/* Top Grid: Hero Search Banner (Left) + Contact Support (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Hero Search Banner (8 cols) */}
        <div className="lg:col-span-8 glass-card p-7 relative overflow-hidden bg-gradient-to-br from-[#0c1833]/90 via-[#0a1226]/95 to-[#080d1d] border border-blue-500/30 flex flex-col justify-between rounded-2xl">
          {/* Subtle Ambient Background Glows */}
          <div className="absolute -left-10 -bottom-10 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute right-20 top-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Banner Content Layout */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
            {/* Left Texts & Search */}
            <div className="space-y-4 max-w-lg w-full">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                How can we help you?
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Find answers to common questions or reach out to our support team.
              </p>

              {/* Big Search Input */}
              <div className="relative pt-1">
                <input
                  type="text"
                  placeholder="Search for help articles, topics..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (activeTopicFilter) setActiveTopicFilter(null);
                  }}
                  className="w-full pl-4 pr-11 py-3 rounded-xl bg-[#070e22]/90 border border-slate-700/80 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 shadow-inner"
                />
                <button
                  type="button"
                  className="absolute right-3.5 top-4 text-slate-400 hover:text-white transition-colors"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>

              {/* Popular Topics Filter Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-slate-400 text-xs font-medium">Popular Topics:</span>
                {[
                  "Getting Started",
                  "Alerts & Notifications",
                  "Maintenance",
                  "Reports",
                  "Account & Access",
                ].map((topic) => {
                  const isActive = activeTopicFilter === topic;
                  return (
                    <button
                      key={topic}
                      onClick={() => {
                        if (isActive) {
                          setActiveTopicFilter(null);
                          setSearchQuery("");
                        } else {
                          setActiveTopicFilter(topic);
                          setSearchQuery("");
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${isActive
                          ? "bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/30"
                          : "bg-[#0c162e]/80 hover:bg-[#121f42] text-slate-300 hover:text-white border-slate-700/70"
                        }`}
                    >
                      {topic}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Glowing 3D Headset Speech-Bubble Illustration */}
            <div className="shrink-0 flex items-center justify-center p-4 relative select-none">
              <div className="relative w-44 h-44 flex items-center justify-center">
                {/* Outer Glow Disc */}
                <div className="absolute inset-2 rounded-3xl bg-gradient-to-tr from-blue-600/30 via-cyan-500/20 to-purple-600/30 blur-xl animate-pulse" />

                {/* 3D Glassmorphic Speech Bubble */}
                <div className="relative w-36 h-36 rounded-3xl bg-gradient-to-br from-blue-900/60 via-[#102046]/90 to-[#070e24]/95 border border-cyan-400/40 backdrop-blur-md shadow-2xl shadow-cyan-500/20 flex items-center justify-center group transform transition-transform duration-500 hover:scale-105">
                  {/* Subtle inner reflection */}
                  <div className="absolute inset-x-2 top-2 h-10 rounded-t-2xl bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />

                  {/* Headset Graphics */}
                  <div className="relative flex flex-col items-center justify-center">
                    <Headphones className="w-16 h-16 text-cyan-400 drop-shadow-[0_0_12px_rgba(34,211,238,0.6)] transition-all group-hover:drop-shadow-[0_0_18px_rgba(34,211,238,0.9)]" />
                    <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-blue-600 border-2 border-[#0c1833] flex items-center justify-center text-[11px] font-bold text-white shadow-lg">
                      ?
                    </span>
                  </div>

                  {/* Speech bubble small tail arrow */}
                  <div className="absolute -bottom-2 right-6 w-4 h-4 bg-[#102046] border-r border-b border-cyan-400/40 transform rotate-45" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Contact Support Card (4 cols) */}
        <div className="lg:col-span-4 glass-card p-5 space-y-3.5 flex flex-col justify-between rounded-2xl bg-[#0c1427]/90 border border-slate-800">
          <div>
            <div className="border-b border-slate-800/80 pb-3">
              <h3 className="text-sm font-bold text-white">Contact Support</h3>
              <p className="text-xs text-slate-400 mt-0.5">Can&apos;t find what you need? We&apos;re here to help.</p>
            </div>

            {/* 4 Interactive Contact Channels */}
            <div className="space-y-2 pt-3">
              {/* 1. Create Support Ticket */}
              <button
                type="button"
                onClick={() => setIsTicketModalOpen(true)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-blue-500/40 text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 group-hover:scale-105 transition-transform">
                    <Ticket className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white group-hover:text-blue-400 transition-colors">
                      Create Support Ticket
                    </p>
                    <p className="text-[11px] text-slate-400">Submit a ticket and our team will get back to you.</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
              </button>

              {/* 2. Email Support */}
              <button
                type="button"
                onClick={() => {
                  window.location.href = "mailto:support@secure-maintai.com";
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-blue-500/40 text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 group-hover:scale-105 transition-transform">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-semibold text-white group-hover:text-blue-400 transition-colors">
                        Email Support
                      </p>
                    </div>
                    <p className="text-[11px] text-cyan-400 font-mono">support@secure-maintai.com</p>
                    <p className="text-[10px] text-slate-400">We typically reply within 24 hours.</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
              </button>

              {/* 3. Live Chat */}
              <button
                type="button"
                onClick={() => setIsLiveChatOpen(true)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/40 text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-white group-hover:text-emerald-400 transition-colors">
                        Live Chat
                      </p>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Online
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">Chat with our support team in real-time.</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
              </button>

              {/* 4. Call Support */}
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">Call Support</p>
                    <p className="text-[11px] font-mono text-cyan-400 font-semibold">+966 11 123 4567</p>
                    <p className="text-[10px] text-slate-400">Sun - Thu, 8:00 AM - 5:00 PM (GMT+3)</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600 shrink-0 ml-2" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Browse Help Topics (6-Column Responsive Grid) */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white tracking-tight">Browse Help Topics</h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {HELP_TOPICS.map((topic) => {
            const Icon = topic.icon;
            const isFilterActive = activeTopicFilter === topic.title;
            return (
              <div
                key={topic.id}
                onClick={() => {
                  if (isFilterActive) {
                    setActiveTopicFilter(null);
                    setSearchQuery("");
                  } else {
                    setActiveTopicFilter(topic.title);
                    setSearchQuery("");
                  }
                }}
                className={`glass-card p-4 flex flex-col justify-between rounded-xl transition-all cursor-pointer group ${isFilterActive
                    ? "border-blue-500 bg-blue-950/40 shadow-lg shadow-blue-500/20"
                    : "border-slate-800 hover:border-slate-700 bg-[#0c1427]/80 hover:bg-slate-850"
                  }`}
              >
                <div>
                  <div className={`w-9 h-9 rounded-full ${topic.bg} border ${topic.border} flex items-center justify-center ${topic.color} mb-3 group-hover:scale-110 transition-transform`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">
                    {topic.title}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug line-clamp-2">
                    {topic.desc}
                  </p>
                </div>

                <div className="mt-4 pt-2 flex items-center text-[11px] font-medium text-cyan-400 group-hover:text-cyan-300 transition-colors">
                  <span>{topic.articles} articles →</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 3: 3-Column Grid: FAQ (1) | Guides & Resources (2) | Your Support Tickets (3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Frequently Asked Questions */}
        <div className="glass-card p-5 space-y-4 rounded-2xl bg-[#0c1427]/90 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="border-b border-slate-800/80 pb-3">
              <h3 className="text-sm font-bold text-white">Frequently Asked Questions</h3>
            </div>

            <div className="space-y-2 pt-3">
              {filteredFaqs.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  No matching FAQs found for &quot;{searchQuery || activeTopicFilter}&quot;.
                </div>
              ) : (
                filteredFaqs.map((faq) => {
                  const isExpanded = expandedFaq === faq.id;
                  return (
                    <div
                      key={faq.id}
                      className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedFaq(isExpanded ? null : faq.id)}
                        className="w-full flex items-center justify-between p-3 text-left text-xs font-medium text-slate-200 hover:text-white transition-colors cursor-pointer"
                      >
                        <span className="pr-2">{faq.question}</span>
                        <ChevronDown
                          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${isExpanded ? "transform rotate-180 text-blue-400" : ""
                            }`}
                        />
                      </button>

                      {isExpanded && (
                        <div className="px-3 pb-3 pt-1 text-xs text-slate-400 leading-relaxed border-t border-slate-800/60 bg-slate-950/40 animate-in fade-in">
                          {faq.answer}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                setActiveTopicFilter(null);
                setSearchQuery("");
                setFeedback("Displaying all platform knowledge base FAQs.");
                setTimeout(() => setFeedback(null), 3000);
              }}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              View all FAQs →
            </button>
          </div>
        </div>

        {/* Column 2: Guides & Resources */}
        <div className="glass-card p-5 space-y-4 rounded-2xl bg-[#0c1427]/90 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="border-b border-slate-800/80 pb-3">
              <h3 className="text-sm font-bold text-white">Guides &amp; Resources</h3>
            </div>

            <div className="space-y-2.5 pt-3">
              {GUIDES_RESOURCES.map((guide) => (
                <div
                  key={guide.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${guide.iconType === "video"
                          ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                          : guide.iconType === "shield"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                        }`}
                    >
                      {guide.iconType === "video" ? (
                        <Video className="w-4 h-4" />
                      ) : guide.iconType === "shield" ? (
                        <Shield className="w-4 h-4" />
                      ) : (
                        <FileText className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{guide.title}</p>
                      <p className="text-[11px] text-slate-400 truncate">{guide.description}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">{guide.size}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedResource(guide)}
                    className="px-3 py-1 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors shrink-0 cursor-pointer"
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                setFeedback("Full documentation library is indexed and active.");
                setTimeout(() => setFeedback(null), 3000);
              }}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              View all resources →
            </button>
          </div>
        </div>

        {/* Column 3: Your Support Tickets */}
        <div id="tickets" className="glass-card p-5 space-y-4 rounded-2xl bg-[#0c1427]/90 border border-slate-800 flex flex-col justify-between scroll-mt-20">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h3 className="text-sm font-bold text-white">Your Support Tickets</h3>
              <button
                type="button"
                onClick={() => {
                  setFeedback("Showing all support ticket requests.");
                  setTimeout(() => setFeedback(null), 3000);
                }}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer"
              >
                View All
              </button>
            </div>

            <div className="space-y-2 pt-3">
              {tickets.slice(0, 4).map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/60 transition-all cursor-pointer group"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-mono text-[11px] text-cyan-400 font-bold">{ticket.ticket_number}</p>
                    <p className="text-xs font-medium text-white group-hover:text-blue-400 transition-colors truncate">
                      {ticket.title}
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">Created: {ticket.created_at}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {getStatusBadge(ticket.status)}
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                setFeedback("Displaying complete support ticket archive.");
                setTimeout(() => setFeedback(null), 3000);
              }}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              View all tickets →
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Footer Status Bar */}
      <div className="glass-card p-4 rounded-2xl bg-[#0c1427]/95 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">System Status:</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-400">All Systems Operational</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
              <span>Last updated: Sep 16, 2026 10:30 AM</span>
              <button
                type="button"
                onClick={() => setIsStatusModalOpen(true)}
                className="text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-0.5 cursor-pointer"
              >
                View Status Page →
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-white">Still need help?</p>
            <p className="text-[11px] text-slate-400">Our support team is ready to assist you.</p>
          </div>
          <button
            type="button"
            onClick={() => setIsTicketModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
          >
            <Ticket className="w-4 h-4" />
            <span>Create Support Ticket</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: Create Support Ticket Modal */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isTicketModalOpen}
        onClose={() => setIsTicketModalOpen(false)}
        title="Create Support Ticket"
        subtitle="Submit a technical assistance request to the KKU Network Operations Center"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateTicket} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Issue Summary / Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Telemetry agent buffer disconnect on Node 14"
              value={newTicketForm.title}
              onChange={(e) => setNewTicketForm({ ...newTicketForm, title: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-[#091124] border border-slate-800 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Category</label>
              <select
                value={newTicketForm.category}
                onChange={(e) => setNewTicketForm({ ...newTicketForm, category: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-[#091124] border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="Device Monitoring">Device Monitoring</option>
                <option value="Alerts & Notifications">Alerts & Notifications</option>
                <option value="Maintenance Schedule">Maintenance Schedule</option>
                <option value="AI Models & Anomaly Detection">AI Models & Anomaly Detection</option>
                <option value="Database & Backend">Database & Backend</option>
                <option value="Reports & Exporting">Reports & Exporting</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Priority</label>
              <select
                value={newTicketForm.priority}
                onChange={(e) =>
                  setNewTicketForm({
                    ...newTicketForm,
                    priority: e.target.value as "Low" | "Medium" | "High" | "Critical",
                  })
                }
                className="w-full px-3 py-2 rounded-xl bg-[#091124] border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="Low">Low - Informational inquiry</option>
                <option value="Medium">Medium - Standard operational issue</option>
                <option value="High">High - Degraded host or telemetry stream</option>
                <option value="Critical">Critical - Service outage / Containment failure</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Detailed Description & Error Logs</label>
            <textarea
              rows={4}
              placeholder="Describe symptoms, workstation hostname, timestamps, and steps to reproduce..."
              value={newTicketForm.description}
              onChange={(e) => setNewTicketForm({ ...newTicketForm, description: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-[#091124] border border-slate-800 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 resize-none font-mono"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsTicketModalOpen(false)}
              className="px-3.5 py-2 rounded-xl border border-slate-700 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit Ticket</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: Ticket Detail Viewer Modal */}
      {/* ========================================================================= */}
      {selectedTicket && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedTicket(null)}
          title={`Ticket Details: ${selectedTicket.ticket_number}`}
          subtitle={`Submitted on ${selectedTicket.created_at} by ${selectedTicket.author}`}
          maxWidth="lg"
          footer={
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-slate-500 font-mono">Assigned to KKU NOC Level 2</span>
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition-colors"
              >
                Close
              </button>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-[#091124] border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Issue Title:</span>
                <span className="font-semibold text-white">{selectedTicket.title}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Category:</span>
                <span className="text-cyan-400 font-mono">{selectedTicket.category}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Current Status:</span>
                <div>{getStatusBadge(selectedTicket.status)}</div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Priority Level:</span>
                <span
                  className={`font-bold ${selectedTicket.priority === "Critical"
                      ? "text-rose-400"
                      : selectedTicket.priority === "High"
                        ? "text-amber-400"
                        : "text-blue-400"
                    }`}
                >
                  {selectedTicket.priority}
                </span>
              </div>
            </div>

            <div>
              <p className="text-slate-300 font-medium mb-1">Issue Description &amp; Technical Notes:</p>
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-slate-300 leading-relaxed font-mono">
                {selectedTicket.description}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: Resource / Guide Viewer Modal */}
      {/* ========================================================================= */}
      {selectedResource && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedResource(null)}
          title={selectedResource.title}
          subtitle={`${selectedResource.category} • ${selectedResource.size}`}
          maxWidth="lg"
          footer={
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                onClick={() => {
                  setFeedback(`Downloading ${selectedResource.title.replace(/\s+/g, "_")}.pdf...`);
                  setTimeout(() => setFeedback(null), 3000);
                  setSelectedResource(null);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Resource</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedResource(null)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition-colors"
              >
                Close
              </button>
            </div>
          }
        >
          <div className="space-y-3.5 text-xs">
            <div className="p-4 rounded-xl bg-[#091124] border border-slate-800 space-y-2">
              <p className="font-semibold text-white text-sm">{selectedResource.description}</p>
              <p className="text-slate-400 leading-relaxed">
                This official reference document covers full architectural specifications, telemetry daemon configuration, SMD anomaly detection tuning, IdP authentication verification, and SOAR surgical containment policies.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-300 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Document Version:</span>
                <span className="font-mono text-cyan-400">v2.4 (September 2026 Edition)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Author:</span>
                <span className="text-white">KKU Resilience &amp; Security Engineering Team</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Target Audience:</span>
                <span className="text-white">Administrators, IT Operators, and Researchers</span>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: System Status Page Modal */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title="University Infrastructure Status"
        subtitle="Real-time operational health across all Secure-MaintAI subsystems"
        maxWidth="lg"
        footer={
          <button
            type="button"
            onClick={() => setIsStatusModalOpen(false)}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition-colors"
          >
            Close
          </button>
        }
      >
        <div className="space-y-3 text-xs">
          {[
            {
              name: "FastAPI Telemetry Ingestion Ingress",
              status: "Operational",
              latency: "14ms",
              uptime: "99.99%",
              icon: Server,
            },
            {
              name: "SMD AI Anomaly Detection Engine (Model 01)",
              status: "Operational",
              latency: "42ms",
              uptime: "99.95%",
              icon: Cpu,
            },
            {
              name: "TimescaleDB Time-Series Cluster",
              status: "Operational",
              latency: "8ms",
              uptime: "99.98%",
              icon: Database,
            },
            {
              name: "Wazuh SIEM / XDR Connector",
              status: "Operational",
              latency: "22ms",
              uptime: "99.91%",
              icon: Activity,
            },
            {
              name: "University IdP / LDAP Identity Gateway",
              status: "Operational",
              latency: "19ms",
              uptime: "99.99%",
              icon: Radio,
            },
          ].map((srv, idx) => {
            const Icon = srv.icon;
            return (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-xl bg-[#091124] border border-slate-800"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">{srv.name}</p>
                    <p className="text-[10px] text-slate-400">
                      Latency: <span className="font-mono text-cyan-400">{srv.latency}</span> • Uptime:{" "}
                      <span className="font-mono text-emerald-400">{srv.uptime}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[11px] font-semibold text-emerald-400">{srv.status}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 5: Live NOC Chat Modal */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isLiveChatOpen}
        onClose={() => setIsLiveChatOpen(false)}
        title="Live NOC Support Chat"
        subtitle="Connected with KKU Security & Operations Center (GMT+3)"
        maxWidth="md"
      >
        <div className="flex flex-col h-80 justify-between text-xs">
          {/* Chat Transcript */}
          <div className="overflow-y-auto space-y-3 p-2 pr-1">
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] p-3 rounded-2xl ${msg.sender === "user"
                      ? "bg-blue-600 text-white rounded-br-none"
                      : "bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none"
                    }`}
                >
                  <p className="leading-relaxed">{msg.text}</p>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 font-mono">{msg.time}</span>
              </div>
            ))}
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSendChatMessage} className="flex gap-2 pt-3 border-t border-slate-800">
            <input
              type="text"
              placeholder="Type your message to NOC engineer..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl bg-[#091124] border border-slate-800 text-slate-200 placeholder:text-slate-500 text-xs focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </Modal>
    </div>
  );
}
