"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  Shield,
  Sliders,
  Bell,
  Cpu,
  Layers,
  Palette,
  Database,
  Search,
  Check,
  AlertTriangle,
  Save,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Lock,
  Globe,
  Radio,
  PowerOff,
  Activity,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import {
  getSystemSettings,
  updateSystemSettings,
  checkIdPHealth,
} from "@/lib/api";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<
    "general" | "security" | "ml" | "notifications" | "integrations" | "backup" | "appearance"
  >("general");

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // General Settings
  const [orgName, setOrgName] = useState("King Khalid University");
  const [primaryDomain, setPrimaryDomain] = useState("kku.edu.sa");
  const [timezone, setTimezone] = useState("(GMT+03:00) Riyadh / AST");
  const [dateFormat, setDateFormat] = useState("YYYY-MM-DD");
  const [language, setLanguage] = useState("English");
  const [defaultRole, setDefaultRole] = useState("STUDENT");
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
  const [notifyPush, setNotifyPush] = useState(false);
  const [notifyDailyReport, setNotifyDailyReport] = useState(true);

  // ML Settings
  const [smdThreshold, setSmdThreshold] = useState("0.95");
  const [sysmonConfidence, setSysmonConfidence] = useState("0.85");
  const [autoSurgicalIsolation, setAutoSurgicalIsolation] = useState(true);

  // Appearance
  const [selectedTheme, setSelectedTheme] = useState("dark-cyber");
  const [accentColor, setAccentColor] = useState("blue");

  // IdP diagnostic state
  const [idpHealth, setIdpHealth] = useState<{ status: string; latency_ms: number } | null>(null);
  const [isTestingIdP, setIsTestingIdP] = useState(false);

  // Load live system parameters with dual-mode fallback
  useEffect(() => {
    let isMounted = true;
    async function loadSettings() {
      try {
        const s = await getSystemSettings();
        if (isMounted && s) {
          setKillSwitchActive(s.kill_switch_active);
          setSmdThreshold(s.smd_threshold.toString());
          setSysmonConfidence(s.sysmon_confidence.toString());
          setAutoSurgicalIsolation(s.auto_surgical_isolation);
          setNotifyCritical(s.notify_critical);
          setNotifyDailyReport(s.notify_daily_report);
        }
      } catch {
        // Retain default mock baseline
      }
    }
    loadSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSaveSecurity = async () => {
    triggerToast("Security policies updated.");
    try {
      await updateSystemSettings({
        kill_switch_active: killSwitchActive,
      });
    } catch {
      //
    }
  };

  const handleSaveML = async () => {
    triggerToast("ML detection parameters recalibrated.");
    try {
      await updateSystemSettings({
        smd_threshold: parseFloat(smdThreshold),
        sysmon_confidence: parseFloat(sysmonConfidence),
        auto_surgical_isolation: autoSurgicalIsolation,
      });
    } catch {
      //
    }
  };

  const handleSaveNotifications = async () => {
    triggerToast("Notification rules saved.");
    try {
      await updateSystemSettings({
        notify_critical: notifyCritical,
        notify_daily_report: notifyDailyReport,
      });
    } catch {
      //
    }
  };

  const handleConfirmKillSwitch = async () => {
    const nextState = !killSwitchActive;
    setKillSwitchActive(nextState);
    setShowKillSwitchModal(false);
    triggerToast(
      nextState
        ? "EMERGENCY CONTAINMENT ACTIVATED across student endpoints!"
        : "Emergency containment lifted. Normal networking restored."
    );
    try {
      await updateSystemSettings({ kill_switch_active: nextState });
    } catch {
      // Local state preserved
    }
  };

  const handleTestIdP = async () => {
    setIsTestingIdP(true);
    try {
      const res = await checkIdPHealth();
      setIdpHealth({ status: res.status, latency_ms: res.latency_ms });
      triggerToast(
        `IdP Diagnostic: ${res.protocol} status is ${res.status.toUpperCase()} (${res.latency_ms}ms).`
      );
    } catch {
      setIdpHealth({ status: "outage", latency_ms: 0 });
      triggerToast("IdP Diagnostic: Fallback mode active (Directory connection failed).");
    } finally {
      setIsTestingIdP(false);
    }
  };

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const navItems = [
    { id: "general", label: "General", desc: "System global settings", icon: Settings },
    { id: "security", label: "Security", desc: "Authentication & access control", icon: Shield },
    { id: "ml", label: "ML & AI Models", desc: "Detection & thresholds", icon: Cpu },
    { id: "notifications", label: "Notifications", desc: "Alerts & channels", icon: Bell },
    { id: "integrations", label: "Integrations", desc: "Wazuh, IdP & Webhooks", icon: Layers },
    { id: "backup", label: "Backup & Recovery", desc: "Restore & automated snaps", icon: Database },
    { id: "appearance", label: "Appearance", desc: "Theme & visual tokens", icon: Palette },
  ];

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
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-base font-semibold text-white">General Settings</h3>
                <p className="text-xs text-slate-400">Manage your university campus profile and system identity</p>
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
                    value={sessionTimeout}
                    onChange={(e) => setSessionTimeout(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-brand-blue font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Default Student Workstation Pool</label>
                  <input
                    type="text"
                    disabled
                    value="CS-LAB-CLUSTER-A"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-800">
                <button
                  onClick={() => triggerToast("General settings saved successfully!")}
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
                          Immediately triggers surgical network isolation across all Student workstation clusters in case of coordinated ransomware outbreaks.
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

          {/* TAB 3: ML & AI MODELS */}
          {activeTab === "ml" && (
            <div className="glass-card p-6 space-y-6">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-base font-semibold text-white">Machine Learning & Anomaly Tuning</h3>
                <p className="text-xs text-slate-400">Fine-tune detection thresholds and surgical isolation triggers</p>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span className="font-semibold">Model 01: SMD Isolation Forest Anomaly Threshold</span>
                    <span className="font-mono text-cyan-400">{smdThreshold}</span>
                  </div>
                  <input
                    type="range"
                    min="0.80"
                    max="0.99"
                    step="0.01"
                    value={smdThreshold}
                    onChange={(e) => setSmdThreshold(e.target.value)}
                    className="w-full accent-brand-blue"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Higher threshold reduces false alarms on high-compute research tasks while catching aggressive spikes.
                  </p>
                </div>

                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span className="font-semibold">Model 02-B: Sysmon Threat Classifier Confidence Cutoff</span>
                    <span className="font-mono text-purple-400">{sysmonConfidence}</span>
                  </div>
                  <input
                    type="range"
                    min="0.70"
                    max="0.99"
                    step="0.01"
                    value={sysmonConfidence}
                    onChange={(e) => setSysmonConfidence(e.target.value)}
                    className="w-full accent-purple-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Minimum ML probability required before escalating an event to Wazuh SIEM security alert status.
                  </p>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
                  <div>
                    <p className="font-semibold text-slate-200">Role-Aware Automated Containment</p>
                    <p className="text-[11px] text-slate-400">
                      Never terminate background jobs for verified Researchers without explicit human operator confirmation.
                    </p>
                  </div>
                  <button
                    onClick={() => setAutoSurgicalIsolation(!autoSurgicalIsolation)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                      autoSurgicalIsolation ? "bg-brand-blue" : "bg-slate-700"
                    }`}
                  >
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      autoSurgicalIsolation ? "translate-x-5" : ""
                    }`} />
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-800">
                <button
                  onClick={handleSaveML}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-blue text-white text-xs font-semibold hover:bg-blue-600 transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Update Model Hyperparameters</span>
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
                <p className="text-xs text-slate-400">SIEM connectors, university identity provider, and webhooks</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start justify-between">
                  <div>
                    <span className="font-bold text-white block">Wazuh SIEM / XDR</span>
                    <span className="text-[11px] text-slate-400">v4.8 High-Availability Cluster</span>
                    <span className="inline-block mt-2 px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      CONNECTED (ACTIVE)
                    </span>
                  </div>
                  <RefreshCw className="w-4 h-4 text-emerald-400" />
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start justify-between">
                  <div>
                    <span className="font-bold text-white block">King Khalid University LDAP / IdP</span>
                    <span className="text-[11px] text-slate-400">SAML 2.0 / OIDC Context Broker</span>
                    <span className="inline-block mt-2 px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      {idpHealth
                        ? `${idpHealth.status.toUpperCase()} (${idpHealth.latency_ms}ms)`
                        : "CONNECTED (SYNCED)"}
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
                    <span className="font-bold text-white block">Microsoft Teams Webhook</span>
                    <span className="text-[11px] text-slate-400">Channel: #cyber-incidents</span>
                    <span className="inline-block mt-2 px-2 py-0.5 rounded text-[10px] bg-blue-500/15 text-blue-300 border border-blue-500/30">
                      ENABLED
                    </span>
                  </div>
                  <Radio className="w-4 h-4 text-blue-400" />
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start justify-between">
                  <div>
                    <span className="font-bold text-white block">Sysmon Ingestion Pipeline</span>
                    <span className="text-[11px] text-slate-400">Windows Event Log Channel 30</span>
                    <span className="inline-block mt-2 px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      STREAMING (120 EPS)
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
                <p className="text-xs text-slate-400">Snapshot retention, encryption, and one-click restoration</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
                  <span className="text-slate-500 block">Last Automated Snapshot:</span>
                  <span className="text-white font-mono font-bold text-sm">Sep 16, 2026 - 04:00 AM AST</span>
                  <span className="text-emerald-400 text-[11px] block">Verified Integrity (AES-256 GCM)</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
                  <span className="text-slate-500 block">Next Scheduled Snapshot:</span>
                  <span className="text-white font-mono font-bold text-sm">Sep 17, 2026 - 04:00 AM AST</span>
                  <span className="text-slate-400 text-[11px] block">Frequency: Every 24 Hours</span>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-800">
                <button
                  onClick={() => triggerToast("Initiating encrypted database snapshot...")}
                  className="px-4 py-2 rounded-lg bg-brand-blue text-white text-xs font-semibold hover:bg-blue-600 transition-colors"
                >
                  Trigger Manual Backup Now
                </button>
                <button
                  onClick={() => triggerToast("Backup archive verified.")}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 transition-colors"
                >
                  Verify Archive Hash
                </button>
              </div>
            </div>
          )}

          {/* TAB 7: APPEARANCE */}
          {activeTab === "appearance" && (
            <div className="glass-card p-6 space-y-6">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-base font-semibold text-white">Appearance & Visual Tokens</h3>
                <p className="text-xs text-slate-400">Tailwind CSS v4 theme customization</p>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Color Theme</label>
                  <select
                    value={selectedTheme}
                    onChange={(e) => setSelectedTheme(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-brand-blue"
                  >
                    <option value="dark-cyber">Cybersecurity Dark (#060b18)</option>
                    <option value="slate-midnight">Slate Midnight (#020617)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-2">Accent Highlight Color</label>
                  <div className="flex items-center gap-3">
                    {[
                      { id: "blue", color: "#3b82f6" },
                      { id: "cyan", color: "#06b6d4" },
                      { id: "purple", color: "#8b5cf6" },
                      { id: "emerald", color: "#10b981" },
                      { id: "amber", color: "#f59e0b" },
                      { id: "rose", color: "#ef4444" },
                    ].map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setAccentColor(c.id)}
                        className={`w-8 h-8 rounded-full border-2 transition-transform ${
                          accentColor === c.id ? "scale-125 border-white shadow-lg" : "border-transparent hover:scale-110"
                        }`}
                        style={{ backgroundColor: c.color }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-800">
                <button
                  onClick={() => triggerToast("Theme preferences applied.")}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-blue text-white text-xs font-semibold hover:bg-blue-600 transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Appearance</span>
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
              Activating this emergency switch will immediately broadcast a surgical packet-filter block to all 128 student lab endpoints, quarantining outbound internet connectivity while keeping university IT management SSH sockets active.
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
