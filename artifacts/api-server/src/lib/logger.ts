import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});

/**
 * safeErrorMessage — the CLIENT-FACING equivalent of what app.ts's global
 * error handler already does (`process.env.NODE_ENV === "production" ?
 * "Internal server error" : err.message`). Several individual route
 * handlers were putting the raw `err.message` straight into their JSON
 * response's `detail`/`cause` field, bypassing that production guard
 * entirely — this leaked internal DB/driver error text to any caller
 * regardless of environment. Use this ONLY for what goes into the HTTP
 * response; server-side logging (`logger.error`/`req.log.error`) should
 * keep logging the raw error/message as before, unredacted.
 */
export function safeErrorMessage(err: unknown): string {
  if (isProduction) return "Internal error";
  return err instanceof Error ? err.message : String(err);
}
