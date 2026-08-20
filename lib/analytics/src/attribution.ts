// ─── Attribution capture ──────────────────────────────────────────────────
//
// Reads UTM params + click IDs off the current URL (if present) and keeps
// two snapshots in localStorage:
//   - firstTouch: written once, on the very first visit that carried
//     campaign context. Never overwritten — answers "what originally
//     brought this person here".
//   - lastTouch: overwritten every time a new visit arrives with campaign
//     context. Answers "what most recently brought them back".
//
// This runs independently of consent — capturing which URL someone landed
// on is first-party bookkeeping about the visit itself, not a third-party
// tracker, and it needs to already be sitting in storage by the time
// someone submits a form so the app has something to attach. It is never
// sent anywhere on its own; sendAttribution() below is what enquiry/
// registration forms call to attach the current snapshot to their payload,
// and *that* still goes through consent-gated destinations for anything
// forwarded to GA4/Meta/etc.

import type { AttributionData, AttributionSnapshot } from "./types";

const FIRST_TOUCH_KEY = "aorane_attribution_first";
const LAST_TOUCH_KEY = "aorane_attribution_last";

const UTM_PARAMS: Array<[keyof AttributionSnapshot, string]> = [
  ["utmSource", "utm_source"],
  ["utmMedium", "utm_medium"],
  ["utmCampaign", "utm_campaign"],
  ["utmTerm", "utm_term"],
  ["utmContent", "utm_content"],
  ["gclid", "gclid"],
  ["fbclid", "fbclid"],
];

function readSnapshot(key: string): AttributionSnapshot | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as AttributionSnapshot) : null;
  } catch {
    return null;
  }
}

function writeSnapshot(key: string, snapshot: AttributionSnapshot): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(snapshot));
  } catch {
    // No persistence available — attribution just won't survive a reload.
  }
}

function captureFromCurrentUrl(): AttributionSnapshot | null {
  const params = new URLSearchParams(window.location.search);
  const snapshot: AttributionSnapshot = {};
  let hasAny = false;
  for (const [field, param] of UTM_PARAMS) {
    const value = params.get(param);
    if (value) {
      snapshot[field] = value;
      hasAny = true;
    }
  }
  if (!hasAny) return null;
  if (document.referrer) snapshot.referrer = document.referrer;
  snapshot.landingPage = window.location.origin + window.location.pathname;
  snapshot.capturedAt = new Date().toISOString();
  return snapshot;
}

/**
 * Call once per page load. No-op if the current URL carries no campaign
 * params — an organic/direct visit doesn't overwrite an existing lastTouch.
 */
export function captureAttribution(): void {
  const snapshot = captureFromCurrentUrl();
  if (!snapshot) return;
  if (!readSnapshot(FIRST_TOUCH_KEY)) {
    writeSnapshot(FIRST_TOUCH_KEY, snapshot);
  }
  writeSnapshot(LAST_TOUCH_KEY, snapshot);
}

/** Current stored attribution, to attach to an enquiry/registration payload. */
export function getAttribution(): AttributionData {
  const firstTouch = readSnapshot(FIRST_TOUCH_KEY) ?? undefined;
  const lastTouch = readSnapshot(LAST_TOUCH_KEY) ?? undefined;
  return { firstTouch, lastTouch };
}
