import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/version", (_req, res) => {
  res.json({ version: "2.1.0", build: "2026-04-14", status: "ok" });
});

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

app.get("/api/db-debug", async (_req, res) => {
  const url = process.env.DATABASE_URL || "NOT SET";
  const host = url.match(/@([^:\/]+)/)?.[1] || "unknown";
  try {
    const { pool } = await import("@workspace/db");
    const result = await pool.query("SELECT current_database() as db, NOW() as time");
    res.json({ status: "connected", host, db: result.rows[0].db });
  } catch (e) {
    res.json({ status: "error", host, error: (e as Error).message });
  }
});

app.use("/api", router);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler — always returns JSON, never empty body
app.use((err: Error, _req: import("express").Request, res: import("express").Response, _next: import("express").NextFunction) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: err.message || "Internal server error" });
});

export default app;
