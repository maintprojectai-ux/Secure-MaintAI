import React from "react";
import { Shield } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#060b18] flex flex-col items-center justify-center p-6 text-center">
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-xl shadow-blue-500/20 animate-pulse">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <div className="absolute -inset-2 rounded-2xl border border-blue-500/30 animate-ping opacity-25" />
      </div>

      <h2 className="text-base font-bold text-white tracking-tight font-sans">
        Loading Telemetry & Resilience Stream...
      </h2>
      <p className="text-xs text-slate-400 font-mono mt-1">
        Synchronizing with Secure-MaintAI backend & SIEM adapters
      </p>

      {/* Shimmer Placeholder Grid */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl opacity-40">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-card h-28 animate-pulse p-4 flex flex-col justify-between">
            <div className="h-3 w-20 bg-slate-700/60 rounded" />
            <div className="h-6 w-14 bg-slate-600/60 rounded" />
            <div className="h-2 w-full bg-slate-800/80 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
