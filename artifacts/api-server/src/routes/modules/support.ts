import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../../middlewares/user-auth";
import { requireAdmin } from "../../middlewares/admin-auth";
import type { AuthRequest } from "../../middlewares/user-auth";
import { logger } from "../../lib/logger";

// ── Push Notification Helpers (no SDK needed — uses Expo HTTP API) ────────────
// ttlSeconds: how long FCM should hold the notification for offline devices
//   blood emergencies → 3600 (1 hour) — stale alerts useless after that
//   general          → 86400 (24 hours, Expo default)
export async function sendExpoPushNotifications(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
  ttlSeconds = 86400,
): Promise<void> {
  if (!tokens.length) return;
  const messages = tokens.filter(t => t.startsWith("ExponentPushToken[")).map(token => ({
    to: token,
    title,
    body,
    data: data || {},
    sound: "default",
    priority: "high",
    ttl: ttlSeconds,
  }));
  if (!messages.length) return;

  // 30-second hard timeout — prevents fire-and-forget from hanging indefinitely
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(messages),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`Expo Push API ${res.status}: ${errBody}`);
    }
    const result = await res.json().catch(() => null) as { data?: Array<{ status: string; message?: string }> } | null;
    if (result?.data) {
      const failed = result.data
        .filter(r => r.status === "error");
      if (failed.length) {
        logger.warn({ count: failed.length, messages: failed.map(f => f.message).join(", ") }, "Push tokens failed");
      }
    }
  } catch (e) {
    clearTimeout(timeoutId);
    if ((e as Error)?.name === "AbortError") {
      logger.error({ tokens: tokens.length }, "sendExpoPushNotifications: 30s timeout exceeded");
    } else {
      logger.error({ err: e }, "sendExpoPushNotifications error");
    }
  }
}

export async function getTokensForUsers(userIds: string[]): Promise<string[]> {
  if (!userIds.length) return [];
  const placeholders = userIds.map((_, i) => `$${i + 1}`).join(",");
  const r = await pool.query(`SELECT token FROM push_tokens WHERE user_id IN (${placeholders})`, userIds);
  return r.rows.map((row: { token: string }) => row.token);
}

const router = Router();

// ── POST /users/push-token — Register Expo push token ────────────────────────
router.post("/users/push-token", requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.userId!;
    const { token, platform = "unknown" } = req.body as { token: string; platform?: string };
    if (!token?.startsWith("ExponentPushToken[")) {
      res.status(400).json({ error: "Invalid Expo push token" });
      return;
    }
    await pool.query(
      `INSERT INTO push_tokens (user_id, token, platform, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, token) DO UPDATE SET updated_at = NOW()`,
      [uid, token, platform]
    );
    res.json({ success: true });
  } catch (e) {
    req.log.error({ err: e }, "push token error");
    res.status(500).json({ error: "Failed to save push token" });
  }
});

// ── POST /support/ticket — Submit complaint/help request (user) ───────────────
router.post("/support/ticket", requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.userId!;
    const { category = "general", subject, message, priority = "normal" } = req.body as {
      category?: string; subject: string; message: string; priority?: string;
    };

    if (!subject?.trim() || !message?.trim()) {
      res.status(400).json({ error: "Subject and message are required" });
      return;
    }
    if (subject.length > 200) { res.status(400).json({ error: "Subject too long (max 200 chars)" }); return; }
    if (message.length > 2000) { res.status(400).json({ error: "Message too long (max 2000 chars)" }); return; }

    const VALID_CATEGORIES = ["general", "technical", "payment", "account", "feedback", "bug", "other"];
    const VALID_PRIORITIES = ["low", "normal", "high", "urgent"];
    const cat = VALID_CATEGORIES.includes(category) ? category : "general";
    const pri = VALID_PRIORITIES.includes(priority) ? priority : "normal";

    const profileRes = await pool.query(
      `SELECT up.full_name, up.aorane_id, u.email, u.phone
       FROM user_profiles up JOIN users u ON u.id = up.user_id
       WHERE u.id = $1 LIMIT 1`,
      [uid]
    );
    const p = profileRes.rows[0] || {};

    const r = await pool.query(
      `INSERT INTO support_tickets
         (user_id, category, subject, message, priority, user_name, user_email, user_phone, aorane_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id, created_at`,
      [uid, cat, subject.trim(), message.trim(), pri, p.full_name || null, p.email || null, p.phone || null, p.aorane_id || null]
    );

    res.status(201).json({
      success: true,
      ticketId: r.rows[0].id,
      message: "Your complaint has been submitted. Our team will respond within 24 hours.",
    });
  } catch (e) {
    req.log.error({ err: e }, "support ticket error");
    res.status(500).json({ error: "Failed to submit ticket" });
  }
});

// ── GET /support/tickets/mine — User's own tickets ────────────────────────────
router.get("/support/tickets/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.userId!;
    const r = await pool.query(
      `SELECT id, category, subject, status, priority, created_at, admin_notes, resolved_at
       FROM support_tickets WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [uid]
    );
    res.json({ tickets: r.rows });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

// ── GET /admin/support-tickets — Admin: list all tickets ─────────────────────
router.get("/admin/support-tickets", requireAdmin, async (_req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, user_id, category, subject, message, status, priority,
              user_name, user_email, user_phone, aorane_id,
              admin_notes, created_at, updated_at, resolved_at
       FROM support_tickets ORDER BY created_at DESC LIMIT 200`
    );
    res.json({ tickets: r.rows, total: r.rowCount });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch support tickets" });
  }
});

// ── PATCH /admin/support-tickets/:id — Admin: update status/notes ────────────
router.patch("/admin/support-tickets/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_notes, priority } = req.body as {
      status?: string; admin_notes?: string; priority?: string;
    };
    const VALID_STATUSES = ["open", "in_progress", "resolved", "closed"];
    const updates: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;

    if (status && VALID_STATUSES.includes(status)) {
      updates.push(`status = $${idx++}`); vals.push(status);
      if (status === "resolved" || status === "closed") {
        updates.push(`resolved_at = NOW()`);
      }
    }
    if (admin_notes !== undefined) { updates.push(`admin_notes = $${idx++}`); vals.push(admin_notes); }
    if (priority)                  { updates.push(`priority = $${idx++}`);     vals.push(priority); }
    updates.push(`updated_at = NOW()`);
    vals.push(id);

    await pool.query(
      `UPDATE support_tickets SET ${updates.join(", ")} WHERE id = $${idx}`,
      vals
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to update ticket" });
  }
});

export default router;
