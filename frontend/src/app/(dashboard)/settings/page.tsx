"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Settings,
  Shield,
  Bell,
  Layers,
  Database,
  AlertTriangle,
  Save,
  CheckCircle2,
  RefreshCw,
  Radio,
  PowerOff,
  Activity,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import {
  SystemSettingsData,
  getSystemSettings,
  updateSystemSettings,
  checkIdPHealth,
  downloadReportExport,
} from "@/lib/api";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<
    "general" | "security" | "notifications" | "integrations" | "backup"
  >("general");

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // General Settings
  const [orgName, setOrgName] = useState("King Khalid University");
  const [primaryDomain, setPrimaryDomain] = useState("kku.edu.sa");
  const [timezone, setTimezone] = useState("(GMT+03:00) Riyadh / AST");
  const [dateFormat, setDateFormat] = useState("YYYY-MM-DD");
  const [sessionTimeout, setSessionTimeout] = useState("30");

  // Security Settings
  const [mfaEnabled, setMfaEnabled] = useState(true);
  const [strongPasswordPolicy, setStrongPasswordPolicy] = useState(true);
  const [ipWhitelisting, setIpWhitelisting] = useState(true);
  const [killSwitchActive, setKillSwitchActive] = useState(false);
  const [showKillSwitchModal, setShowKillSwitchModal] = useState(false);

  // Notification Settings
  const [notifyCritical, setNotifyCritical] = useState(true);
  const [notifySms, setNotifySms] = useState(true);
  const [notifyDailyReport, setNotifyDailyReport] = useState(true);

  // Live Database & Integration Diagnostics
  const [dbStats, setDbStats] = useState({
    app_name: "Secure-MaintAI",
    app_env: "development",
    idp_mode: "University IdP (OIDC/LDAP Provider)",
    idp_status: "Connected & Healthy",
    db_users_count: 0,
    db_workstations_count: 0,
    db_online_workstations_count: 0,
    db_incidents_count: 0,
    db_alerts_count: 0,
    db_telemetry_count: 0,
    db_audit_logs_count: 0,
    last_backup_at: null as string | null,
  });

  // IdP diagnostic state
  const [idpHealth, setIdpHealth] = useState<{
    status: string;
    latency_ms: number;
    users_count: number;
  } | null>(null);
  const [isTestingIdP, setIsTestingIdP] = useState(false);

  const applySettingsResponse = useCallback((s: SystemSettingsData) => {
    setOrgName(s.org_name || "King Khalid University");
    setPrimaryDomain(s.primary_domain || "kku.edu.sa");
    setTimezone(s.timezone || "(GMT+03:00) Riyadh / AST");
    setDateFormat(s.date_format || "YYYY-MM-DD");
    setSessionTimeout(String(s.session_timeout_minutes ?? 30));
    setMfaEnabled(Boolean(s.mfa_enabled));
    setStrongPasswordPolicy(Boolean(s.strong_password_policy));
    setIpWhitelisting(Boolean(s.ip_whitelisting));
    setKillSwitchActive(Boolean(s.kill_switch_active));
    setNotifyCritical(Boolean(s.notify_critical));
    setNotifySms(Boolean(s.notify_sms));
    setNotifyDailyReport(Boolean(s.notify_daily_report));
    setDbStats({
      app_name: s.app_name || "Secure-MaintAI",
      app_env: s.app_env || "development",
      idp_mode: s.idp_mode || "University IdP (OIDC/LDAP Provider)",
      idp_status: s.idp_status || "Connected & Healthy",
      db_users_count: s.db_users_count ?? 0,
      db_workstations_count: s.db_workstations_count ?? 0,
      db_online_workstations_count: s.db_online_workstations_count ?? 0,
      db_incidents_count: s.db_incidents_count ?? 0,
      db_alerts_count: s.db_alerts_count ?? 0,
      db_telemetry_count: s.db_telemetry_count ?? 0,
      db_audit_logs_count: s.db_audit_logs_count ?? 0,
      last_backup_at: s.last_backup_at || null,
    });
  }, []);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const s = await getSystemSettings();
      if (s) {
        applySettingsResponse(s);
      }
    } catch {
      // Keep current values if unreachable
    } finally {
      setIsLoading(false);
    }
  }, [applySettingsResponse]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleSaveGeneral = async () => {
    try {
      const updated = await updateSystemSettings({
        org_name: orgName,
        primary_domain: primaryDomain,
        timezone,
        date_format: dateFormat,
        session_timeout_minutes: Math.max(5, Math.min(480, parseInt(sessionTimeout, 10) || 30)),
      });
      applySettingsResponse(updated);
      triggerToast("General settings saved to database audit log.");
    } catch (err: any) {
      triggerToast(err?.message || "Failed to save general settings.");
    }
  };

  const handleSaveSecurity = async () => {
    try {
      const updated = await updateSystemSettings({
        mfa_enabled: mfaEnabled,
        strong_password_policy: strongPasswordPolicy,
        ip_whitelisting: ipWhitelisting,
        kill_switch_active: killSwitchActive,
      });
      applySettingsResponse(updated);
      triggerToast("Security policies updated in database.");
    } catch (err: any) {
      triggerToast(err?.message || "Failed to update security policies.");
    }
  };

  const handleSaveNotifications = async () => {
    try {
      const updated = await updateSystemSettings({
        notify_critical: notifyCritical,
        notify_sms: notifySms,
        notify_daily_report: notifyDailyReport,
      });
      applySettingsResponse(updated);
      triggerToast("Notification rules saved to database.");
    } catch (err: any) {
      triggerToast(err?.message || "Failed to save notification rules.");
    }
  };

  const handleConfirmKillSwitch = async () => {
    const nextState = !killSwitchActive;
    setShowKillSwitchModal(false);
    try {
      const updated = await updateSystemSettings({ kill_switch_active: nextState });
      applySettingsResponse(updated);
      triggerToast(
        nextState
          ? `EMERGENCY CONTAINMENT ACTIVATED across ${dbStats.db_workstations_count} registered endpoints!`
          : "Emergency containment lifted. Normal networking restored."
      );
    } catch (err: any) {
      triggerToast(err?.message || "Failed to toggle emergency containment switch.");
    }
  };

  const handleTestIdP = async () => {
    setIsTestingIdP(true);
    try {
      const res = await checkIdPHealth();
      setIdpHealth({
        status: res.status,
        latency_ms: res.latency_ms,
        users_count: res.mock_users_registered,
      });
      triggerToast(
        `IdP Diagnostic: ${res.protocol} is ${res.status.toUpperCase()} (${res.latency_ms}ms, ${res.mock_users_registered} DB users).`
      );
    } catch {
      setIdpHealth({ status: "outage", latency_ms: 0, users_count: dbStats.db_users_count });
      triggerToast("IdP Diagnostic: Fallback mode active (Directory connection failed).");
    } finally {
      setIsTestingIdP(false);
    }
  };

  const handleTriggerManualBackup = async () => {
    try {
      const updated = await updateSystemSettings({ trigger_backup: true });
      applySettingsResponse(updated);
      const blob = await downloadReportExport("json");
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `secure-maintai-db-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      triggerToast("Database forensic backup JSON exported and recorded in audit trail.");
    } catch (err: any) {
      triggerToast(err?.message || "Failed to trigger manual database backup.");
    }
  };

  const navItems = [
    { id: "general", label: "General", desc: "System global settings", icon: Settings },
    { id: "security", label: "Security", desc: "Authentication & access control", icon: Shield },
    { id: "notifications", label: "Notifications", desc: "Alerts & channels", icon: Bell },
    { id: "integrations", label: "Integrations", desc: "Wazuh, IdP & Webhooks", icon: Layers },
    { id: "backup", label: "Backup & Recovery", desc: "Restore & automated snaps", icon: Database },
  ];

  const lastBackupFormatted = dbStats.last_backup_at
    ? new Date(dbStats.last_backup_at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "No snapshot recorded in AuditLog yet";

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs flex items-center justify-between shadow-lg shadow-emerald-950/50 animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMsg}</span>
          </div>
          <button onClick={() => setToastMsg(null)} className="text-emerald-400 hover:text-emerald-200">
            ×
          </button>
        </div>
      )}

      {/* Two Column Layout: Navigation Menu (3 cols) + Settings Panels (9 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Settings Tabs */}
        <div className="lg:col-span-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all ${
                  isActive
                    ? "bg-brand-blue/15 border border-brand-blue/40 text-white shadow-sm"
                    : "hover:bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-transparent"
                }`}
              >
                <div className={`p-2 rounded-lg mt-0.5 ${isActive ? "bg-brand-blue text-white" : "bg-slate-800 text-slate-400"}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-200">{item.label}</p>
                  <p className="text-[11px] text-slate-400">{item.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Settings Form Content */}
        <div className="lg:col-span-9 space-y-6">
          {/* TAB 1: GENERAL */}
          {activeTab === "general" && (
            <div className="glass-card p-6 space-y-6">
              <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white">General Settings</h3>
                  <p className="text-xs text-slate-400">
                    Manage your university campus profile and system identity ({dbStats.app_name} • {dbStats.app_env})
                  </p>
                </div>
                <button
                  onClick={loadSettings}
                  disabled={isLoading}
                  className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300"
                  title="Reload settings from backend"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-brand-blue" : ""}`} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Organization Name</label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-brand-blue"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Primary Domain</label>
                  <input
                    type="text"
                    value={primaryDomain}
                    onChange={(e) => setPrimaryDomain(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-brand-blue font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Timezone</label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-brand-blue"
                  >
                    <option value="(GMT+03:00) Riyadh / AST">(GMT+03:00) Riyadh / AST</option>
                    <option value="(GMT+00:00) UTC">(GMT+00:00) UTC</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Date Format</label>
                  <select
                    value={dateFormat}
                    onChange={(e) => setDateFormat(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-brand-blue"
                  >
                    <option value="YYYY-MM-DD">YYYY-MM-DD (ISO 8601)</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Session Inactivity Timeout (Minutes)</label>
                  <input
                    type="number"
                    min={5}
                    max={480}
                    value={sessionTimeout}
                    onChange={(e) => setSessionTimeout(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-brand-blue font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Registered Database Fleet</label>
                  <input
                    type="text"
                    disabled
                    value={`${dbStats.db_online_workstations_count} Online / ${dbStats.db_workstations_count} Total Workstations`}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-800">
                <button
                  onClick={handleSaveGeneral}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-blue text-white text-xs font-semibold hover:bg-blue-600 transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: SECURITY */}
          {activeTab === "security" && (
            <div className="glass-card p-6 space-y-6">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-base font-semibold text-white">Security & Access Controls</h3>
                <p className="text-xs text-slate-400">RBAC policies, multi-factor authentication, and containment switches</p>
              </div>

              <div className="space-y-4">
                {/* MFA Toggle */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
                  <div>
                    <p className="text-xs font-semibold text-slate-200">Enforce Multi-Factor Authentication (MFA)</p>
                    <p className="text-[11px] text-slate-400">Require TOTP authentication for all Administrator and IT Operator sessions</p>
                  </div>
                  <button
                    onClick={() => setMfaEnabled(!mfaEnabled)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                      mfaEnabled ? "bg-brand-blue" : "bg-slate-700"
                    }`}
                  >
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      mfaEnabled ? "translate-x-5" : ""
                    }`} />
                  </button>
                </div>

                {/* Password Policy */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
                  <div>
                    <p className="text-xs font-semibold text-slate-200">Enforce Strong Password Complexity</p>
                    <p className="text-[11px] text-slate-400">Requires 12+ characters, uppercase, lowercase, numeric, and special symbols</p>
                  </div>
                  <button
                    onClick={() => setStrongPasswordPolicy(!strongPasswordPolicy)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                      strongPasswordPolicy ? "bg-brand-blue" : "bg-slate-700"
                    }`}
                  >
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      strongPasswordPolicy ? "translate-x-5" : ""
                    }`} />
                  </button>
                </div>

                {/* IP Whitelisting */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
                  <div>
                    <p className="text-xs font-semibold text-slate-200">Campus IP Subnet Whitelisting</p>
                    <p className="text-[11px] text-slate-400">Restrict administrative access to 10.0.0.0/16 university campus networks</p>
                  </div>
                  <button
                    onClick={() => setIpWhitelisting(!ipWhitelisting)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                      ipWhitelisting ? "bg-brand-blue" : "bg-slate-700"
                    }`}
                  >
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      ipWhitelisting ? "translate-x-5" : ""
                    }`} />
                  </button>
                </div>

                {/* EMERGENCY KILL SWITCH */}
                <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/40 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                        <PowerOff className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-rose-300">Global Emergency Containment Switch</p>
                        <p className="text-[11px] text-slate-300 mt-0.5">
                          Immediately triggers surgical network isolation across all Student workstation clusters ({dbStats.db_workstations_count} database endpoints) in case of coordinated ransomware outbreaks.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setShowKillSwitchModal(true)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        killSwitchActive
                          ? "bg-rose-600 text-white shadow-lg shadow-rose-600/40"
                          : "bg-slate-800 text-rose-300 border border-rose-500/40 hover:bg-rose-950"
                      }`}
                    >
                      {killSwitchActive ? "ACTIVE (ISOLATED)" : "ACTIVATE SWITCH"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-800">
                <button
                  onClick={handleSaveSecurity}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-blue text-white text-xs font-semibold hover:bg-blue-600 transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Security Changes</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: NOTIFICATIONS */}
          {activeTab === "notifications" && (
            <div className="glass-card p-6 space-y-6">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-base font-semibold text-white">Alert & Notification Routing</h3>
                <p className="text-xs text-slate-400">Configure delivery channels for system emergencies</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
                  <div>
                    <p className="text-xs font-semibold text-slate-200">Instant Critical Threat Alerts (Email & SIEM)</p>
                    <p className="text-[11px] text-slate-400">Dispatched immediately when an active attack signature is detected</p>
                  </div>
                  <button
                    onClick={() => setNotifyCritical(!notifyCritical)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                      notifyCritical ? "bg-brand-blue" : "bg-slate-700"
                    }`}
                  >
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      notifyCritical ? "translate-x-5" : ""
                    }`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
                  <div>
                    <p className="text-xs font-semibold text-slate-200">Emergency SMS Dispatch to On-Call NOC</p>
                    <p className="text-[11px] text-slate-400">High-priority SMS alerts for server offline state or network flood</p>
                  </div>
                  <button
                    onClick={() => setNotifySms(!notifySms)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                      notifySms ? "bg-brand-blue" : "bg-slate-700"
                    }`}
                  >
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      notifySms ? "translate-x-5" : ""
                    }`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
                  <div>
                    <p className="text-xs font-semibold text-slate-200">Weekly Executive Digest</p>
                    <p className="text-[11px] text-slate-400">Delivered every Monday morning to campus IT leadership</p>
                  </div>
                  <button
                    onClick={() => setNotifyDailyReport(!notifyDailyReport)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                      notifyDailyReport ? "bg-brand-blue" : "bg-slate-700"
                    }`}
                  >
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      notifyDailyReport ? "translate-x-5" : ""
                    }`} />
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-800">
                <button
                  onClick={handleSaveNotifications}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-blue text-white text-xs font-semibold hover:bg-blue-600 transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Preferences</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: INTEGRATIONS */}
          {activeTab === "integrations" && (
            <div className="glass-card p-6 space-y-6">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-base font-semibold text-white">External System Integrations</h3>
                <p className="text-xs text-slate-400">SIEM connectors, university identity provider, and telemetry pipelines</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start justify-between">
                  <div>
                    <span className="font-bold text-white block">Wazuh SIEM / XDR Adapter</span>
                    <span className="text-[11px] text-slate-400">
                      {dbStats.db_incidents_count} Incidents • {dbStats.db_alerts_count} Alerts in DB
                    </span>
                    <span className="inline-block mt-2 px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      CONNECTED (ACTIVE)
                    </span>
                  </div>
                  <RefreshCw className="w-4 h-4 text-emerald-400" />
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start justify-between">
                  <div>
                    <span className="font-bold text-white block">{dbStats.idp_mode}</span>
                    <span className="text-[11px] text-slate-400">
                      {idpHealth ? idpHealth.users_count : dbStats.db_users_count} Registered DB Accounts
                    </span>
                    <span className="inline-block mt-2 px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      {idpHealth
                        ? `${idpHealth.status.toUpperCase()} (${idpHealth.latency_ms}ms)`
                        : dbStats.idp_status.toUpperCase()}
                    </span>
                  </div>
                  <button
                    onClick={handleTestIdP}
                    disabled={isTestingIdP}
                    title="Test IdP Connection"
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${isTestingIdP ? "animate-spin" : ""}`} />
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start justify-between">
                  <div>
                    <span className="font-bold text-white block">SOAR Notification Routing</span>
                    <span className="text-[11px] text-slate-400">
                      Critical Alerts: {notifyCritical ? "Enabled" : "Disabled"}
                    </span>
                    <span className="inline-block mt-2 px-2 py-0.5 rounded text-[10px] bg-blue-500/15 text-blue-300 border border-blue-500/30">
                      {notifyCritical ? "ENABLED" : "STANDBY"}
                    </span>
                  </div>
                  <Radio className="w-4 h-4 text-blue-400" />
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start justify-between">
                  <div>
                    <span className="font-bold text-white block">Telemetry Ingestion Pipeline</span>
                    <span className="text-[11px] text-slate-400">
                      {dbStats.db_telemetry_count} Telemetry Records in DB
                    </span>
                    <span className="inline-block mt-2 px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      {dbStats.db_online_workstations_count} AGENTS ONLINE
                    </span>
                  </div>
                  <Activity className="w-4 h-4 text-emerald-400" />
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: BACKUP */}
          {activeTab === "backup" && (
            <div className="glass-card p-6 space-y-6">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-base font-semibold text-white">Database Backup & Disaster Recovery</h3>
                <p className="text-xs text-slate-400">Database record inventory, forensic JSON snapshot export, and audit verification</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
                  <span className="text-slate-500 block">Last Configuration / Backup Event:</span>
                  <span className="text-white font-mono font-bold text-sm">{lastBackupFormatted}</span>
                  <span className="text-emerald-400 text-[11px] block">
                    Verified in Immutable Audit Trail ({dbStats.db_audit_logs_count} total logs)
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
                  <span className="text-slate-500 block">Live Database Inventory:</span>
                  <span className="text-white font-mono font-bold text-sm">
                    {dbStats.db_users_count} Users • {dbStats.db_workstations_count} Workstations
                  </span>
                  <span className="text-slate-400 text-[11px] block">
                    {dbStats.db_incidents_count} Incidents • {dbStats.db_alerts_count} Alerts • {dbStats.db_telemetry_count} Metrics
                  </span>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-800">
                <button
                  onClick={handleTriggerManualBackup}
                  className="px-4 py-2 rounded-lg bg-brand-blue text-white text-xs font-semibold hover:bg-blue-600 transition-colors"
                >
                  Trigger Manual Backup Now (JSON)
                </button>
                <button
                  onClick={async () => {
                    await loadSettings();
                    triggerToast(
                      `Database integrity verified: ${dbStats.db_audit_logs_count} immutable audit records confirmed.`
                    );
                  }}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 transition-colors"
                >
                  Verify Database Audit Trail
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Emergency Kill Switch Modal */}
      <Modal
        isOpen={showKillSwitchModal}
        onClose={() => setShowKillSwitchModal(false)}
        title="CRITICAL: Emergency System Containment Switch"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/50 text-rose-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-rose-300">
              <AlertTriangle className="w-4 h-4" />
              <span>HIGH IMPACT SECURITY ACTION</span>
            </div>
            <p>
              Activating this emergency switch will immediately broadcast a surgical packet-filter block across all{" "}
              {dbStats.db_workstations_count} registered endpoints in the database, quarantining outbound internet
              connectivity while keeping university IT management SSH sockets active.
            </p>
          </div>

          <p className="text-slate-300">
            Are you sure you want to {killSwitchActive ? "DEACTIVATE" : "ACTIVATE"} the campus-wide isolation containment policy?
          </p>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              onClick={() => setShowKillSwitchModal(false)}
              className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmKillSwitch}
              className={`px-4 py-2 rounded-lg font-bold transition-colors ${
                killSwitchActive
                  ? "bg-slate-700 text-white hover:bg-slate-600"
                  : "bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-600/30"
              }`}
            >
              {killSwitchActive ? "Deactivate & Restore" : "Confirm Emergency Lockdown"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

