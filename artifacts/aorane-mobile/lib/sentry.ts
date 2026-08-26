import * as Sentry from "@sentry/react-native";
import type { ErrorEvent, Breadcrumb } from "@sentry/react-native";

/**
 * Crash/error reporting — previously nonexistent (see lib/silentCatch.ts's
 * old "Phase 2 TODO: Sentry" comment). Deliberately a thin, defensive
 * wrapper rather than calling the Sentry SDK directly from call sites:
 *
 *  - No EXPO_PUBLIC_SENTRY_DSN set → initSentry() is a no-op and
 *    captureSilentError() never touches the SDK. Nothing breaks for anyone
 *    who hasn't created a Sentry project yet; this ships dark until a DSN
 *    is configured (EAS secret or .env), see .env.example.
 *  - Any failure inside Sentry itself (bad DSN, SDK bug, no network) must
 *    never crash the app or block startup — everything here is wrapped.
 *
 * PRIVACY: this app handles health data, so what leaves the device via
 * Sentry matters as much as what leaves it via lib/analytics does on the
 * web side (see that package's privacy.ts — same problem, same fix
 * shape). Nothing here calls Sentry.setUser(), so no phone/email/user-id
 * is ever attached. sendDefaultPii is explicitly false (don't rely on the
 * SDK default). scrubText() below strips anything email- or long-digit-
 * shaped (phone numbers, OTPs) from every exception message and breadcrumb
 * before it leaves the device — the same shape of check
 * lib/analytics/src/privacy.ts uses for marketing events. This is a
 * best-effort net, not a guarantee: an error message that happens to spell
 * out something sensitive in plain words (not email/digit-shaped) would
 * still pass through. Never enable session replay or screenshot-on-error
 * for this app — either would capture literal on-screen health data.
 */

const SUSPICIOUS_VALUE_PATTERNS: RegExp[] = [
  /[\w.+-]+@[\w-]+\.[\w.-]+/g, // email-shaped
  /\d{6,}/g, // long digit runs — phone numbers, OTPs, IDs
];

function scrubText(value: string | undefined): string | undefined {
  if (!value) return value;
  let out = value;
  for (const pattern of SUSPICIOUS_VALUE_PATTERNS) {
    out = out.replace(pattern, "[redacted]");
  }
  return out;
}

function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  return {
    ...breadcrumb,
    message: scrubText(breadcrumb.message),
    // Breadcrumb `data` is a free-form object (e.g. HTTP breadcrumbs carry
    // { url, method, status_code }) — scrub only string values, leave
    // numbers/booleans (status codes, durations) alone.
    data: breadcrumb.data
      ? Object.fromEntries(
          Object.entries(breadcrumb.data).map(([k, v]) => [k, typeof v === "string" ? scrubText(v) : v]),
        )
      : breadcrumb.data,
  };
}

function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.message) event.message = scrubText(event.message);
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (ex.value) ex.value = scrubText(ex.value);
    }
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb);
  }
  return event;
}

let initialized = false;

export function initSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  try {
    Sentry.init({
      dsn,
      environment: __DEV__ ? "development" : "production",
      // Conservative default — trace volume can be tuned up once there's
      // an actual Sentry project to look at the data in.
      tracesSampleRate: 0.2,
      // Explicit, not relying on the SDK default: never attach IP address,
      // cookies, or request bodies to events.
      sendDefaultPii: false,
      beforeSend: (event) => scrubEvent(event),
      beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
    });
    initialized = true;
  } catch {
    // Sentry failing to init must never block app startup.
  }
}

/** Called from lib/silentCatch.ts's logSilentError — see that file. */
export function captureSilentError(context: string, error: unknown): void {
  if (!initialized) return;
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    Sentry.captureException(err, { tags: { context } });
  } catch {
    // Error reporting itself must never throw.
  }
}
