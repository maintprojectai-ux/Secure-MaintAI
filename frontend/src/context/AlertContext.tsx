"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { getAlerts, getToken } from "@/lib/api";

export interface AlertSummaryItem {
  id: string;
  title: string;
  description: string;
  severity: string;
  workstation_hostname?: string;
  workstation_id?: string;
  created_at: string;
  status: string;
}

interface AlertContextType {
  openAlertsCount: number;
  criticalAlertsCount: number;
  recentAlerts: AlertSummaryItem[];
  isLoading: boolean;
  refreshAlertCounts: () => Promise<void>;
  isConnected?: boolean;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [openAlertsCount, setOpenAlertsCount] = useState<number>(0);
  const [criticalAlertsCount, setCriticalAlertsCount] = useState<number>(0);
  const [recentAlerts, setRecentAlerts] = useState<AlertSummaryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await getAlerts({ limit: 50 });
      if (Array.isArray(data)) {
        const openList = data.filter((a) => (a.status || "OPEN").toUpperCase() === "OPEN");
        setOpenAlertsCount(openList.length);
        const criticalList = openList.filter((a) => (a.severity || "").toUpperCase() === "CRITICAL");
        setCriticalAlertsCount(criticalList.length);
        setRecentAlerts(openList.slice(0, 5));
      } else {
        setOpenAlertsCount(0);
        setCriticalAlertsCount(0);
        setRecentAlerts([]);
      }
    } catch {
      // In case backend is offline, preserve 0 counts
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // 1. Initial snapshot load
    fetchAlerts();

    // 2. Establish persistent Server-Sent Events (SSE) connection for zero-polling real-time updates
    if (typeof window !== "undefined") {
      try {
        const token = getToken();
        const streamUrl = `/api/v1/alerts/stream${token ? `?token=${encodeURIComponent(token)}` : ""}`;
        const es = new EventSource(streamUrl);
        eventSourceRef.current = es;

        es.onopen = () => {
          setIsConnected(true);
        };

        es.addEventListener("ping", () => {
          setIsConnected(true);
        });

        es.addEventListener("alert", (event) => {
          try {
            const payload = JSON.parse(event.data);
            const { event: evtType, data } = payload || {};
            if (!data || !data.id) return;

            const alertItem: AlertSummaryItem = {
              id: data.id,
              title: data.title || "Alert",
              description: data.description || "",
              severity: (data.severity || "MEDIUM").toUpperCase(),
              workstation_hostname: data.workstation_hostname,
              workstation_id: data.workstation_id,
              created_at: data.created_at || new Date().toISOString(),
              status: (data.status || "OPEN").toUpperCase(),
            };

            if (evtType === "ALERT_CREATED") {
              setOpenAlertsCount((c) => c + 1);
              if (alertItem.severity === "CRITICAL") {
                setCriticalAlertsCount((c) => c + 1);
              }
              setRecentAlerts((prev) => [alertItem, ...prev.filter((a) => a.id !== alertItem.id)].slice(0, 5));
            } else if (evtType === "ALERT_ACKNOWLEDGED") {
              setRecentAlerts((prev) =>
                prev.map((a) => (a.id === alertItem.id ? { ...a, status: "ACKNOWLEDGED" } : a))
              );
            } else if (evtType === "ALERT_RESOLVED") {
              setOpenAlertsCount((c) => Math.max(0, c - 1));
              if (alertItem.severity === "CRITICAL") {
                setCriticalAlertsCount((c) => Math.max(0, c - 1));
              }
              setRecentAlerts((prev) => prev.filter((a) => a.id !== alertItem.id));
            }

            // Notify all listening components in real time without triggering redundant HTTP polling
            window.dispatchEvent(
              new CustomEvent("alerts-updated", {
                detail: { ...payload, fromSse: true },
              })
            );
          } catch (err) {
            console.warn("[AlertContext] Failed to parse SSE event:", err);
          }
        });

        es.onerror = () => {
          setIsConnected(false);
          // Browser EventSource automatically reconnects with backoff
        };
      } catch (err) {
        console.warn("[AlertContext] SSE connection initialization error:", err);
      }
    }

    // 3. Listen for manual update events from SOC action buttons
    const handleManualUpdate = (evt: Event) => {
      const custom = evt as CustomEvent;
      if (custom.detail?.fromSse) return; // Already updated in-memory above
      fetchAlerts();
    };
    window.addEventListener("alerts-updated", handleManualUpdate);

    return () => {
      window.removeEventListener("alerts-updated", handleManualUpdate);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [fetchAlerts]);

  return (
    <AlertContext.Provider
      value={{
        openAlertsCount,
        criticalAlertsCount,
        recentAlerts,
        isLoading,
        refreshAlertCounts: fetchAlerts,
        isConnected,
      }}
    >
      {children}
    </AlertContext.Provider>
  );
}

export function useAlerts(): AlertContextType {
  const context = useContext(AlertContext);
  if (!context) {
    return {
      openAlertsCount: 0,
      criticalAlertsCount: 0,
      recentAlerts: [],
      isLoading: false,
      refreshAlertCounts: async () => {},
    };
  }
  return context;
}
