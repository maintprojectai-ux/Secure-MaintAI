import React from "react";
import Link from "next/link";
import { ShieldX, Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#060b18] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-5 shadow-lg shadow-amber-500/10">
        <ShieldX className="w-8 h-8" />
      </div>

      <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 mb-3">
        404 — ROUTE NOT FOUND
      </span>

      <h2 className="text-2xl font-bold text-white tracking-tight">
        Workstation or Endpoint Unreachable
      </h2>
      <p className="text-xs text-slate-400 max-w-md mt-2 font-mono">
        The requested system path does not exist or has been relocated within the Secure-MaintAI domain.
      </p>

      <div className="mt-6 flex items-center gap-3">
        <Link
          href="/"
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 transition-colors shadow-md shadow-blue-600/20"
        >
          <Home className="w-3.5 h-3.5" /> Return to Dashboard
        </Link>
        <Link
          href="/devices"
          className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> View Fleet Inventory
        </Link>
      </div>
    </div>
  );
}
