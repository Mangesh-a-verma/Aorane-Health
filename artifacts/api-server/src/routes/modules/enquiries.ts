import { Router, type IRouter } from "express";
import { db, enquiriesTable, companySettingsTable } from "@workspace/db";
import { desc, eq, sql } from "drizzle-orm";
import { Resend } from "resend";
import { requireAdmin, type AdminRequest } from "../../middlewares/admin-auth";

const router: IRouter = Router();

// ─── In-memory OTP store (email → {otp, expires}) ────────────────────────────
const otpStore = new Map<string, { otp: string; expires: number }>();

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function cleanExpiredOtps() {
  const now = Date.now();
  for (const [key, val] of otpStore.entries()) {
    if (now > val.expires) otpStore.delete(key);
  }
}

async function getSupportEmail(): Promise<string> {
  try {
    const rows = await db.select({ supportEmail: companySettingsTable.supportEmail }).from(companySettingsTable).limit(1);
    return rows[0]?.supportEmail || "support@aorane.com";
  } catch {
    return "support@aorane.com";
  }
}

async function sendEnquiryEmail(e: {
  type: string; name: string; email: string; mobile?: string | null; city?: string | null;
  accountType?: string | null; companyName?: string | null; message?: string | null; source?: string | null;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.warn("[enquiries] RESEND_API_KEY missing — skip email"); return; }
  try {
    const resend = new Resend(apiKey);
    const to = await getSupportEmail();
    const typeLabel = e.type === "expert" ? "Talk to Expert"
      : e.type === "investor_deck" ? "Investor Deck Download"
      : e.type === "notify_me" ? "Notify Me Lead"
      : "General Enquiry";

    // Parse age/gender from message for notify_me leads
    let extraRows = "";
    if (e.type === "notify_me" && e.message) {
      try {
        const parsed = JSON.parse(e.message);
        if (parsed.age) extraRows += `<tr><td style="padding:8px 0;color:#6b7280;width:120px">Age</td><td style="padding:8px 0;font-weight:600">${parsed.age}</td></tr>`;
        if (parsed.gender) extraRows += `<tr><td style="padding:8px 0;color:#6b7280">Gender</td><td style="padding:8px 0;font-weight:600">${parsed.gender}</td></tr>`;
        if (parsed.feature) extraRows += `<tr><td style="padding:8px 0;color:#6b7280">Feature</td><td style="padding:8px 0;font-weight:600">${parsed.feature}</td></tr>`;
      } catch {}
    }

    const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
      <div style="background:linear-gradient(135deg,#0077B6,#1B998B);padding:24px;border-radius:12px 12px 0 0;color:#fff">
        <h2 style="margin:0;font-size:20px">New ${typeLabel}</h2>
        <p style="margin:4px 0 0;opacity:.85;font-size:13px">Source: ${e.source || "website"}</p>
      </div>
      <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 12px 12px">
        <table style="width:100%;border-collapse:collapse;font-size:14px;color:#1f2937">
          <tr><td style="padding:8px 0;color:#6b7280;width:120px">Name</td><td style="padding:8px 0;font-weight:600">${e.name}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Email</td><td style="padding:8px 0"><a href="mailto:${e.email}" style="color:#0077B6">${e.email}</a></td></tr>
          ${e.mobile ? `<tr><td style="padding:8px 0;color:#6b7280">Mobile</td><td style="padding:8px 0"><a href="tel:${e.mobile}" style="color:#0077B6">${e.mobile}</a></td></tr>` : ""}
          ${e.city ? `<tr><td style="padding:8px 0;color:#6b7280">City</td><td style="padding:8px 0">${e.city}</td></tr>` : ""}
          ${extraRows}
          ${e.accountType ? `<tr><td style="padding:8px 0;color:#6b7280">Type</td><td style="padding:8px 0">${e.accountType}${e.companyName ? ` — ${e.companyName}` : ""}</td></tr>` : ""}
          ${(e.type !== "notify_me" && e.message) ? `<tr><td style="padding:8px 0;color:#6b7280;vertical-align:top">Message</td><td style="padding:8px 0;white-space:pre-wrap">${e.message}</td></tr>` : ""}
        </table>
        <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:12px">View & manage in Admin Panel → Enquiries</p>
      </div>
    </div>`;
    await resend.emails.send({
      from: "Aorane <support@aorane.com>",
      to: [to],
      replyTo: e.email,
      subject: `[Aorane] ${typeLabel} — ${e.name}`,
      html,
    });
  } catch (err) {
    console.error("[enquiries] email send failed:", err);
  }
}

// ─── Public: Send OTP to email ────────────────────────────────────────────────
router.post("/leads/send-otp", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      res.status(400).json({ error: "Valid email required" });
      return;
    }

    cleanExpiredOtps();

    // Rate limit: max 3 OTPs per email per 10 minutes
    const existing = otpStore.get(email.toLowerCase());
    if (existing && existing.expires - Date.now() > 9 * 60 * 1000) {
      res.status(429).json({ error: "OTP pehle se bheja gaya hai — 1 minute baad try karo" });
      return;
    }

    const otp = generateOtp();
    otpStore.set(email.toLowerCase(), { otp, expires: Date.now() + 10 * 60 * 1000 });

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      // Dev mode: log OTP
      console.log(`[enquiries] DEV OTP for ${email}: ${otp}`);
      res.json({ success: true, devOtp: process.env.NODE_ENV !== "production" ? otp : undefined });
      return;
    }

    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: "Aorane <support@aorane.com>",
      to: [email],
      subject: "Aorane — Aapka OTP Code",
      html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px">
        <div style="background:linear-gradient(135deg,#0747A6,#1565C0);padding:24px;border-radius:12px 12px 0 0;color:#fff;text-align:center">
          <h2 style="margin:0;font-size:22px">Aapka OTP Code</h2>
          <p style="margin:6px 0 0;opacity:.8;font-size:13px">Aorane Early Access Registration</p>
        </div>
        <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:32px;border-radius:0 0 12px 12px;text-align:center">
          <div style="font-size:42px;font-weight:900;letter-spacing:0.2em;color:#0747A6;margin:16px 0">${otp}</div>
          <p style="color:#6b7280;font-size:14px">Yeh OTP <strong>10 minutes</strong> mein expire ho jaayega.</p>
          <p style="color:#9ca3af;font-size:12px;margin-top:16px">Agar aapne yeh request nahi kiya, toh ignore kar dein.</p>
        </div>
      </div>`,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("[enquiries] send-otp failed:", err);
    res.status(500).json({ error: "OTP send karne mein error — dobara try karo" });
  }
});

// ─── Public: Submit enquiry ──────────────────────────────────────────────────
router.post("/enquiries", async (req, res) => {
  try {
    const { type, name, email, mobile, city, accountType, companyName, message, source, otp } = req.body || {};
    if (!type || !name || !email) { res.status(400).json({ error: "type, name, email required" }); return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { res.status(400).json({ error: "Invalid email" }); return; }
    const allowedTypes = ["expert", "investor_deck", "general", "notify_me"];
    if (!allowedTypes.includes(type)) { res.status(400).json({ error: "Invalid type" }); return; }

    // For notify_me, verify OTP
    if (type === "notify_me") {
      if (!otp) { res.status(400).json({ error: "OTP required for notify_me registration" }); return; }
      const stored = otpStore.get(email.toLowerCase());
      if (!stored) { res.status(400).json({ error: "OTP expired ya invalid hai — dobara OTP mangao" }); return; }
      if (Date.now() > stored.expires) {
        otpStore.delete(email.toLowerCase());
        res.status(400).json({ error: "OTP expire ho gaya — dobara OTP mangao" });
        return;
      }
      if (stored.otp !== String(otp)) { res.status(400).json({ error: "Galat OTP — dobara check karo" }); return; }
      otpStore.delete(email.toLowerCase());
    }

    const [created] = await db.insert(enquiriesTable).values({
      type, name, email,
      mobile: mobile || null,
      city: city || null,
      accountType: accountType || null,
      companyName: companyName || null,
      message: message || null,
      source: source || null,
    }).returning();

    sendEnquiryEmail({ type, name, email, mobile, city, accountType, companyName, message, source }).then(async () => {
      try { await db.update(enquiriesTable).set({ notifiedAt: new Date() }).where(eq(enquiriesTable.id, created.id)); } catch {}
    });

    let downloadUrl: string | null = null;
    if (type === "investor_deck") {
      const rows = await db.select({ url: companySettingsTable.investorDeckUrl }).from(companySettingsTable).limit(1);
      downloadUrl = rows[0]?.url || null;
    }
    res.json({ success: true, id: created.id, downloadUrl });
  } catch (e) {
    console.error("[enquiries] submit failed:", e);
    res.status(500).json({ error: "Failed to submit enquiry" });
  }
});

// ─── Admin: List enquiries ───────────────────────────────────────────────────
router.get("/admin/enquiries", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const { status, type } = req.query;
    const conds = [];
    if (status && typeof status === "string") conds.push(eq(enquiriesTable.status, status));
    if (type && typeof type === "string") conds.push(eq(enquiriesTable.type, type));
    const where = conds.length ? sql`${conds.reduce((a, b) => sql`${a} AND ${b}`)}` : undefined;
    const rows = await db.select().from(enquiriesTable).where(where).orderBy(desc(enquiriesTable.createdAt)).limit(500);

    const totals = await db.select({
      total: sql<number>`COUNT(*)::int`,
      newCount: sql<number>`COUNT(*) FILTER (WHERE status = 'new')::int`,
      contactedCount: sql<number>`COUNT(*) FILTER (WHERE status = 'contacted')::int`,
      closedCount: sql<number>`COUNT(*) FILTER (WHERE status = 'closed')::int`,
    }).from(enquiriesTable);

    res.json({ enquiries: rows, stats: totals[0] });
  } catch (e) {
    console.error("[enquiries] list failed:", e);
    res.status(500).json({ error: "Failed to fetch enquiries" });
  }
});

// ─── Admin: Update enquiry status ────────────────────────────────────────────
router.patch("/admin/enquiries/:id", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    if (!status || !["new", "contacted", "closed"].includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }
    const [updated] = await db.update(enquiriesTable).set({ status }).where(eq(enquiriesTable.id, String(id))).returning();
    if (!updated) { res.status(404).json({ error: "Enquiry not found" }); return; }
    res.json({ success: true, enquiry: updated });
  } catch (e) {
    console.error("[enquiries] update failed:", e);
    res.status(500).json({ error: "Failed to update enquiry" });
  }
});

// ─── Admin: Delete enquiry ───────────────────────────────────────────────────
router.delete("/admin/enquiries/:id", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const { id } = req.params;
    await db.delete(enquiriesTable).where(eq(enquiriesTable.id, String(id)));
    res.json({ success: true });
  } catch (e) {
    console.error("[enquiries] delete failed:", e);
    res.status(500).json({ error: "Failed to delete enquiry" });
  }
});

export default router;
