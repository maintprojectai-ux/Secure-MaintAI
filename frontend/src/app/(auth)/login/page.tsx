"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  Activity,
  ShieldCheck,
  Brain,
  Settings,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("admin@kku.edu.sa");
  const [password, setPassword] = useState("AdminSecure2026!");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(email, password);
      // Hard navigation ensures browser transmits newly issued JWT cookie to Next.js middleware
      window.location.href = "/";
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      setError(msg);
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-[#060c1d] text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-10 relative overflow-hidden font-sans select-none">
      {/* Background Ambience & Glows */}
      <div className="absolute top-1/4 left-1/12 w-[34rem] h-[34rem] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/12 w-[32rem] h-[32rem] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/3 w-80 h-80 bg-purple-600/5 rounded-full blur-[120px] pointer-events-none" />

      {/* University Architecture Silhouette Watermark */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.035] flex items-center justify-start">
        <svg
          className="w-full h-full max-w-4xl text-white"
          viewBox="0 0 1000 600"
          fill="currentColor"
        >
          {/* Classical Campus Colonnade / Neoclassical Building Watermark */}
          <rect x="100" y="450" width="800" height="20" />
          <rect x="120" y="430" width="760" height="20" />
          {/* Pillars */}
          {[160, 240, 320, 400, 480, 560, 640, 720, 800].map((x, i) => (
            <g key={i}>
              <rect x={x - 12} y="220" width="24" height="210" />
              <rect x={x - 16} y="210" width="32" height="10" />
              <rect x={x - 16} y="420" width="32" height="10" />
            </g>
          ))}
          {/* Architrave & Pediment */}
          <rect x="130" y="190" width="740" height="20" />
          <polygon points="120,190 500,70 880,190" />
          <circle cx="500" cy="140" r="28" fill="none" stroke="currentColor" strokeWidth="8" />
          {/* Central Dome Silhouette */}
          <path d="M420,70 Q500,-10 580,70 Z" />
        </svg>
      </div>

      {/* Top Header: Brand Logo */}
      <header className="w-full max-w-7xl mx-auto z-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 shadow-lg shadow-blue-500/20">
            <Shield className="w-5 h-5 text-cyan-400" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center text-lg sm:text-xl font-extrabold tracking-tight font-sans">
              <span className="text-white">Secure-</span>
              <span className="text-cyan-400">MaintAI</span>
            </div>
            <p className="text-[10px] text-slate-400 tracking-wide font-medium">
              AI-Powered Infrastructure Resilience
            </p>
          </div>
        </div>

        {/* Institutional IdP SSO Status */}
        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>University IdP: <span className="text-emerald-300 font-semibold">Active Directory / SSO</span></span>
        </div>
      </header>

      {/* Main Dual-Column Content */}
      <main className="w-full max-w-7xl mx-auto my-auto py-6 sm:py-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center z-10">
        {/* Left Column: Headline, Copy & Holographic Visual */}
        <div className="lg:col-span-6 flex flex-col items-center lg:items-start text-center lg:text-left space-y-6">
          {/* Three-line Hero Headline */}
          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold tracking-tight text-white leading-[1.15]">
              AI-Driven Monitoring. <br />
              Proactive Maintenance. <br />
              <span className="text-emerald-400">Stronger Security.</span>
            </h1>
          </div>

          {/* Subtitle Description */}
          <p className="text-sm text-slate-400 max-w-lg leading-relaxed font-sans">
            Secure-MaintAI unifies proactive maintenance and advanced cybersecurity to ensure the
            continuous availability of university infrastructure.
          </p>

          {/* 3D Holographic Pedestal and 4 Quadrant Feature Nodes */}
          <div className="relative w-full max-w-md h-72 sm:h-80 my-2 flex items-center justify-center">
            {/* Holographic Glowing Base Rings (Perspective Pedestal) */}
            <div className="absolute bottom-6 w-64 sm:w-72 h-20 rounded-[100%] bg-gradient-to-t from-cyan-500/20 to-blue-600/5 border border-cyan-400/40 blur-[1px] shadow-[0_0_50px_rgba(6,182,212,0.35)]" />
            <div className="absolute bottom-8 w-48 sm:w-56 h-14 rounded-[100%] border border-dashed border-cyan-300/50 animate-[spin_30s_linear_infinite]" />
            <div className="absolute bottom-10 w-32 sm:w-40 h-10 rounded-[100%] bg-cyan-400/20 border border-cyan-300/60 shadow-[0_0_20px_rgba(6,182,212,0.6)]" />

            {/* Light Projection Rays */}
            <div className="absolute bottom-12 w-28 h-32 bg-gradient-to-t from-cyan-400/25 via-blue-500/10 to-transparent blur-md" />

            {/* Central Holographic Glowing Shield with Padlock */}
            <div className="relative z-10 flex flex-col items-center justify-center -translate-y-4">
              <div className="relative w-28 h-32 flex items-center justify-center">
                {/* Outer Hologram Shield Outline */}
                <svg
                  className="w-full h-full text-cyan-400 drop-shadow-[0_0_25px_rgba(6,182,212,0.8)]"
                  viewBox="0 0 24 24"
                  fill="url(#shield-gradient)"
                  stroke="currentColor"
                  strokeWidth="1.2"
                >
                  <defs>
                    <linearGradient id="shield-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
                      <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.5" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>

                {/* Padlock inside Hologram Shield */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-10 rounded-lg bg-blue-950/80 border border-cyan-400/60 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.6)]">
                    <Lock className="w-5 h-5 text-cyan-300 drop-shadow-[0_0_8px_rgba(6,182,212,1)]" />
                  </div>
                </div>
              </div>
            </div>

            {/* Quadrant Feature 1: Top-Left (Monitoring) */}
            <div className="absolute top-8 left-4 sm:left-8 flex flex-col items-center space-y-1.5 group">
              <div className="w-12 h-12 rounded-xl bg-[#091b36] border border-blue-500/60 shadow-[0_0_18px_rgba(59,130,246,0.4)] flex items-center justify-center transition-transform hover:scale-105">
                <Activity className="w-6 h-6 text-blue-400" />
              </div>
              <span className="text-[11px] font-medium text-slate-300 tracking-tight">
                Monitoring
              </span>
            </div>

            {/* Quadrant Feature 2: Top-Right (Threat Detection) */}
            <div className="absolute top-8 right-4 sm:right-8 flex flex-col items-center space-y-1.5 group">
              <div className="w-12 h-12 rounded-xl bg-[#082424] border border-emerald-500/60 shadow-[0_0_18px_rgba(16,185,129,0.4)] flex items-center justify-center transition-transform hover:scale-105">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
              </div>
              <span className="text-[11px] font-medium text-slate-300 tracking-tight">
                Threat Detection
              </span>
            </div>

            {/* Quadrant Feature 3: Bottom-Left (Predictions) */}
            <div className="absolute bottom-8 left-2 sm:left-6 flex flex-col items-center space-y-1.5 group">
              <div className="w-12 h-12 rounded-xl bg-[#082424] border border-emerald-500/60 shadow-[0_0_18px_rgba(16,185,129,0.4)] flex items-center justify-center transition-transform hover:scale-105">
                <Brain className="w-6 h-6 text-emerald-400" />
              </div>
              <span className="text-[11px] font-medium text-slate-300 tracking-tight">
                Predictions
              </span>
            </div>

            {/* Quadrant Feature 4: Bottom-Right (Automated Response) */}
            <div className="absolute bottom-8 right-2 sm:right-6 flex flex-col items-center space-y-1.5 group">
              <div className="w-12 h-12 rounded-xl bg-[#091b36] border border-blue-500/60 shadow-[0_0_18px_rgba(59,130,246,0.4)] flex items-center justify-center transition-transform hover:scale-105">
                <Settings className="w-6 h-6 text-blue-400" />
              </div>
              <span className="text-[11px] font-medium text-slate-300 tracking-tight">
                Automated Response
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Glassmorphic Authentication Card */}
        <div className="lg:col-span-6 w-full max-w-md mx-auto">
          <div className="p-8 sm:p-10 rounded-2xl bg-[#0c162d]/90 backdrop-blur-xl border border-slate-700/70 shadow-2xl relative">
            {/* Card Header */}
            <div className="text-center mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-sans">
                Welcome Back!
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1.5 font-sans">
                Sign in to continue to Secure-MaintAI dashboard
              </p>

              {/* Sub-header Shield Emblem */}
              <div className="mt-4 flex justify-center">
                <div className="w-7 h-7 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 shadow-inner">
                  <Shield className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
                {error}
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Address Field */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full pl-10 pr-3 py-2.5 text-xs sm:text-sm bg-[#070e20] border border-slate-700/70 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-sans"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-[#070e20] border border-slate-700/70 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-sans"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Controls Row: Remember me + Forgot Password */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300 select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0 focus:outline-none cursor-pointer"
                  />
                  <span>Remember me</span>
                </label>

                <a
                  href="#forgot"
                  onClick={(e) => {
                    e.preventDefault();
                    setError("Please contact your IT administrator to reset institutional credentials.");
                  }}
                  className="text-blue-400 hover:text-blue-300 text-xs transition-colors"
                >
                  Forgot Password?
                </a>
              </div>

              {/* Primary Action Button: Sign In -> */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-[#1d68ff] hover:bg-[#185adb] text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all duration-200 shadow-lg shadow-blue-600/30 disabled:opacity-60 cursor-pointer mt-2"
              >
                {isLoading ? (
                  <span>Signing In...</span>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Card Footer */}
            <p className="text-xs text-slate-400 text-center mt-6">
              Don&apos;t have an account?{" "}
              <a
                href="#contact"
                onClick={(e) => {
                  e.preventDefault();
                  setError("Institutional access requests must be routed via King Khalid University IT Service Desk.");
                }}
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                Contact your administrator
              </a>
            </p>
          </div>
        </div>
      </main>

      {/* Global Bottom Footer Bar */}
      <footer className="w-full max-w-7xl mx-auto z-20 pt-4 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Left: Copyright */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Lock className="w-3.5 h-3.5 text-slate-500" />
          <span>© 2026 Secure-MaintAI. All rights reserved.</span>
        </div>

        {/* Right: King Khalid University Branding */}
        <div className="flex items-center gap-3 text-right">
          <div className="flex flex-col">
            <span className="text-xs font-medium text-slate-300 tracking-tight">
              King Khalid University
            </span>
            <span className="text-[11px] text-slate-400 font-medium" dir="rtl">
              جامعة الملك خالد
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-slate-800/80 border border-slate-700/60 p-1 flex items-center justify-center text-slate-200">
            {/* University Crest Stylization */}
            <svg
              className="w-5 h-5 text-slate-200"
              viewBox="0 0 48 48"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                d="M8 36C14 33 20 33 24 36C28 33 34 33 40 36V12C34 9 28 9 24 12C20 9 14 9 8 12V36Z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M24 12V36" strokeLinecap="round" />
              <path
                d="M19 6C19 4.5 24 3 24 3C24 3 29 4.5 29 6V12H19V6Z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </footer>
    </div>
  );
}
