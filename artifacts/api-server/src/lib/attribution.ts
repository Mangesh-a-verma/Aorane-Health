// ─── Marketing attribution sanitizer ──────────────────────────────────────
//
// The web apps (landing, business-portal) capture UTM params, click IDs and
// referrer data client-side and send a snapshot of it along with enquiries
// and business registrations. That snapshot is untrusted input like any
// other request body: a visitor can set utm_campaign to anything in the
// URL bar, so before it reaches the database we clamp field lengths, drop
// anything that isn't one of the known attribution keys, and strip control
// characters. capturedAt is never taken from the client — the server clock
// is authoritative so a tampered timestamp can't misrepresent when a touch
// actually happened.
//
// This is intentionally the only place attribution payloads are validated.
// Every route that accepts attribution (enquiries, business registration)
// should go through here rather than inserting req.body straight into a
// jsonb column.

import type { AttributionData, AttributionSnapshot } from "@workspace/db/schema";

const MAX_FIELD_LENGTH = 300;

// Strip control characters (incl. newlines used for header injection in
// downstream emails/logs) and clamp length. Doesn't attempt HTML escaping —
// this is stored data, not raw output; callers rendering it (e.g. admin
// panel) are responsible for escaping at render time like any other field.
function cleanString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  // eslint-disable-next-line no-control-regex
  const stripped = value.replace(/[\x00-\x1F\x7F]/g, "").trim();
  if (!stripped) return undefined;
  return stripped.slice(0, MAX_FIELD_LENGTH);
}

const SNAPSHOT_KEYS: Array<keyof AttributionSnapshot> = [
  "utmSource", "utmMedium", "utmCampaign", "utmTerm", "utmContent",
  "gclid", "fbclid", "referrer", "landingPage",
];

function sanitizeSnapshot(input: unknown): AttributionSnapshot | undefined {
  if (!input || typeof input !== "object") return undefined;
  const record = input as Record<string, unknown>;
  const out: AttributionSnapshot = {};
  let hasAny = false;
  for (const key of SNAPSHOT_KEYS) {
    const cleaned = cleanString(record[key]);
    if (cleaned) {
      out[key] = cleaned;
      hasAny = true;
    }
  }
  if (!hasAny) return undefined;
  // Server time, not client time — see file header.
  out.capturedAt = new Date().toISOString();
  return out;
}

/**
 * Validate and clamp a client-submitted attribution payload down to the
 * known { firstTouch, lastTouch } shape. Returns undefined (not stored)
 * when there's nothing usable — most enquiries won't have campaign context
 * and that's fine, the column is nullable.
 */
export function sanitizeAttribution(input: unknown): AttributionData | undefined {
  if (!input || typeof input !== "object") return undefined;
  const record = input as Record<string, unknown>;
  const firstTouch = sanitizeSnapshot(record.firstTouch);
  const lastTouch = sanitizeSnapshot(record.lastTouch);
  if (!firstTouch && !lastTouch) return undefined;
  return { firstTouch, lastTouch };
}
