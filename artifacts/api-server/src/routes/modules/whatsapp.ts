/**
 * WhatsApp Bot Integration — COMING SOON
 *
 * Backend structure is ready. Full implementation scheduled for next month.
 * Admin can view and configure settings; bot is not yet live.
 *
 * Planned features:
 * - Inbound: User sends food/exercise/water via WhatsApp → Gemini parses → logs to DB
 * - Outbound: Meal reminders, medicine alerts, exercise nudges, weekly reports
 * - Pro Plan exclusive feature
 */

import { Router } from "express";
import { requireAuth } from "../../middlewares/user-auth";
import { requireAdmin } from "../../middlewares/admin-auth";
import type { AuthRequest } from "../../middlewares/user-auth";
import type { AdminRequest } from "../../middlewares/admin-auth";

const router = Router();

const COMING_SOON_RESPONSE = {
  status: "coming_soon",
  feature: "WhatsApp Bot Integration",
  message: "Yeh feature abhi development mein hai. Jald aa raha hai!",
  expectedLaunch: "Q2 2026",
  plan: "pro",
};

router.get("/whatsapp/status", (_req, res) => {
  res.json({
    ...COMING_SOON_RESPONSE,
    botActive: false,
    webhookConfigured: false,
    subscribedUsers: 0,
  });
});

router.post("/whatsapp/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    res.status(200).send(challenge);
    return;
  }
  res.status(200).json({ received: true, status: "queued_for_processing" });
});

router.get("/whatsapp/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    res.status(200).send(challenge);
    return;
  }
  res.status(403).json({ error: "Verification failed" });
});

router.post("/whatsapp/subscribe", requireAuth, async (_req: AuthRequest, res) => {
  res.status(503).json({
    ...COMING_SOON_RESPONSE,
    error: "Subscription not yet available. Feature launching soon!",
  });
});

router.delete("/whatsapp/unsubscribe", requireAuth, async (_req: AuthRequest, res) => {
  res.status(503).json(COMING_SOON_RESPONSE);
});

router.get("/whatsapp/subscription", requireAuth, async (_req: AuthRequest, res) => {
  res.json({
    subscribed: false,
    status: "coming_soon",
    message: "WhatsApp bot feature launching soon for Pro plan users!",
  });
});

router.put("/whatsapp/preferences", requireAuth, async (_req: AuthRequest, res) => {
  res.status(503).json(COMING_SOON_RESPONSE);
});

router.get("/whatsapp/message-history", requireAuth, async (_req: AuthRequest, res) => {
  res.json({
    messages: [],
    total: 0,
    status: "coming_soon",
  });
});

router.get("/admin/whatsapp/config", requireAdmin, async (_req: AdminRequest, res) => {
  res.json({
    config: {
      isEnabled: false,
      provider: "aisensy",
      businessPhoneNumber: null,
      webhookConfigured: false,
      mealReminderEnabled: true,
      medicineReminderEnabled: true,
      exerciseReminderEnabled: true,
      weeklyReportEnabled: true,
      breakfastReminderTime: "08:00",
      lunchReminderTime: "13:00",
      dinnerReminderTime: "20:00",
      medicineReminderTimes: "08:00,14:00,21:00",
      weeklyReportDay: "sunday",
      weeklyReportTime: "09:00",
      maxMessagesPerUserPerDay: 5,
    },
    stats: {
      totalSubscribed: 0,
      activeSubscriptions: 0,
      totalMessagesSentToday: 0,
      totalMessagesReceivedToday: 0,
      deliveryRate: null,
    },
    status: "coming_soon",
    expectedLaunch: "Q2 2026",
  });
});

router.put("/admin/whatsapp/config", requireAdmin, async (_req: AdminRequest, res) => {
  res.status(503).json({
    ...COMING_SOON_RESPONSE,
    message: "Configuration will be live when WhatsApp bot launches.",
  });
});

router.get("/admin/whatsapp/stats", requireAdmin, async (_req: AdminRequest, res) => {
  res.json({
    subscribedUsers: 0,
    messagesSentToday: 0,
    messagesReceivedToday: 0,
    deliveryRate: null,
    topMessageTypes: [],
    status: "coming_soon",
  });
});

router.get("/admin/whatsapp/templates", requireAdmin, async (_req: AdminRequest, res) => {
  res.json({
    templates: [
      { name: "meal_reminder_breakfast", type: "meal_reminder", status: "draft", language: "hi", body: "Namaste {{name}}! Aaj ka breakfast track karo 🌅 Kal aapne {{calories}} kcal liye the." },
      { name: "meal_reminder_lunch", type: "meal_reminder", status: "draft", language: "hi", body: "{{name}} bhai/didi, lunch mein kya khaya? Ek line mein batao! 🍱" },
      { name: "meal_reminder_dinner", type: "meal_reminder", status: "draft", language: "hi", body: "Raat ka khana track karo {{name}}! Aaj ka score: {{health_score}}/100 🌙" },
      { name: "medicine_reminder", type: "medicine_reminder", status: "draft", language: "hi", body: "💊 {{name}}, {{medicine_name}} lene ka time ho gaya! Dose: {{dose}}" },
      { name: "exercise_reminder", type: "exercise_reminder", status: "draft", language: "hi", body: "{{name}}, aaj exercise nahi ki abhi tak 💪 30 min walk bhi kaafi hai!" },
      { name: "weekly_report", type: "weekly_report", status: "draft", language: "hi", body: "📊 {{name}} ki weekly health report:\n✅ Avg calories: {{avg_cal}} kcal\n💪 Exercise: {{exercise_days}} din\n💧 Water: {{avg_water}} glasses\n🏆 Health Score: {{health_score}}/100" },
    ],
    status: "coming_soon",
  });
});

export default router;
