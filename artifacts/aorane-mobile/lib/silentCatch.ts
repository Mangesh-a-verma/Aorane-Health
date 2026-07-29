/**
 * Central place for logging errors that we deliberately choose not to
 * surface to the user (fire-and-forget background operations: haptics,
 * token refresh, cache writes, analytics, etc).
 *
 * Why this exists (Phase 1 — Silent Failures Fix):
 * Previously these call sites used `.catch(() => {})`, which swallows
 * errors completely — including real bugs. Routing them through one
 * function means:
 *   1. We get dev-time visibility via console.warn.
 *   2. When Sentry is added (Phase 2), we only need to wire it up HERE
 *      once, instead of touching 40+ call sites again.
 *
 * Usage:
 *   somePromise().catch((e) => logSilentError('token-refresh', e));
 */
export function logSilentError(context: string, error: unknown): void {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.warn(`[silent:${context}]`, error);
  }
  // Phase 2 TODO: Sentry.captureException(error, { tags: { context } });
}
