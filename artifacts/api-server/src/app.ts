import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

const app: Express = express();

// SECURITY-FIX: Strict whitelist of allowed domains to prevent unauthorized access.
const ALLOWED_ORIGINS: string[] = [
  "https://aorane.com",
  "https://www.aorane.com",
  "https://admin.aorane.com",
  "https://business.aorane.com"
];

if (process.env.ALLOWED_ORIGIN) {
  ALLOWED_ORIGINS.push(process.env.ALLOWED_ORIGIN);
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

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
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
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  }),
);

// SECURITY-FIX: Capture raw body BEFORE JSON parsing for Razorpay webhook signature verification.
app.use("/api/webhooks/razorpay", express.raw({ type: "application/json", limit: "2mb" }));

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

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

// Debug routes — only available in development mode
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

// PERFORMANCE-FIX: Render keep-alive ping is now disabled in production to save resources.
const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
if (RENDER_URL && process.env.NODE_ENV !== "production") {
  setInterval(() => {
    fetch(`${RENDER_URL}/health`).catch(() => {});
  }, 10 * 60 * 1000);
  logger.info({ url: RENDER_URL }, "Keep-alive ping scheduled (every 10 min)");
}

// NOTE: This periodic cleanup is suitable for a single-instance MVP.
// For multi-instance production environments, this should be migrated to a dedicated cron worker.
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

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err: Error, _req: import("express").Request, res: import("express").Response, _next: import("express").NextFunction) => {
  logger.error({ err }, "Unhandled error");
  const message = process.env.NODE_ENV === "production" ? "Internal server error" : (err.message || "Internal server error");
  res.status(500).json({ error: message });
});

export default app;