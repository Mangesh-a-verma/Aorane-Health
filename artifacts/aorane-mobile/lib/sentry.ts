import * as Sentry from "@sentry/react-native";

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
 */

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
