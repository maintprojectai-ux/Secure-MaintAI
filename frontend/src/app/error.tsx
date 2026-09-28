"use client";

import React, { useEffect } from "react";
import { AlertOctagon, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error caught:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#060b18] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-5 shadow-lg shadow-rose-500/10">
        <AlertOctagon className="w-8 h-8" />
      </div>

      <h2 className="text-xl font-bold text-white tracking-tight">
        Telemetry Stream Encountered An Error
      </h2>
      <p className="text-xs text-slate-400 max-w-md mt-2 font-mono">
        {error.message || "An unexpected error occurred while rendering the dashboard view."}
      </p>

      {error.digest && (
        <p className="text-[10px] text-slate-500 font-mono mt-1">
          Digest: {error.digest}
        </p>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={() => reset()}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 transition-colors shadow-md shadow-blue-600/20"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry Request
        </button>

        <Link
          href="/"
          className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-colors"
        >
          <Home className="w-3.5 h-3.5" /> Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
