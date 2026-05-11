import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { runStartupMigrations } from "./lib/migrate";
import { pool } from "@workspace/db";

// Run DB migrations at startup (adds missing columns safely)
runStartupMigrations().catch((e) => logger.error({ err: e }, "Startup migration failed"));

const app: Express = express();

const ALLOWED_ORIGINS = [
  /\.vercel\.app$/,
  /\.railway\.app$/,
  /\.onrender\.com$/,
  /localhost/,
  /127\.0\.0\.1/,
  /replit\.dev$/,
  /replit\.app$/,
  /aorane\.com$/,
  /aorane\.in$/,
];

if (process.env.ALLOWED_ORIGIN) {
  ALLOWED_ORIGINS.push(new RegExp(process.env.ALLOWED_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

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
        return {
          statusCode: res.statusCode,
        };
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
      const allowed = ALLOWED_ORIGINS.some((pattern) => pattern.test(origin));
      if (allowed) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  }),
);

// SECURITY-FIX C2: Capture raw body BEFORE JSON parsing for webhook signature verification.
// Razorpay signs the original raw bytes — re-stringified JSON does not match.
app.use("/api/webhooks/razorpay", express.raw({ type: "application/json", limit: "2mb" }));

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

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

// Render keep-alive: ping self every 10 min to prevent free-tier spin-down
const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
if (RENDER_URL) {
  setInterval(() => {
    fetch(`${RENDER_URL}/health`).catch(() => {});
  }, 10 * 60 * 1000);
  logger.info({ url: RENDER_URL }, "Keep-alive ping scheduled (every 10 min)");
}

// Blood request expiry cleanup — every hour
// Marks status = 'expired' for all active requests past their expires_at
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

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler — never leaks internal details in production
app.use((err: Error, _req: import("express").Request, res: import("express").Response, _next: import("express").NextFunction) => {
  logger.error({ err }, "Unhandled error");
  const message = process.env.NODE_ENV === "production" ? "Internal server error" : (err.message || "Internal server error");
  res.status(500).json({ error: message });
});

export default app;
