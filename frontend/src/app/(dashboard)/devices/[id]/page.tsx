import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { DeviceDetailClient } from "./DeviceDetailClient";
import { MOCK_WORKSTATIONS } from "@/lib/api";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DeviceDetailPage({ params }: PageProps) {
  const { id } = await params;

  // Locate workstation by ID or hostname or fallback to first
  const workstation =
    MOCK_WORKSTATIONS.find(
      (w) =>
        w.id === id ||
        w.hostname.toLowerCase() === id.toLowerCase() ||
        w.id.toLowerCase() === id.toLowerCase()
    ) || {
      id,
      hostname: id.length >= 36 ? `Host-${id.slice(0, 8)}` : id,
      ip_address: "...",
      os_type: "...",
      department: "...",
      status: "ONLINE",
      last_seen_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      cpu_usage: 0,
      memory_usage: 0,
      disk_usage: 0,
      network_throughput: 0,
      process_count: 0,
      is_isolated: false,
    };

  if (!workstation) {
    notFound();
  }

  return (
    <div className="space-y-4 font-sans">
      {/* Breadcrumbs matching mockup */}
      <nav className="flex items-center gap-2 text-xs text-slate-400">
        <Link href="/devices" className="hover:text-white transition-colors">
          Devices Monitoring
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
        <span className="text-slate-200 font-medium">Device Details</span>
        <span className="text-slate-600">•</span>
        <span className="font-mono text-cyan-400 font-bold">{workstation.hostname}</span>
      </nav>

      {/* Interactive Client View */}
      <DeviceDetailClient initialWorkstation={workstation} />
    </div>
  );
}
