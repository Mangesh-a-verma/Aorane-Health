/**
 * AORANE — Offline Queue & Local Cache
 *
 * Queues write operations when offline and replays them when internet returns.
 * Also caches GET responses so the app shows data when offline.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

// ── Types ────────────────────────────────────────────────────────────────────

export type OfflineEntry = {
  id: string;
  method: string;
  path: string;
  body?: Record<string, unknown>;
  category: "food" | "water" | "exercise" | "medicine" | "other";
  date: string;
  createdAt: string;
  /** Optimistic data shown in UI before sync */
  optimistic?: Record<string, unknown>;
};

// ── Storage Keys ─────────────────────────────────────────────────────────────

const QUEUE_KEY   = "aorane_offline_queue";
const CACHE_PREFIX = "aorane_cache_";
const NET_KEY     = "aorane_last_online";

// ── UUID ─────────────────────────────────────────────────────────────────────

function genId(): string {
  // Uses crypto.randomUUID where available (RN 0.70+), else fallback
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "offline-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── Queue ─────────────────────────────────────────────────────────────────────

export async function enqueue(entry: Omit<OfflineEntry, "id" | "createdAt">): Promise<OfflineEntry> {
  const full: OfflineEntry = { ...entry, id: genId(), createdAt: new Date().toISOString() };
  const q = await getQueue();
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([...q, full]));
  return full;
}

export async function getQueue(): Promise<OfflineEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OfflineEntry[];
  } catch { return []; }
}

export async function dequeue(id: string): Promise<void> {
  const q = await getQueue();
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q.filter((e) => e.id !== id)));
}

export async function getQueueCount(): Promise<number> {
  return (await getQueue()).length;
}

// ── Local Log Cache ───────────────────────────────────────────────────────────
// Used for GET responses so we can show data when offline

function cacheKey(path: string) {
  return CACHE_PREFIX + path.replace(/[^a-z0-9]/gi, "_").toLowerCase();
}

export async function setCachedResponse<T>(path: string, data: T): Promise<void> {
  await AsyncStorage.setItem(cacheKey(path), JSON.stringify({ data, at: Date.now() }));
}

export async function getCachedResponse<T>(path: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(path));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: T; at: number };
    return parsed.data;
  } catch { return null; }
}

// ── Network State ─────────────────────────────────────────────────────────────

let _online: boolean | null = null;

export function isOnlineFast(): boolean {
  // Quick check using navigator.onLine (web + RN web)
  if (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean") {
    return navigator.onLine;
  }
  // Native fallback — assume online until proven otherwise
  return _online !== false;
}

export function setOnlineState(online: boolean): void {
  _online = online;
  if (online) AsyncStorage.setItem(NET_KEY, String(Date.now()));
}

// ── Sync ─────────────────────────────────────────────────────────────────────

type SyncResult = { synced: number; failed: number; remaining: number };

/**
 * Attempt to sync all queued operations.
 * Call this when internet becomes available.
 * `requestFn` is the raw API request function from api.ts
 */
export async function syncOfflineQueue(
  requestFn: (method: string, path: string, body?: Record<string, unknown>) => Promise<unknown>
): Promise<SyncResult> {
  const q = await getQueue();
  if (q.length === 0) return { synced: 0, failed: 0, remaining: 0 };

  let synced = 0; let failed = 0;

  for (const entry of q) {
    try {
      await requestFn(entry.method, entry.path, entry.body);
      await dequeue(entry.id);
      synced++;
    } catch (e: unknown) {
      // If it's still a network error, stop trying
      const msg = (e as Error).message || "";
      if (msg.toLowerCase().includes("network") || msg.toLowerCase().includes("fetch")) break;
      // Other errors (validation etc.) — remove from queue so we don't retry forever
      await dequeue(entry.id);
      failed++;
    }
  }

  const remaining = (await getQueue()).length;
  return { synced, failed, remaining };
}
