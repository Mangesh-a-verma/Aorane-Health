import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
import { startSubscriptionExpiryJob } from "./jobs/subscription-expiry";
import { startExpiryReminderJob } from "./jobs/expiry-reminders";
import { startMonthlyHealthSummaryJob } from "./jobs/monthly-health-summary";
import { startWinBackJob } from "./jobs/win-back";

const app: Express = express();

// SECURITY-FIX: Strict whitelist of allowed domains to prevent unauthorized access.
const ALLOWED_ORIGINS: string[] = [
  "https://aorane.com",
  "https://www.aorane.com",
  "https://admin.aorane.com",
  "https://business.aorane.com"
];

if (process.env.ALLOWED_ORIGIN) {
  process.env.ALLOWED_ORIGIN.split(",")
    .map(s => s.trim())
    .filter(Boolean)
    .forEach(o => ALLOWED_ORIGINS.push(o));
}

if (process.env.NODE_ENV !== "production") {
  ALLOWED_ORIGINS.push("http://localhost:3000");
  ALLOWED_ORIGINS.push("http://localhost:8081");
  ALLOWED_ORIGINS.push("http://127.0.0.1:3000");
}

// SECURITY-FIX: Global Rate Limiting to prevent DDoS, brute-force, and API abuse.
// Limits each IP to 300 requests per 15 minutes.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per windowMs
  message: { error: "Too many requests from this IP, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all /api routes
app.use("/api", globalLimiter);

// Puraana custom logger wapas add kar diya gaya hai
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// SECURITY-FIX: Enabled CSP for better HTML protection
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
  }),
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      if (process.env.NODE_ENV !== "production" && (origin.endsWith('.vercel.app') || origin.endsWith('.onrender.com'))) {
        return callback(null, true);
      }
      logger.warn({ origin }, "CORS blocked an unauthorized origin attempt");
      // FIX OBS-3: tag this error so the global error handler below can
      // return 403 instead of a generic 500, and avoid re-logging it as an
      // "Unhandled error" (it's already logged as a warning above).
      const corsError = new Error(`CORS: origin ${origin} not allowed`) as Error & {
        status?: number;
        isCorsError?: boolean;
      };
      corsError.status = 403;
      corsError.isCorsError = true;
      callback(corsError);
    },
    credentials: true,
  }),
);

// SECURITY-FIX: Capture raw body BEFORE JSON parsing for Razorpay webhook signature verification.
// Webhook limit 2mb set hai
app.use("/api/webhooks/razorpay", express.raw({ type: "application/json", limit: "2mb" }));

// SECURITY-FIX H-11: Normal payload limits reduced from 20mb to 2mb to prevent OOM/DoS attacks
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// SECURITY-FIX: Request Timeout Protection. Terminates requests taking longer than 30 seconds.
app.use((req, res, next) => {
  req.setTimeout(30000, () => {
    logger.warn({ url: req.url }, "Request timed out");
    res.status(408).json({ error: "Request timeout" });
  });
  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/version", (_req, res) => {
  res.json({ version: "2.1.0", build: "2026-04-14", status: "ok" });
});

// Debug routes — Puraane saare routes wapas intact hain
if (process.env.NODE_ENV !== "production") {
  app.get("/api/sms-debug", (_req, res) => {
    const sid   = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from  = process.env.TWILIO_FROM_NUMBER;
    const fast2 = process.env.FAST2SMS_API_KEY;
    res.json({
      twilio: {
        sid:   sid   ? sid.slice(0, 6) + "***"   : "NOT SET",
        token: token ? token.slice(0, 4) + "***" : "NOT SET",
        from:  from  || "NOT SET",
        ready: !!(sid && token && from),
      },
      fast2sms: {
        key:   fast2 ? fast2.slice(0, 6) + "***" : "NOT SET",
        ready: !!fast2,
      },
    });
  });

  app.get("/api/tables-debug", async (_req, res) => {
    try {
      const { pool } = await import("@workspace/db");
      const tables = ["users","user_profiles","user_preferences","user_privacy_settings",
        "user_medical_conditions","user_health_goals","water_logs","food_logs",
        "exercise_logs","medicine_schedules","medicine_logs","otp_store"];
      const results: Record<string, string> = {};
      for (const t of tables) {
        try {
          const r = await pool.query(`SELECT COUNT(*) FROM "${t}" LIMIT 1`);
          results[t] = `ok (${r.rows[0].count} rows)`;
        } catch (e) {
          results[t] = `ERROR: ${(e as Error).message}`;
        }
      }
      res.json(results);
    } catch (e) {
      res.json({ error: (e as Error).message });
    }
  });

  app.get("/api/db-debug", async (_req, res) => {
    const url = process.env.DATABASE_URL || "NOT SET";
    const host = url.match(/@([^:/]+)/)?.[1] || "unknown";
    try {
      const { pool } = await import("@workspace/db");
      const result = await pool.query("SELECT current_database() as db, NOW() as time");
      res.json({ status: "connected", host, db: result.rows[0].db });
    } catch (e) {
      res.json({ status: "error", host, error: (e as Error).message });
    }
  });
}

app.use("/api", router);

// ── Render Free-Tier Keep-Alive ──────────────────────────────────────────────
// Render free plan sleeps the server after 15 minutes of inactivity.
// This self-ping prevents that, so users don't experience 30-60s cold starts.
//
// ✅ FIX: Removed the incorrect `process.env.NODE_ENV !== "production"` guard
// that was preventing this from running in production. This MUST run in
// production — that's exactly where Render's sleep behaviour applies.
// In development (local), RENDER_EXTERNAL_URL is typically not set, so
// the block won't execute anyway.
//
// Ping every 10 minutes — Render's sleep threshold is 15 minutes.
const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
if (RENDER_URL) {
  setInterval(() => {
    fetch(`${RENDER_URL}/health`, { signal: AbortSignal.timeout(5000) })
      .then(() => logger.debug("Keep-alive ping OK"))
      .catch(() => {}); // Silent — don't crash on network blip
  }, 10 * 60 * 1000); // every 10 minutes
  logger.info({ url: RENDER_URL }, "✅ Keep-alive ping scheduled (every 10 min) — Render sleep prevention active");
} else {
  logger.warn("RENDER_EXTERNAL_URL not set — keep-alive ping disabled. Set this env var on Render dashboard.");
}

setInterval(async () => {
  try {
    const result = await pool.query(
      `UPDATE blood_emergency_requests
       SET status = 'expired', updated_at = NOW()
       WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < NOW()`
    );
    if (result.rowCount && result.rowCount > 0) {
      logger.info({ count: result.rowCount }, "Blood requests auto-expired");
    }
  } catch (err) {
    logger.error({ err }, "Blood request expiry cleanup failed");
  }
}, 60 * 60 * 1000);
logger.info("Blood request expiry cleanup scheduled (every 1 hr)");

// Start daily subscription expiry background job
startSubscriptionExpiryJob();

// Start daily expiry reminders job
startExpiryReminderJob();

// Start monthly individual health summary job (1st of month, 8 AM IST)
startMonthlyHealthSummaryJob();

// Start daily win-back / re-engagement email job
startWinBackJob();

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err: Error & { status?: number; isCorsError?: boolean }, _req: import("express").Request, res: import("express").Response, _next: import("express").NextFunction) => {
  // FIX OBS-3: CORS rejections are expected, already-logged (warn level)
  // traffic, not server failures — don't relog them as "Unhandled error"
  // and return the correct 403 instead of a generic 500.
  if (err.isCorsError) {
    res.status(err.status ?? 403).json({ error: "Origin not allowed" });
    return;
  }
  logger.error({ err }, "Unhandled error");
  const message = process.env.NODE_ENV === "production" ? "Internal server error" : (err.message || "Internal server error");
  res.status(err.status ?? 500).json({ error: message });
});

export default app;