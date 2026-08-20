// ─── Consent manager ───────────────────────────────────────────────────────
//
// Default state is privacy-safe: analytics, marketing and preferences all
// start OFF until the visitor actively chooses. Only "necessary" is always
// on, and it's never actually used to gate anything in this package — there
// are no trackers in the "necessary" bucket, it exists so the four
// categories can be described uniformly.
//
// Storage: a single localStorage key holding the whole state plus a
// "responded" flag, so the banner only shows once per browser until the
// person changes their mind via a settings link. Falls back to an in-memory
// state (banner reappears each load) if localStorage is unavailable —
// private browsing, disabled storage, etc. — rather than throwing.

import type { ConsentCategory, ConsentState } from "./types";

const STORAGE_KEY = "aorane_consent_v1";

const DEFAULT_STATE: ConsentState = {
  necessary: true,
  analytics: false,
  marketing: false,
  preferences: false,
};

interface StoredConsent {
  state: ConsentState;
  respondedAt: string;
}

type Listener = (state: ConsentState) => void;

function readStorage(): StoredConsent | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConsent;
    if (!parsed || typeof parsed !== "object" || !parsed.state) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStorage(value: StoredConsent): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage unavailable/full — consent choice simply won't persist across
    // reloads. Not fatal: the banner will just show again next time.
  }
}

class ConsentManager {
  private state: ConsentState;
  private responded: boolean;
  private listeners = new Set<Listener>();

  constructor() {
    const stored = readStorage();
    this.state = stored?.state ?? { ...DEFAULT_STATE };
    this.responded = Boolean(stored);
  }

  get(): ConsentState {
    return { ...this.state };
  }

  isGranted(category: ConsentCategory): boolean {
    return this.state[category] === true;
  }

  hasResponded(): boolean {
    return this.responded;
  }

  set(next: Partial<ConsentState>): void {
    this.state = { ...this.state, ...next, necessary: true };
    this.responded = true;
    writeStorage({ state: this.state, respondedAt: new Date().toISOString() });
    this.listeners.forEach((listener) => listener(this.get()));
  }

  acceptAll(): void {
    this.set({ analytics: true, marketing: true, preferences: true });
  }

  rejectAll(): void {
    this.set({ analytics: false, marketing: false, preferences: false });
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

// One instance per page — every destination and the banner itself reads
// through this same object, so a change in one place is immediately
// reflected everywhere without extra wiring.
export const consent = new ConsentManager();
