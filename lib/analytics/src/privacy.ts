// ─── Privacy filter ────────────────────────────────────────────────────────
//
// This is the boundary the rest of the codebase relies on: whatever calls
// track() might one day pass something it shouldn't (a copy-pasted prop
// name, a field added to a form and forwarded without thinking), and this
// is the last line of defence before it reaches Google/Meta/LinkedIn/Clarity.
//
// Two checks:
//  1. Key denylist — property names that are health/medical/PII by
//     definition get dropped regardless of their value.
//  2. Value scan — even under an innocuous key name, a value that looks
//     like an email, phone number, or long free-text string gets dropped,
//     since marketing events should only ever carry short categorical data
//     (plan names, button ids, page paths) — never user-entered content.

import type { EventProperties } from "./types";

// Substring match, case-insensitive, against the property key.
const DENYLISTED_KEY_PATTERNS = [
  "health", "medical", "diagnosis", "medicine", "medication", "prescription",
  "bmi", "weight", "height", "sleep", "stress", "period", "pregnan",
  "blood", "symptom", "condition", "allergy", "disease", "report",
  "food", "diet", "calorie", "exercise", "vital",
  "email", "phone", "mobile", "password", "otp", "dob", "birth",
  "address", "gstin", "pan", "aadhaar",
];

// A value matching any of these looks like it's carrying free-text/PII
// rather than a short categorical label, regardless of what key it's under.
const SUSPICIOUS_VALUE_PATTERNS: RegExp[] = [
  /@/, // email-shaped
  /\d{6,}/, // long digit runs (phone numbers, OTPs, IDs)
];

const MAX_STRING_VALUE_LENGTH = 100;

function isDenylistedKey(key: string): boolean {
  const lower = key.toLowerCase();
  return DENYLISTED_KEY_PATTERNS.some((pattern) => lower.includes(pattern));
}

function isSuspiciousValue(value: string): boolean {
  if (value.length > MAX_STRING_VALUE_LENGTH) return true;
  return SUSPICIOUS_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Returns a filtered copy of the event properties with any disallowed key
 * or suspicious value removed. Never throws — worst case, it returns an
 * empty object and the event still fires with just its name.
 */
export function sanitizeEventProperties(properties: EventProperties | undefined): EventProperties {
  if (!properties) return {};
  const clean: EventProperties = {};
  for (const [key, value] of Object.entries(properties)) {
    if (value === undefined) continue;
    if (isDenylistedKey(key)) continue;
    if (typeof value === "string" && isSuspiciousValue(value)) continue;
    clean[key] = value;
  }
  return clean;
}
