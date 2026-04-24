import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Config status — for deployment verification (does NOT expose actual key values)
router.get("/config-status", (_req, res) => {
  res.json({
    googleFit: {
      clientIdSet: Boolean(process.env.GOOGLE_FIT_CLIENT_ID),
      clientSecretSet: Boolean(process.env.GOOGLE_FIT_CLIENT_SECRET),
    },
    razorpay: { keyIdSet: Boolean(process.env.RAZORPAY_KEY_ID) },
    resend: { apiKeySet: Boolean(process.env.RESEND_API_KEY) },
    nvidia: { apiKeySet: Boolean(process.env.NVIDIA_API_KEY) },
    database: { urlSet: Boolean(process.env.SUPABASE_DATABASE_URL) },
    appUrl: process.env.APP_URL || "(not set — defaulting to https://api.aorane.com)",
    apiBaseUrl: process.env.API_BASE_URL || "(not set — defaulting to https://aorane.onrender.com/api)",
  });
});

export default router;
