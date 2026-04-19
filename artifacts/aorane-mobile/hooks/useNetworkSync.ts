/**
 * AORANE — Network Sync Hook
 *
 * - Monitors online/offline status (web: navigator.onLine events, native: polling)
 * - Triggers offline queue sync when internet returns
 * - Exposes `isOnline` boolean to components
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { AppState, AppStateStatus, Platform } from "react-native";
import { syncOfflineQueue, getQueueCount, setOnlineState } from "@/lib/offlineQueue";
import { rawRequest } from "@/lib/api";

// Sync listeners registered from anywhere in the app
const _syncListeners: Array<() => void> = [];

export function addSyncListener(fn: () => void): () => void {
  _syncListeners.push(fn);
  return () => {
    const idx = _syncListeners.indexOf(fn);
    if (idx !== -1) _syncListeners.splice(idx, 1);
  };
}

function notifySyncListeners() {
  _syncListeners.forEach((fn) => { try { fn(); } catch { } });
}

// ── Network detection ────────────────────────────────────────────────────────

async function checkConnectivity(): Promise<boolean> {
  // Fast check via navigator.onLine
  if (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean" && !navigator.onLine) {
    return false;
  }
  // Verify with an actual request (short timeout)
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 3000);
    await fetch(
      Platform.OS === "web" ? "/api/health" : (process.env.EXPO_PUBLIC_API_URL || "http://localhost:8080") + "/api/health",
      { method: "HEAD", signal: ctrl.signal }
    );
    clearTimeout(tid);
    return true;
  } catch {
    return false;
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useNetworkSync() {
  const [isOnline, setIsOnline]       = useState(true);
  const [pendingCount, setPending]    = useState(0);
  const [syncing, setSyncing]         = useState(false);
  const syncInProgress                = useRef(false);

  const refreshPending = useCallback(async () => {
    setPending(await getQueueCount());
  }, []);

  const doSync = useCallback(async () => {
    if (syncInProgress.current) return;
    syncInProgress.current = true;
    setSyncing(true);
    try {
      const result = await syncOfflineQueue(
        (method, path, body) => rawRequest(method, path, body)
      );
      if (result.synced > 0) {
        notifySyncListeners();
      }
    } finally {
      syncInProgress.current = false;
      setSyncing(false);
      await refreshPending();
    }
  }, [refreshPending]);

  const handleOnline = useCallback(async () => {
    const online = await checkConnectivity();
    setOnlineState(online);
    setIsOnline(online);
    if (online) {
      await doSync();
    }
    await refreshPending();
  }, [doSync, refreshPending]);

  useEffect(() => {
    // Initial check
    handleOnline();
    refreshPending();

    // Web: listen to browser online/offline events
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.addEventListener("online",  handleOnline);
      window.addEventListener("offline", () => { setIsOnline(false); setOnlineState(false); });
      return () => {
        window.removeEventListener("online",  handleOnline);
        window.removeEventListener("offline", () => {});
      };
    }

    // Native: poll every 15 seconds + on app foreground
    const interval = setInterval(handleOnline, 15_000);

    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") handleOnline();
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [handleOnline, refreshPending]);

  return { isOnline, pendingCount, syncing, triggerSync: doSync };
}
