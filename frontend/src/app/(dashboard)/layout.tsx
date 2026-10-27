import React from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { AlertProvider } from "@/context/AlertContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AlertProvider>
      <div className="min-h-screen bg-[#060b18] text-slate-100 flex">
        {/* Sidebar Navigation */}
        <div className="print:hidden">
          <Sidebar />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 lg:pl-64 print:pl-0">
          <div className="print:hidden">
            <TopNavbar />
          </div>
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6 print:p-0 print:max-w-none">
            {children}
          </main>
        </div>
      </div>
    </AlertProvider>
  );
}
