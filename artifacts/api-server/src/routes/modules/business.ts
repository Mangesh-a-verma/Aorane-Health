import { Router } from "express";
import { logger } from "../../lib/logger";
import { db, pool, organizationsTable, orgAdminsTable, orgMembersTable, enrollmentCodesTable, usersTable, dailyHealthScoresTable, userProfilesTable, orgPaymentsTable, orgAnnouncementsTable, planPricingTable, subscriptionsTable, companySettingsTable, stressLogsTable, userPrivacySettingsTable } from "@workspace/db";
import { eq, and, inArray, gte, lte, desc, ilike, sql } from "drizzle-orm";
import { requireBusinessAuth } from "../../middlewares/business-auth";
import { requireAuth } from "../../middlewares/user-auth";
import { signBusinessToken } from "../../lib/jwt";
import type { BusinessRequest } from "../../middlewares/business-auth";
import bcrypt from "bcryptjs";
import { generateOtp, hashOtp, verifyOtpHash, sendEmailOtp } from "../../lib/otp";
import { verifyAndMigratePassword } from "../../lib/auth-utils";
import {
  isLiveMode, isTestMode, createPlan, createSubscription, cancelSubscription,
  verifySubscriptionSignature, verifyPaymentSignature, createOrder,
} from "../../lib/razorpay";
import { sendInvoiceEmail } from "../../lib/invoice-email";
import { sendBusinessWelcomeEmail, sendCorporatePaymentWelcomeEmail } from "../../lib/welcome-email";

const router = Router();

router.post("/business/register", async (req, res) => {
  try {
    // C6: Rate limiting — max 5 registration attempts per IP per hour
    const { cache } = await import("../../lib/redis");
    const ip = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "unknown").split(",")[0].trim();
    const rlKey = `biz_register:${ip}`;
    const attempts = cache.incrementRateLimitFixed(rlKey, 3600);
    if (attempts > 5) {
      res.status(429).json({ error: "Too many registration attempts. Please try again after 1 hour." });
      return;
    }

    const { orgType, name, contactEmail, contactPhone, city, state, countryCode = "IN", gstin, industry, companySize, hospitalType, bedCount, nabhAccredited, gymType, memberCount, irdaiLicense, totalSeats = 10, adminName, adminPassword } = req.body as Record<string, unknown>;

    if (!orgType || !name || !contactEmail || !adminName || !adminPassword) {
      res.status(400).json({ error: "Organization type, name, email, admin name and password required" });
      return;
    }
    if (typeof adminPassword !== "string" || adminPassword.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }

    // Normalize email to lowercase
    const normalizedEmail = (contactEmail as string).toLowerCase().trim();

    // Pre-registration duplicate check — block if email already registered as org admin
    const [existingAdmin] = await db
      .select({ id: orgAdminsTable.id })
      .from(orgAdminsTable)
      .where(eq(orgAdminsTable.email, normalizedEmail))
      .limit(1);
    if (existingAdmin) {
      res.status(409).json({ error: "An account with this email already exists. Please log in instead." });
      return;
    }

    const orgCode = generateOrgCode();
    const [org] = await db.insert(organizationsTable).values({
      orgType: orgType as "corporate" | "hospital" | "gym" | "insurance" | "ngo" | "yoga" | "school" | "other",
      name: name as string,
      orgCode,
      contactEmail: normalizedEmail,
      contactPhone: contactPhone as string,
      city: city as string,
      state: state as string,
      countryCode: countryCode as string,
      gstin: gstin as string,
      industry: industry as string,
      companySize: companySize as string,
      hospitalType: hospitalType as string,
      bedCount: bedCount ? Number(bedCount) : undefined,
      nabhAccredited: Boolean(nabhAccredited),
      gymType: gymType as string,
      memberCount: memberCount ? Number(memberCount) : undefined,
      irdaiLicense: irdaiLicense as string,
      totalSeats: Number(totalSeats),
    }).returning();

    const passwordHash = await bcrypt.hash(adminPassword as string, 12);
    // BUG-3: Wrap admin insert separately so we can clean up the org if admin insert fails
    let admin!: typeof orgAdminsTable.$inferSelect;
    try {
      [admin] = await db.insert(orgAdminsTable).values({
        orgId: org.id,
        fullName: adminName as string,
        email: normalizedEmail,
        passwordHash,
        role: "owner",
      }).returning();
    } catch (adminErr) {
      // Rollback the org we just created to avoid orphaned org records
      await db.delete(organizationsTable).where(eq(organizationsTable.id, org.id)).catch(() => {});
      if ((adminErr as any)?.code === "23505" || String(adminErr).includes("unique")) {
        res.status(409).json({ error: "An account with this email already exists. Please log in instead." });
        return;
      }
      throw adminErr;
    }

    const token = signBusinessToken({ orgAdminId: admin.id, orgId: org.id, role: admin.role });
    // W3: Send email verification OTP (fire & forget)
    const verifyOtp = generateOtp(6);
    cache.setOtp(`biz_email_verify:${admin.id}`, hashOtp(verifyOtp));
    sendEmailOtp(normalizedEmail, verifyOtp).catch(() => {});
    // Send business welcome email (fire & forget)
    sendBusinessWelcomeEmail({
      toEmail: normalizedEmail,
      adminName: adminName as string,
      orgName: name as string,
      orgCode,
    }).catch(() => {});
    res.status(201).json({ success: true, org, admin: { id: admin.id, fullName: admin.fullName, role: admin.role, isEmailVerified: false }, token, orgCode });
  } catch (err) {
    // Safety net: any 23505 that escapes the inner catch (e.g. Drizzle wrapping) → 409 not 500
    const isUnique = (err as any)?.code === "23505"
      || (err as any)?.cause?.code === "23505"
      || String(err).toLowerCase().includes("unique")
      || String(err).toLowerCase().includes("duplicate");
    if (isUnique) {
      res.status(409).json({ error: "An account with this email already exists. Please log in instead." });
      return;
    }
    res.status(500).json({ error: "Failed to register organization" });
  }
});

router.post("/business/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) {
      res.status(400).json({ error: "Email and password required" });
      return;
    }

    // Brute-force protection: max 10 attempts per email per 15 minutes
    const { cache } = await import("../../lib/redis");
    const rlKey = `biz_login:${email.toLowerCase()}`;
    const attempts = cache.incrementRateLimitFixed(rlKey, 15 * 60);
    if (attempts > 10) {
      res.status(429).json({ error: "Too many login attempts. Try after 15 minutes." });
      return;
    }

    const [admin] = await db.select().from(orgAdminsTable).where(eq(orgAdminsTable.email, email));
    if (!admin || !admin.isActive) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const valid = await verifyAndMigratePassword(password, admin.passwordHash, async (h) => {
      await db.update(orgAdminsTable).set({ passwordHash: h }).where(eq(orgAdminsTable.id, admin.id));
    });
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // Password verified — issue JWT directly (no OTP required)
    await db.update(orgAdminsTable).set({ lastLoginAt: new Date() }).where(eq(orgAdminsTable.id, admin.id));
    const token = signBusinessToken({ orgAdminId: admin.id, orgId: admin.orgId, role: admin.role });
    const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, admin.orgId));
    res.json({ token, admin: { id: admin.id, fullName: admin.fullName, role: admin.role, isEmailVerified: admin.isEmailVerified }, org });
  } catch {
    res.status(500).json({ error: "Login failed" });
  }
});

// W3: Verify registration email OTP
router.post("/business/verify-registration-email", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    const { otp } = req.body as { otp: string };
    if (!otp) { res.status(400).json({ error: "OTP required" }); return; }
    const { cache } = await import("../../lib/redis");
    const storedHash = cache.getOtp(`biz_email_verify:${req.orgAdminId}`);
    if (!storedHash) { res.status(400).json({ error: "Verification code expired. Request a new one." }); return; }
    if (!verifyOtpHash(otp, storedHash)) { res.status(400).json({ error: "Invalid verification code" }); return; }
    cache.deleteOtp(`biz_email_verify:${req.orgAdminId}`);
    await db.update(orgAdminsTable).set({ isEmailVerified: true, emailVerifiedAt: new Date() }).where(eq(orgAdminsTable.id, req.orgAdminId!));
    res.json({ success: true, message: "Email verified successfully" });
  } catch { res.status(500).json({ error: "Email verification failed" }); }
});

// W3: Resend email verification OTP
router.post("/business/resend-verification-email", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    const [admin] = await db.select({ email: orgAdminsTable.email, isEmailVerified: orgAdminsTable.isEmailVerified })
      .from(orgAdminsTable).where(eq(orgAdminsTable.id, req.orgAdminId!)).limit(1);
    if (!admin) { res.status(404).json({ error: "Admin not found" }); return; }
    if (admin.isEmailVerified) { res.json({ success: true, message: "Email already verified" }); return; }
    const { cache } = await import("../../lib/redis");
    const verifyOtp = generateOtp(6);
    cache.setOtp(`biz_email_verify:${req.orgAdminId}`, hashOtp(verifyOtp));
    const sent = await sendEmailOtp(admin.email, verifyOtp);
    const isDev = process.env.NODE_ENV !== "production";
    res.json({ success: true, sent, ...(!sent && isDev ? { devOtp: verifyOtp } : {}) });
  } catch { res.status(500).json({ error: "Failed to resend verification code" }); }
});

// ─── FORGOT PASSWORD ─────────────────────────────────────────────────────────
router.post("/business/forgot-password", async (req, res) => {
  try {
    const { email } = req.body as { email: string };
    if (!email) { res.status(400).json({ error: "Email required" }); return; }
    const [admin] = await db.select().from(orgAdminsTable).where(eq(orgAdminsTable.email, email.toLowerCase()));
    if (!admin || !admin.isActive) {
      // Don't reveal if email exists
      res.json({ sent: true, message: "If this email is registered, a reset code has been sent." });
      return;
    }
    const { cache } = await import("../../lib/redis");
    const otp = generateOtp(6);
    const hashed = hashOtp(otp);
    cache.setOtp(`biz_forgot_otp:${email.toLowerCase()}`, hashed);
    const sent = await sendEmailOtp(email, otp);
    const isDev = process.env.NODE_ENV !== "production";
    // B1: Only expose devOtp when email actually failed in dev — never in prod
    res.json({ sent, message: "Reset code sent to your email.", ...(!sent && isDev ? { devOtp: otp } : {}) });
  } catch {
    res.status(500).json({ error: "Failed to send reset code" });
  }
});

router.post("/business/forgot-password/verify", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body as { email: string; otp: string; newPassword: string };
    if (!email || !otp || !newPassword) { res.status(400).json({ error: "Email, OTP and new password required" }); return; }
    if (newPassword.length < 8) { res.status(400).json({ error: "Password must be at least 8 characters" }); return; }
    const { cache } = await import("../../lib/redis");
    const storedHash = cache.getOtp(`biz_forgot_otp:${email.toLowerCase()}`);
    if (!storedHash) { res.status(400).json({ error: "Reset code expired or invalid. Request a new one." }); return; }
    if (!verifyOtpHash(otp, storedHash as string)) { res.status(400).json({ error: "Incorrect code. Please try again." }); return; }
    cache.deleteOtp(`biz_forgot_otp:${email.toLowerCase()}`);
    const newHash = await bcrypt.hash(newPassword, 12);
    await db.update(orgAdminsTable).set({ passwordHash: newHash }).where(eq(orgAdminsTable.email, email.toLowerCase()));
    res.json({ success: true, message: "Password updated successfully. Please log in." });
  } catch {
    res.status(500).json({ error: "Failed to reset password" });
  }
});

router.post("/business/login/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body as { email: string; otp: string };
    if (!email || !otp) {
      res.status(400).json({ error: "Email and OTP required" });
      return;
    }

    const { cache } = await import("../../lib/redis");
    const storedHash = cache.getOtp(`biz_login_otp:${email.toLowerCase()}`);
    if (!storedHash) {
      res.status(400).json({ error: "OTP expired or not found. Please log in again." });
      return;
    }
    if (!verifyOtpHash(otp, storedHash as string)) {
      res.status(400).json({ error: "Incorrect OTP. Please try again." });
      return;
    }
    cache.deleteOtp(`biz_login_otp:${email.toLowerCase()}`);

    // BUG-5: Normalize email to lowercase before DB lookup to prevent case mismatch
    const [admin] = await db.select().from(orgAdminsTable).where(eq(orgAdminsTable.email, email.toLowerCase().trim()));
    if (!admin || !admin.isActive) {
      res.status(401).json({ error: "Account not found" });
      return;
    }

    await db.update(orgAdminsTable).set({ lastLoginAt: new Date() }).where(eq(orgAdminsTable.id, admin.id));
    const token = signBusinessToken({ orgAdminId: admin.id, orgId: admin.orgId, role: admin.role });
    const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, admin.orgId));
    res.json({ token, admin: { id: admin.id, fullName: admin.fullName, role: admin.role }, org });
  } catch {
    res.status(500).json({ error: "OTP verification failed" });
  }
});

router.post("/business/send-reg-otp", async (req, res) => {
  try {
    const { email } = req.body as { email: string };
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "Valid email required" });
      return;
    }
    // BUG-4: Normalize email before lookup to prevent case-sensitivity bypass
    const [existing] = await db.select().from(orgAdminsTable).where(eq(orgAdminsTable.email, email.toLowerCase().trim()));
    if (existing) {
      res.status(409).json({ error: "An account with this email already exists. Please log in instead." });
      return;
    }
    const { cache } = await import("../../lib/redis");
    const otp = generateOtp(6);
    const hashed = hashOtp(otp);
    cache.setOtp(`biz_reg_otp:${email.toLowerCase()}`, hashed);
    const sent = await sendEmailOtp(email, otp);
    const isDev = process.env.NODE_ENV !== "production";
    // B1: Only expose devOtp when email actually failed in dev — never in prod
    res.json({
      success: true,
      message: sent ? "Verification code sent to your email" : (isDev ? "Dev mode — code below" : "Email service unavailable"),
      ...(!sent && isDev ? { devOtp: otp } : {}),
      sent,
    });
  } catch {
    res.status(500).json({ error: "Failed to send verification code" });
  }
});

router.post("/business/verify-reg-otp", async (req, res) => {
  try {
    const { email, otp } = req.body as { email: string; otp: string };
    if (!email || !otp) {
      res.status(400).json({ error: "Email and OTP required" });
      return;
    }
    const { cache } = await import("../../lib/redis");
    const storedHash = cache.getOtp(`biz_reg_otp:${email.toLowerCase()}`);
    if (!storedHash) {
      res.status(400).json({ error: "Verification code expired. Please request a new one." });
      return;
    }
    if (!verifyOtpHash(otp, storedHash as string)) {
      res.status(400).json({ error: "Incorrect verification code. Please try again." });
      return;
    }
    cache.deleteOtp(`biz_reg_otp:${email.toLowerCase()}`);
    res.json({ success: true, verified: true });
  } catch {
    res.status(500).json({ error: "Verification failed" });
  }
});

router.post("/business/login/send-email-otp", async (req, res) => {
  try {
    const { email } = req.body as { email: string };
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "Valid email required" });
      return;
    }
    // BUG-5: Normalize email to lowercase before DB lookup to prevent case mismatch
    const [admin] = await db.select().from(orgAdminsTable).where(eq(orgAdminsTable.email, email.toLowerCase().trim()));
    if (!admin || !admin.isActive) {
      res.status(200).json({ success: true, message: "If this email is registered, an OTP will be sent.", sent: false });
      return;
    }
    const { cache } = await import("../../lib/redis");
    const rlKey = `biz_email_otp:${email.toLowerCase()}`;
    const attempts = cache.incrementRateLimitFixed(rlKey, 3600);
    if (attempts > 5) {
      res.status(429).json({ error: "Too many OTP requests. Try after 1 hour." });
      return;
    }
    const otp = generateOtp(6);
    const hashed = hashOtp(otp);
    cache.setOtp(`biz_login_otp:${email.toLowerCase()}`, hashed);
    const sent = await sendEmailOtp(email, otp);
    const isDev = process.env.NODE_ENV !== "production";
    const testEmails = (process.env.TEST_EMAILS || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
    // OBS-3: Only expose devOtp when email send actually failed — prevents prod leak for TEST_EMAILS
    const returnDevOtp = !sent && (isDev || testEmails.includes(email.toLowerCase()));
    res.json({
      success: true,
      message: sent ? "OTP sent to your email" : (isDev ? "Dev mode — OTP below" : "Email service unavailable"),
      ...(returnDevOtp ? { devOtp: otp } : {}),
      sent,
    });
  } catch {
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

router.get("/business/me", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    const [admin] = await db.select().from(orgAdminsTable).where(eq(orgAdminsTable.id, req.orgAdminId!));
    const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, req.orgId!));
    if (!admin || !org) return res.status(404).json({ error: "Account not found" });
    return res.json({ admin: { id: admin.id, fullName: admin.fullName, role: admin.role }, org });
  } catch {
    return res.status(500).json({ error: "Failed to fetch account" });
  }
});

router.get("/business/overview", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, req.orgId!));
    const members = await db.select().from(orgMembersTable).where(and(eq(orgMembersTable.orgId, req.orgId!), eq(orgMembersTable.isActive, true)));
    res.json({ org, memberCount: members.length, activeSeats: members.length });
  } catch {
    res.status(500).json({ error: "Failed to fetch overview" });
  }
});

router.get("/business/members", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    const members = await db.select({
      memberId: orgMembersTable.id,
      userId: orgMembersTable.userId,
      role: orgMembersTable.role,
      joinedAt: orgMembersTable.joinedAt,
      fullName: userProfilesTable.fullName,
      bloodGroup: userProfilesTable.bloodGroup,
    }).from(orgMembersTable)
      .leftJoin(userProfilesTable, eq(orgMembersTable.userId, userProfilesTable.userId))
      .where(and(eq(orgMembersTable.orgId, req.orgId!), eq(orgMembersTable.isActive, true)));
    res.json({ members });
  } catch {
    res.status(500).json({ error: "Failed to fetch members" });
  }
});

// ─── AORANE ID Search (business portal — search within org members) ───────────
router.get("/business/members/search", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    const q = ((req.query.q as string) || "").trim();
    if (!q || q.length < 4) { res.status(400).json({ error: "Minimum 4 characters required" }); return; }
    const isAoraneId = /^\d{8,12}$/.test(q);

    // Get all member userIds in this org
    const memberRows = await db.select({ userId: orgMembersTable.userId })
      .from(orgMembersTable)
      .where(and(eq(orgMembersTable.orgId, req.orgId!), eq(orgMembersTable.isActive, true)));
    const memberIds = memberRows.map((m) => m.userId);
    if (!memberIds.length) { res.json({ results: [], count: 0 }); return; }

    let profiles: typeof userProfilesTable.$inferSelect[] = [];
    if (isAoraneId) {
      profiles = await db.select().from(userProfilesTable).where(eq(userProfilesTable.aoraneId, q)).limit(10);
    } else {
      profiles = await db.select().from(userProfilesTable).where(ilike(userProfilesTable.fullName, `%${q}%`)).limit(10);
    }
    // Filter to only org members
    const filteredProfiles = profiles.filter((p) => memberIds.includes(p.userId));

    const results = await Promise.all(filteredProfiles.map(async (p) => {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, p.userId)).limit(1);
      return {
        userId: p.userId,
        aoraneId: p.aoraneId,
        name: p.fullName,
        bloodGroup: p.bloodGroup,
        gender: p.gender,
        age: p.dateOfBirth ? Math.floor((Date.now() - new Date(p.dateOfBirth).getTime()) / (86400000 * 365.25)) : null,
        city: (p as Record<string, unknown>).city,
        bmi: p.bmi,
        plan: user?.plan,
      };
    }));
    res.json({ results, count: results.length });
  } catch (err) {
    req.log.error({ err }, "Business search error");
    res.status(500).json({ error: "Search failed" });
  }
});

// ─── Per-employee stress data (business portal) ──────────────────────────────
router.get("/business/members/:userId/stress", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    const userId = req.params["userId"] as string;

    // Verify the member belongs to this org
    const [member] = await db.select({ id: orgMembersTable.id })
      .from(orgMembersTable)
      .where(and(
        eq(orgMembersTable.orgId, req.orgId!),
        eq(orgMembersTable.userId, userId),
        eq(orgMembersTable.isActive, true),
      ))
      .limit(1);

    if (!member) { res.status(404).json({ error: "Member not found in organization" }); return; }

    // C4: Check user's privacy setting — if share_stress_level is OFF, deny access
    const [privacy] = await db.select({ shareStressLevel: userPrivacySettingsTable.shareStressLevel })
      .from(userPrivacySettingsTable)
      .where(eq(userPrivacySettingsTable.userId, userId))
      .limit(1);
    if (privacy && privacy.shareStressLevel === false) {
      res.status(403).json({ error: "Member has disabled stress data sharing", privacyBlocked: true });
      return;
    }

    // Profile name
    const [profile] = await db.select({ fullName: userProfilesTable.fullName })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, userId))
      .limit(1);

    // Stress logs — last 30 days, most recent first
    const logs = await db.select({
      stressScore: stressLogsTable.stressScore,
      createdAt: stressLogsTable.createdAt,
    })
      .from(stressLogsTable)
      .where(and(
        eq(stressLogsTable.userId, userId),
        gte(stressLogsTable.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
      ))
      .orderBy(desc(stressLogsTable.createdAt))
      .limit(30);

    const latestScore = logs.length > 0 ? logs[0].stressScore : null;
    const avgScore = logs.length > 0
      ? Math.round(logs.reduce((s, l) => s + l.stressScore, 0) / logs.length)
      : null;
    const burnoutRisk = logs.length >= 3 && logs.slice(0, 3).every((l) => l.stressScore >= 70);
    const level =
      latestScore == null ? "No Data"
      : latestScore < 30  ? "Low"
      : latestScore < 55  ? "Moderate"
      : latestScore < 75  ? "High"
      : "Critical";

    // Daily trend — last unique date per day
    const trendMap = new Map<string, number>();
    for (const log of [...logs].reverse()) {
      const date = new Date(log.createdAt).toISOString().slice(0, 10);
      trendMap.set(date, log.stressScore);
    }
    const trend = Array.from(trendMap.entries()).map(([date, score]) => ({ date, score })).slice(-14);

    res.json({ userId, name: profile?.fullName ?? null, latestScore, avgScore, logsCount: logs.length, burnoutRisk, level, trend });
  } catch (err) {
    req.log.error({ err }, "Member stress fetch error");
    res.status(500).json({ error: "Failed to fetch member stress data" });
  }
});

router.post("/business/enroll", requireAuth, async (req, res) => {
  try {
    const { orgCode } = req.body as { orgCode: string };
    const userId = (req as unknown as { userId: string }).userId;
    if (!orgCode) { res.status(400).json({ error: "Org code required" }); return; }

    const [org] = await db.select().from(organizationsTable).where(and(eq(organizationsTable.orgCode, orgCode), eq(organizationsTable.isActive, true)));
    if (!org) { res.status(404).json({ error: "Organization not found or inactive" }); return; }

    const existing = await db.select().from(orgMembersTable).where(and(eq(orgMembersTable.orgId, org.id), eq(orgMembersTable.userId, userId)));
    if (existing.length) { res.status(409).json({ error: "Already enrolled in this organization" }); return; }

    await db.insert(orgMembersTable).values({ orgId: org.id, userId, enrolledViaCode: orgCode });
    // BUG-9: Atomic compare-and-increment — prevents over-enrollment under concurrent requests
    const seatUpdate = await pool.query(
      `UPDATE organizations SET used_seats = used_seats + 1 WHERE id = $1 AND used_seats < total_seats RETURNING id`,
      [org.id]
    );
    if (!seatUpdate.rowCount) {
      // Seats were taken between check and insert — undo the member enrollment
      await db.delete(orgMembersTable).where(and(eq(orgMembersTable.orgId, org.id), eq(orgMembersTable.userId, userId))).catch(() => {});
      res.status(400).json({ error: "Organization has no available seats" }); return;
    }

    // Upgrade user plan to org's plan (the whole point of org enrollment!)
    // org.plan can be "max", "pro", or legacy "basic" (old starter) — basic maps to max
    const orgPlan = (org.plan === "pro" ? "pro" : "max") as "pro" | "max";
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1-year access via org
    await db.update(usersTable).set({ plan: orgPlan }).where(eq(usersTable.id, userId));
    await db.insert(subscriptionsTable).values({
      userId, plan: orgPlan, status: "active", source: "organization",
      expiresAt, paymentType: "one_time", autoRenew: false, nextRenewalAt: expiresAt,
    }).onConflictDoNothing();

    res.status(201).json({ success: true, planUpgraded: orgPlan, org: { name: org.name, type: org.orgType } });
  } catch {
    res.status(500).json({ error: "Failed to enroll in organization" });
  }
});

// ─── POST: Use enrollment code (from enrollmentCodesTable) → upgrade user plan ─
router.post("/business/use-enrollment-code", requireAuth, async (req, res) => {
  try {
    const { code } = req.body as { code: string };
    const userId = (req as unknown as { userId: string }).userId;
    if (!code) { res.status(400).json({ error: "Enrollment code required" }); return; }

    const [enrollCode] = await db.select().from(enrollmentCodesTable)
      .where(and(eq(enrollmentCodesTable.code, code.toUpperCase().trim()), eq(enrollmentCodesTable.isActive, true)));
    if (!enrollCode) { res.status(404).json({ error: "Invalid enrollment code" }); return; }
    if (enrollCode.expiresAt && new Date(enrollCode.expiresAt) < new Date()) {
      res.status(400).json({ error: "This enrollment code has expired" }); return;
    }
    if (enrollCode.usedSeats >= enrollCode.totalSeats) {
      res.status(400).json({ error: "All seats for this code are taken" }); return;
    }

    const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, enrollCode.orgId));
    if (!org || !org.isActive) { res.status(404).json({ error: "Organization not found or inactive" }); return; }

    // Check if user already enrolled in this org
    const existing = await db.select().from(orgMembersTable)
      .where(and(eq(orgMembersTable.orgId, org.id), eq(orgMembersTable.userId, userId)));
    if (existing.length) { res.status(409).json({ error: "Already enrolled in this organization" }); return; }

    // Enroll user
    await db.insert(orgMembersTable).values({ orgId: org.id, userId, enrolledViaCode: code });
    await db.update(enrollmentCodesTable).set({ usedSeats: enrollCode.usedSeats + 1 }).where(eq(enrollmentCodesTable.id, enrollCode.id));
    await db.update(organizationsTable).set({ usedSeats: org.usedSeats + 1 }).where(eq(organizationsTable.id, org.id));

    // Upgrade user plan based on enrollment code's planType
    const planToGrant = (["pro", "max", "family"].includes(enrollCode.planType) ? enrollCode.planType : "pro") as "pro" | "max" | "family";
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + enrollCode.validityDays);
    await db.update(usersTable).set({ plan: planToGrant }).where(eq(usersTable.id, userId));
    await db.insert(subscriptionsTable).values({
      userId, plan: planToGrant, status: "active", source: "organization",
      expiresAt, paymentType: "one_time", autoRenew: false, nextRenewalAt: expiresAt,
    }).onConflictDoNothing();

    res.status(201).json({
      success: true,
      planUpgraded: planToGrant,
      expiresAt,
      org: { name: org.name, type: org.orgType },
      message: `${planToGrant.toUpperCase()} plan activated via ${org.name}!`,
    });
  } catch {
    res.status(500).json({ error: "Failed to use enrollment code" });
  }
});

router.post("/business/enrollment-codes", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    // PAYMENT GATE: only orgs with an active payment can create enrollment codes
    const [activePayment] = await db.select({ id: orgPaymentsTable.id })
      .from(orgPaymentsTable)
      .where(and(eq(orgPaymentsTable.orgId, req.orgId!), eq(orgPaymentsTable.status, "success")))
      .limit(1);
    if (!activePayment) {
      res.status(403).json({ error: "Active subscription required to create enrollment codes. Please complete payment first." });
      return;
    }
    const { planType = "basic", totalSeats = 10, validityDays = 365 } = req.body as Record<string, unknown>;
    const code = generateOrgCode();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + Number(validityDays));
    const [created] = await db.insert(enrollmentCodesTable).values({
      orgId: req.orgId!,
      code,
      planType: planType as string,
      totalSeats: Number(totalSeats),
      validityDays: Number(validityDays),
      expiresAt,
    }).returning();
    res.status(201).json({ code: created });
  } catch {
    res.status(500).json({ error: "Failed to create enrollment code" });
  }
});

router.get("/business/enrollment-codes", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    const codes = await db.select().from(enrollmentCodesTable).where(eq(enrollmentCodesTable.orgId, req.orgId!));
    res.json({ codes });
  } catch {
    res.status(500).json({ error: "Failed to fetch enrollment codes" });
  }
});

// ─── BUSINESS BILLING ─────────────────────────────────────────────────────────
/** Map billing plan key → org plan enum value (basic | pro | max) */
function billingPlanToOrgPlan(planKey: string): "basic" | "pro" | "max" {
  const map: Record<string, "basic" | "pro" | "max"> = {
    starter: "basic", basic: "basic",
    growth: "pro",   pro: "pro",
    enterprise: "max", max: "max",
  };
  return map[planKey] ?? "basic";
}

async function getOrgPlansFromDB() {
  const rows = await db.select().from(planPricingTable)
    .where(eq(planPricingTable.type, "organization"))
    .orderBy(planPricingTable.sortOrder);
  const plans: Record<string, { label: string; seats: number; price: number; priceYearly: number; color: string; features: string[]; badgeText: string | null }> = {};
  for (const r of rows) {
    plans[r.planKey] = {
      label: r.displayName,
      seats: r.maxSeats ?? 0,
      price: Number(r.monthlyPrice),
      priceYearly: Number(r.yearlyPrice ?? r.monthlyPrice),
      color: r.badgeColor ?? "#0077B6",
      features: (r.features as string[]) ?? [],
      badgeText: r.badgeText ?? null,
    };
  }
  return plans;
}

router.get("/business/billing/plans", requireBusinessAuth, async (_req: BusinessRequest, res) => {
  const plans = await getOrgPlansFromDB();
  res.json({ plans });
});

router.get("/business/billing/subscription", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    // Get latest payment (success or pending auto-renew)
    const payments = await db.select().from(orgPaymentsTable)
      .where(eq(orgPaymentsTable.orgId, req.orgId!))
      .orderBy(desc(orgPaymentsTable.createdAt)).limit(5);
    const activePayment = payments.find((p) => p.status === "success") || payments.find((p) => p.autoRenew) || payments[0] || null;
    const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, req.orgId!));
    const plans = await getOrgPlansFromDB();
    res.json({ payment: activePayment || null, org, plans });
  } catch { res.status(500).json({ error: "Failed to fetch subscription" }); }
});

// ─── one-time billing order ───────────────────────────────────────────────────
router.post("/business/billing/order", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    const { plan, billing = "monthly" } = req.body as { plan: string; billing?: string };
    const orgPlans = await getOrgPlansFromDB();
    if (!orgPlans[plan]) { res.status(400).json({ error: "Invalid plan" }); return; }
    const planInfo = orgPlans[plan];
    const amount = billing === "yearly" ? planInfo.priceYearly : planInfo.price;
    if (!isLiveMode()) {
      res.status(503).json({ error: "Payment gateway not configured. Please contact support." }); return;
    }
    const order = await createOrder({ amount, receipt: `org_${req.orgId!.substring(0, 8)}` });
    const razorpayOrderId = order.id;
    const [payment] = await db.insert(orgPaymentsTable).values({
      orgId: req.orgId!, plan, seats: planInfo.seats, amount: amount.toString(),
      currency: "INR", razorpayOrderId, status: "pending", paymentType: "one_time",
    }).returning();
    res.json({
      success: true, paymentId: payment.id, razorpayOrderId,
      razorpayKeyId: process.env["RAZORPAY_KEY_ID"] || null,
      amount, plan, planLabel: planInfo.label, seats: planInfo.seats,
      isTestMode: false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create billing order";
    res.status(500).json({ error: msg });
  }
});

// ─── verify one-time payment ──────────────────────────────────────────────────
router.post("/business/billing/verify", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    const { paymentId, razorpayOrderId, razorpayPaymentId, razorpaySignature, plan } = req.body as Record<string, unknown>;
    // ALWAYS verify signature in LIVE mode — no isTestMode bypass allowed
    if (isLiveMode()) {
      if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        res.status(400).json({ error: "Payment details missing" }); return;
      }
      const valid = verifyPaymentSignature(razorpayOrderId as string, razorpayPaymentId as string, razorpaySignature as string);
      if (!valid) { res.status(400).json({ error: "Payment signature invalid" }); return; }
    }
    // Verify payment belongs to this org
    const [existingPayment] = await db.select().from(orgPaymentsTable)
      .where(and(eq(orgPaymentsTable.id, paymentId as string), eq(orgPaymentsTable.orgId, req.orgId!)));
    if (!existingPayment) { res.status(404).json({ error: "Payment not found" }); return; }
    if (existingPayment.status === "success") {
      const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, req.orgId!));
      res.json({ success: true, org, message: "Already activated", alreadyDone: true }); return;
    }
    const orgPlansVerify = await getOrgPlansFromDB();
    const planInfo = orgPlansVerify[plan as string];
    if (!planInfo) { res.status(400).json({ error: "Invalid plan" }); return; }
    await db.update(orgPaymentsTable).set({ status: "success", razorpayPaymentId: razorpayPaymentId as string }).where(eq(orgPaymentsTable.id, paymentId as string));
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    await db.update(organizationsTable).set({
      totalSeats: planInfo.seats, plan: billingPlanToOrgPlan(plan as string), isVerified: true,
    }).where(eq(organizationsTable.id, req.orgId!));
    const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, req.orgId!));
    // Fire-and-forget corporate payment welcome email with Enrollment Code
    if (org?.contactEmail) {
      db.select({ fullName: orgAdminsTable.fullName }).from(orgAdminsTable)
        .where(and(eq(orgAdminsTable.orgId, req.orgId!), eq(orgAdminsTable.role, "owner"))).limit(1)
        .then((admins) => {
          const expiresAt = new Date(); expiresAt.setFullYear(expiresAt.getFullYear() + 1);
          sendCorporatePaymentWelcomeEmail({
            toEmail: org.contactEmail!,
            adminName: admins[0]?.fullName || org.name,
            orgName: org.name,
            orgCode: org.orgCode,
            planName: planInfo.label,
            seats: planInfo.seats,
            amountPaid: Number(existingPayment.amount),
            expiresAt,
          }).catch(() => {});
        }).catch(() => {});
    }
    res.json({ success: true, org, message: `${planInfo.label} plan activated! ${planInfo.seats} seats unlocked.`, expiresAt });
  } catch { res.status(500).json({ error: "Failed to verify payment" }); }
});

// ─── create auto-recurring subscription for org ───────────────────────────────
router.post("/business/billing/subscription/create", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    const { plan, billing = "monthly" } = req.body as { plan: string; billing?: string };
    const orgPlans = await getOrgPlansFromDB();
    if (!orgPlans[plan]) { res.status(400).json({ error: "Invalid plan" }); return; }
    const planInfo = orgPlans[plan];
    const isMonthly = billing !== "yearly";
    const amount = isMonthly ? planInfo.price : planInfo.priceYearly;
    const period: "monthly" | "yearly" = isMonthly ? "monthly" : "yearly";

    if (!isLiveMode()) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (isMonthly ? 30 : 365));
      const [payment] = await db.insert(orgPaymentsTable).values({
        orgId: req.orgId!, plan, seats: planInfo.seats, amount: amount.toString(),
        currency: "INR", status: "success", paymentType: "recurring",
        autoRenew: true, nextRenewalAt: expiresAt,
      }).returning();
      await db.update(organizationsTable).set({
        totalSeats: planInfo.seats, plan: billingPlanToOrgPlan(plan), isVerified: true,
      }).where(eq(organizationsTable.id, req.orgId!));
      const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, req.orgId!));
      return res.json({
        isTestMode: true, paymentId: payment.id, org,
        message: `${planInfo.label} auto-subscription activated! (test mode)`,
        plan, amount, seats: planInfo.seats, expiresAt, nextRenewalAt: expiresAt,
      });
    }

    const rzPlan = await createPlan({ name: `Aorane Business ${planInfo.label} ${period}`, amount, period });
    const rzSub = await createSubscription({ planId: rzPlan.id, totalCount: 60, notes: { orgId: req.orgId!, plan } });
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (isMonthly ? 30 : 365));
    const [payment] = await db.insert(orgPaymentsTable).values({
      orgId: req.orgId!, plan, seats: planInfo.seats, amount: amount.toString(),
      currency: "INR", status: "pending", paymentType: "recurring",
      autoRenew: true, nextRenewalAt: expiresAt, razorpaySubscriptionId: rzSub.id,
    }).returning();
    return res.json({
      isTestMode: false, paymentId: payment.id, razorpaySubscriptionId: rzSub.id,
      razorpayKeyId: process.env["RAZORPAY_KEY_ID"],
      plan, planLabel: planInfo.label, amount, seats: planInfo.seats,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create subscription";
    return res.status(500).json({ error: msg });
  }
});

// ─── verify subscription first payment ───────────────────────────────────────
router.post("/business/billing/subscription/verify", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    const { paymentId, razorpaySubscriptionId, razorpayPaymentId, razorpaySignature, plan } = req.body as Record<string, string>;
    if (isLiveMode()) {
      const valid = verifySubscriptionSignature(razorpaySubscriptionId, razorpayPaymentId, razorpaySignature);
      if (!valid) { res.status(400).json({ error: "Payment signature invalid" }); return; }
    }
    const orgPlans = await getOrgPlansFromDB();
    const planInfo = orgPlans[plan];
    if (!planInfo) { res.status(400).json({ error: "Invalid plan" }); return; }
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    await db.update(orgPaymentsTable).set({ status: "success", nextRenewalAt: expiresAt }).where(eq(orgPaymentsTable.id, paymentId));
    await db.update(organizationsTable).set({
      totalSeats: planInfo.seats, plan: billingPlanToOrgPlan(plan), isVerified: true,
    }).where(eq(organizationsTable.id, req.orgId!));
    const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, req.orgId!));
    // Fire-and-forget corporate payment welcome email with Enrollment Code
    if (org?.contactEmail) {
      db.select({ fullName: orgAdminsTable.fullName }).from(orgAdminsTable)
        .where(and(eq(orgAdminsTable.orgId, req.orgId!), eq(orgAdminsTable.role, "owner"))).limit(1)
        .then((admins) => {
          sendCorporatePaymentWelcomeEmail({
            toEmail: org.contactEmail!,
            adminName: admins[0]?.fullName || org.name,
            orgName: org.name,
            orgCode: org.orgCode,
            planName: planInfo.label,
            seats: planInfo.seats,
            amountPaid: 0,
            expiresAt,
          }).catch(() => {});
        }).catch(() => {});
    }
    res.json({ success: true, org, message: `${planInfo.label} auto-subscription activated!`, expiresAt });
  } catch { res.status(500).json({ error: "Failed to verify subscription" }); }
});

// ─── cancel org auto-renew ────────────────────────────────────────────────────
router.delete("/business/billing/subscription/cancel", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    const payments = await db.select().from(orgPaymentsTable)
      .where(and(eq(orgPaymentsTable.orgId, req.orgId!), eq(orgPaymentsTable.autoRenew, true)))
      .orderBy(desc(orgPaymentsTable.createdAt)).limit(1);
    const payment = payments[0];
    if (!payment) { res.status(404).json({ error: "No active auto-renew subscription found" }); return; }
    if (isLiveMode() && payment.razorpaySubscriptionId) {
      try { await cancelSubscription(payment.razorpaySubscriptionId, true); } catch { /* ignore if already cancelled */ }
    }
    await db.update(orgPaymentsTable).set({ autoRenew: false }).where(eq(orgPaymentsTable.id, payment.id));
    res.json({ success: true, message: "Auto-renew cancelled. Plan stays active until next renewal date.", nextRenewalAt: payment.nextRenewalAt });
  } catch { res.status(500).json({ error: "Failed to cancel auto-renew" }); }
});

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
router.get("/business/analytics", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    const memberRows = await db.select({ userId: orgMembersTable.userId, joinedAt: orgMembersTable.joinedAt })
      .from(orgMembersTable)
      .where(and(eq(orgMembersTable.orgId, req.orgId!), eq(orgMembersTable.isActive, true)));
    const memberIds = memberRows.map((m) => m.userId);

    let profiles: { gender: string | null; bmi: string | null; plan: string; dateOfBirth: string | null }[] = [];
    if (memberIds.length) {
      const profileRows = await db.select({
        gender: userProfilesTable.gender,
        bmi: userProfilesTable.bmi,
        plan: usersTable.plan,
        dateOfBirth: userProfilesTable.dateOfBirth,
      }).from(userProfilesTable)
        .leftJoin(usersTable, eq(userProfilesTable.userId, usersTable.id))
        .where(sql`${userProfilesTable.userId} = ANY(ARRAY[${sql.join(memberIds.map(id => sql`${id}::uuid`))}])`);
      profiles = profileRows as typeof profiles;
    }

    const genderDist = { male: 0, female: 0, other: 0 };
    const planDist: Record<string, number> = {};
    const ageBuckets = { "18-25": 0, "26-35": 0, "36-45": 0, "46-55": 0, "55+": 0 };
    let bmiSum = 0; let bmiCount = 0;

    for (const p of profiles) {
      if (p.gender === "male") genderDist.male++;
      else if (p.gender === "female") genderDist.female++;
      else genderDist.other++;
      const plan = p.plan || "free";
      planDist[plan] = (planDist[plan] || 0) + 1;
      if (p.bmi) { bmiSum += parseFloat(p.bmi); bmiCount++; }
      if (p.dateOfBirth) {
        const age = Math.floor((Date.now() - new Date(p.dateOfBirth).getTime()) / (86400000 * 365.25));
        if (age < 26) ageBuckets["18-25"]++;
        else if (age < 36) ageBuckets["26-35"]++;
        else if (age < 46) ageBuckets["36-45"]++;
        else if (age < 56) ageBuckets["46-55"]++;
        else ageBuckets["55+"]++;
      }
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const joinTrend: Record<string, number> = {};
    for (const m of memberRows) {
      if (m.joinedAt && new Date(m.joinedAt) > thirtyDaysAgo) {
        const d = new Date(m.joinedAt).toISOString().split("T")[0];
        joinTrend[d] = (joinTrend[d] || 0) + 1;
      }
    }
    const joinTrendArr = Object.entries(joinTrend).sort().map(([date, count]) => ({ date, count }));

    res.json({
      totalMembers: memberIds.length,
      genderDist: [
        { name: "Male", value: genderDist.male, color: "#0077B6" },
        { name: "Female", value: genderDist.female, color: "#EC4899" },
        { name: "Other", value: genderDist.other, color: "#6B7280" },
      ],
      planDist: Object.entries(planDist).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value })),
      ageDist: Object.entries(ageBuckets).map(([name, value]) => ({ name, value })),
      avgBmi: bmiCount > 0 ? (bmiSum / bmiCount).toFixed(1) : null,
      joinTrend: joinTrendArr,
    });
  } catch (err) {
    req.log.error({ err }, "Analytics error");
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

// ─── ANNOUNCEMENTS ────────────────────────────────────────────────────────────
router.get("/business/announcements", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    const items = await db.select().from(orgAnnouncementsTable)
      .where(eq(orgAnnouncementsTable.orgId, req.orgId!))
      .orderBy(desc(orgAnnouncementsTable.createdAt)).limit(50);
    res.json({ announcements: items });
  } catch { res.status(500).json({ error: "Failed to fetch announcements" }); }
});

router.post("/business/announcements", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    const { title, body, type = "announcement" } = req.body as { title: string; body: string; type?: string };
    if (!title || !body) { res.status(400).json({ error: "Title and body required" }); return; }
    const memberCount = await db.select({ count: sql<number>`count(*)::int` }).from(orgMembersTable)
      .where(and(eq(orgMembersTable.orgId, req.orgId!), eq(orgMembersTable.isActive, true)));
    const [ann] = await db.insert(orgAnnouncementsTable).values({
      orgId: req.orgId!, title, body, type, sentCount: memberCount[0]?.count || 0,
    }).returning();
    res.status(201).json({ announcement: ann });
  } catch { res.status(500).json({ error: "Failed to create announcement" }); }
});

// ─── MEMBER DETAIL ────────────────────────────────────────────────────────────
router.get("/business/members/:userId/detail", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    const userId = String(req.params.userId);
    const [member] = await db.select().from(orgMembersTable)
      .where(and(eq(orgMembersTable.orgId, req.orgId!), eq(orgMembersTable.userId, userId)));
    if (!member) { res.status(404).json({ error: "Member not in organization" }); return; }

    // C5: Fetch privacy settings and filter sensitive fields accordingly
    const [privacy] = await db.select().from(userPrivacySettingsTable)
      .where(eq(userPrivacySettingsTable.userId, userId)).limit(1);

    const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    const recentScores = await db.select().from(dailyHealthScoresTable)
      .where(eq(dailyHealthScoresTable.userId, userId))
      .orderBy(desc(dailyHealthScoresTable.scoreDate)).limit(7);

    // BUG-8: Respect shareBasicProfile — if false, hide all identity fields
    const shareBasic = privacy?.shareBasicProfile !== false;
    const safeProfile = profile ? {
      fullName: shareBasic ? profile.fullName : null,
      gender: shareBasic ? profile.gender : null,
      city: shareBasic ? profile.city : null,
      state: shareBasic ? profile.state : null,
      bmi: privacy?.shareBmi !== false ? profile.bmi : null,
      bloodGroup: shareBasic ? profile.bloodGroup : null,
    } : null;

    res.json({ member, profile: safeProfile, user: { plan: user?.plan, aoraneId: profile?.aoraneId }, recentScores });
  } catch { res.status(500).json({ error: "Failed to fetch member detail" }); }
});

router.patch("/business/settings", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    // Use literal property access (no bracket notation with variable keys) to avoid prototype injection
    const b = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    if (b.name          !== undefined) updates.name          = b.name;
    if (b.contactEmail  !== undefined) updates.contactEmail  = b.contactEmail;
    if (b.contactPhone  !== undefined) updates.contactPhone  = b.contactPhone;
    if (b.city          !== undefined) updates.city          = b.city;
    if (b.state         !== undefined) updates.state         = b.state;
    if (b.gstin         !== undefined) updates.gstin         = b.gstin;
    if (b.industry      !== undefined) updates.industry      = b.industry;
    if (b.companySize   !== undefined) updates.companySize   = b.companySize;
    if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No valid fields to update" }); return; }
    const [updated] = await db.update(organizationsTable).set(updates).where(eq(organizationsTable.id, req.orgId!)).returning();
    res.json({ org: updated });
  } catch { res.status(500).json({ error: "Failed to update organization settings" }); }
});

router.patch("/business/admin/password", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
    if (!currentPassword || !newPassword) { res.status(400).json({ error: "Current and new password required" }); return; }
    if (newPassword.length < 8) { res.status(400).json({ error: "New password must be at least 8 characters" }); return; }
    const [admin] = await db.select().from(orgAdminsTable).where(eq(orgAdminsTable.id, req.orgAdminId!));
    if (!admin) { res.status(404).json({ error: "Admin not found" }); return; }
    const valid = await verifyAndMigratePassword(currentPassword, admin.passwordHash, async (h) => {
      await db.update(orgAdminsTable).set({ passwordHash: h }).where(eq(orgAdminsTable.id, admin.id));
    });
    if (!valid) { res.status(401).json({ error: "Current password is incorrect" }); return; }
    const newHash = await bcrypt.hash(newPassword, 12);
    await db.update(orgAdminsTable).set({ passwordHash: newHash }).where(eq(orgAdminsTable.id, req.orgAdminId!));
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Failed to change password" }); }
});

router.post("/business/members/:userId/remove", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    const userId = String(req.params.userId);
    await db.update(orgMembersTable).set({ isActive: false })
      .where(and(eq(orgMembersTable.orgId, req.orgId!), eq(orgMembersTable.userId, userId)));
    const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, req.orgId!));
    if (org && org.usedSeats > 0) {
      await db.update(organizationsTable).set({ usedSeats: org.usedSeats - 1 }).where(eq(organizationsTable.id, req.orgId!));
    }
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Failed to remove member" }); }
});

// ─── SUSPEND ACCESS (block code usage, keep seat) ─────────────────────────────
router.post("/business/members/:userId/suspend", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    const userId = String(req.params.userId);
    const [member] = await db.select().from(orgMembersTable)
      .where(and(eq(orgMembersTable.orgId, req.orgId!), eq(orgMembersTable.userId, userId), eq(orgMembersTable.isActive, true)));
    if (!member) { res.status(404).json({ error: "Active member not found in your organization" }); return; }
    await db.update(orgMembersTable).set({ isActive: false })
      .where(and(eq(orgMembersTable.orgId, req.orgId!), eq(orgMembersTable.userId, userId)));
    // Seat is NOT decremented — they are suspended but seat is reserved
    res.json({ success: true, message: "Member access suspended. They cannot use enrollment codes or appear in member data until restored." });
  } catch { res.status(500).json({ error: "Failed to suspend member" }); }
});

// ─── RESTORE ACCESS ───────────────────────────────────────────────────────────
router.post("/business/members/:userId/restore", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    const userId = String(req.params.userId);
    const [member] = await db.select().from(orgMembersTable)
      .where(and(eq(orgMembersTable.orgId, req.orgId!), eq(orgMembersTable.userId, userId)));
    if (!member) { res.status(404).json({ error: "Member not found in your organization" }); return; }
    if (member.isActive) { res.json({ success: true, message: "Member is already active" }); return; }
    await db.update(orgMembersTable).set({ isActive: true })
      .where(and(eq(orgMembersTable.orgId, req.orgId!), eq(orgMembersTable.userId, userId)));
    res.json({ success: true, message: "Member access restored." });
  } catch { res.status(500).json({ error: "Failed to restore member" }); }
});

// ─── TOGGLE MEMBER ACTIVE STATUS (one-click enable/disable) ─────────────────
router.post("/business/members/:userId/toggle-active", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    const userId = String(req.params.userId);
    const [member] = await db.select().from(orgMembersTable)
      .where(and(eq(orgMembersTable.orgId, req.orgId!), eq(orgMembersTable.userId, userId)));
    if (!member) { res.status(404).json({ error: "Member not found in your organization" }); return; }
    const newActive = !member.isActive;
    await db.update(orgMembersTable).set({ isActive: newActive })
      .where(and(eq(orgMembersTable.orgId, req.orgId!), eq(orgMembersTable.userId, userId)));
    res.json({ success: true, isActive: newActive, message: newActive ? "Member enabled." : "Member disabled." });
  } catch { res.status(500).json({ error: "Failed to toggle member status" }); }
});

// ─── SUSPENDED MEMBERS LIST ───────────────────────────────────────────────────
router.get("/business/members/suspended", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    const members = await db.select({
      memberId: orgMembersTable.id,
      userId: orgMembersTable.userId,
      role: orgMembersTable.role,
      joinedAt: orgMembersTable.joinedAt,
      fullName: userProfilesTable.fullName,
      bloodGroup: userProfilesTable.bloodGroup,
    }).from(orgMembersTable)
      .leftJoin(userProfilesTable, eq(orgMembersTable.userId, userProfilesTable.userId))
      .where(and(eq(orgMembersTable.orgId, req.orgId!), eq(orgMembersTable.isActive, false)));
    res.json({ members });
  } catch { res.status(500).json({ error: "Failed to fetch suspended members" }); }
});

// ─── HEALTH ANALYTICS (aggregate, privacy-safe) ────────────────────────────
router.get("/business/health-analytics", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    const memberRows = await db.select({ userId: orgMembersTable.userId })
      .from(orgMembersTable)
      .where(and(eq(orgMembersTable.orgId, req.orgId!), eq(orgMembersTable.isActive, true)));
    const memberIds = memberRows.map((m) => m.userId);
    if (!memberIds.length) {
      res.json({ totalMembers: 0, activeToday: 0, activeLast7Days: 0, avgHealthScore: 0, avgFood: 0, avgWater: 0, avgExercise: 0, avgMedicine: 0, healthyCount: 0, atRiskCount: 0, inactiveCount: 0, dailyActiveTrend: [], avgStressScore: null, highStressCount: 0, moderateStressCount: 0, lowStressCount: 0, stressTrackedCount: 0 });
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Get all health scores for last 30 days
    const scores = await db.select({
      userId: dailyHealthScoresTable.userId,
      scoreDate: dailyHealthScoresTable.scoreDate,
      healthScore: dailyHealthScoresTable.healthScore,
      foodScore: dailyHealthScoresTable.foodScore,
      waterScore: dailyHealthScoresTable.waterScore,
      exerciseScore: dailyHealthScoresTable.exerciseScore,
      medicineScore: dailyHealthScoresTable.medicineScore,
    }).from(dailyHealthScoresTable)
      .where(and(
        inArray(dailyHealthScoresTable.userId, memberIds),
        gte(dailyHealthScoresTable.scoreDate, thirtyDaysAgo)
      ));

    // Latest score per user (for avg, distribution)
    const latestByUser = new Map<string, { scoreDate: string; healthScore: number; foodScore: number; waterScore: number; exerciseScore: number; medicineScore: number }>();
    for (const s of scores) {
      const existing = latestByUser.get(s.userId);
      if (!existing || s.scoreDate > existing.scoreDate) {
        latestByUser.set(s.userId, { scoreDate: s.scoreDate, healthScore: s.healthScore, foodScore: s.foodScore, waterScore: s.waterScore, exerciseScore: s.exerciseScore, medicineScore: s.medicineScore });
      }
    }

    // Active in last 7 days (any score)
    const activeUserIds7 = new Set(scores.filter(s => s.scoreDate >= sevenDaysAgo).map(s => s.userId));
    // Active today
    const activeTodayIds = new Set(scores.filter(s => s.scoreDate === today).map(s => s.userId));

    // Distribution
    let healthyCount = 0, atRiskCount = 0, inactiveCount = 0;
    let sumHealth = 0, sumFood = 0, sumWater = 0, sumExercise = 0, sumMedicine = 0;
    const scored = Array.from(latestByUser.values());
    for (const s of scored) {
      sumHealth += s.healthScore; sumFood += s.foodScore; sumWater += s.waterScore;
      sumExercise += s.exerciseScore; sumMedicine += s.medicineScore;
      if (s.healthScore >= 70) healthyCount++;
      else if (s.healthScore >= 40) atRiskCount++;
      else inactiveCount++;
    }
    const scoredCount = scored.length || 1;
    const unscored = memberIds.length - scored.length;
    inactiveCount += unscored;

    // Daily active trend (last 30 days)
    const trendMap = new Map<string, Set<string>>();
    for (const s of scores) {
      if (!trendMap.has(s.scoreDate)) trendMap.set(s.scoreDate, new Set());
      trendMap.get(s.scoreDate)!.add(s.userId);
    }
    const dailyActiveTrend = Array.from(trendMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([date, users]) => ({ date, activeCount: users.size }));

    // ── Real Stress Analytics (from stress_logs table) ──────────────
    const stressLogs = await db.select({
      userId: stressLogsTable.userId,
      stressScore: stressLogsTable.stressScore,
      stressType: stressLogsTable.stressType,
    }).from(stressLogsTable)
      .where(and(
        inArray(stressLogsTable.userId, memberIds),
        gte(stressLogsTable.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      ))
      .orderBy(stressLogsTable.createdAt); // ASC so the last Map write per user = most recent log

    // Latest stress score per user (Map overwrites older with newer because rows are ASC ordered)
    const latestStressByUser = new Map<string, number>();
    for (const log of stressLogs) {
      latestStressByUser.set(log.userId, log.stressScore);
    }
    const stressValues = Array.from(latestStressByUser.values());
    const avgStressScore = stressValues.length
      ? Math.round(stressValues.reduce((a, b) => a + b, 0) / stressValues.length)
      : null;
    const highStressCount = stressValues.filter(v => v >= 70).length;
    const moderateStressCount = stressValues.filter(v => v >= 40 && v < 70).length;
    const lowStressCount = stressValues.filter(v => v < 40).length;
    const stressTrackedCount = stressValues.length;

    res.json({
      totalMembers: memberIds.length,
      activeToday: activeTodayIds.size,
      activeLast7Days: activeUserIds7.size,
      avgHealthScore: Math.round(sumHealth / scoredCount),
      avgFood: Math.round(sumFood / scoredCount),
      avgWater: Math.round(sumWater / scoredCount),
      avgExercise: Math.round(sumExercise / scoredCount),
      avgMedicine: Math.round(sumMedicine / scoredCount),
      healthyCount,
      atRiskCount,
      inactiveCount,
      dailyActiveTrend,
      // Real stress data
      avgStressScore,
      highStressCount,
      moderateStressCount,
      lowStressCount,
      stressTrackedCount,
    });
  } catch (e) {
    req.log.error({ err: e }, "health-analytics error");
    res.status(500).json({ error: "Failed to fetch health analytics" });
  }
});

// ─── SEAT-BASED BILLING ─────────────────────────────────────────────────────

interface SeatPlanInfo {
  label: string;
  pricePerSeat: number;
  yearlyPricePerSeat: number;
  features: string[];
  color: string;
  discountPercent: number;
  offerLabel: string | null;
}

async function getOrgSeatPlan(planShortKey: string): Promise<SeatPlanInfo | null> {
  const dbKey = `org_${planShortKey}`;
  const now = new Date();
  const [plan] = await db.select().from(planPricingTable).where(eq(planPricingTable.planKey, dbKey));
  if (!plan) return null;

  const disc = plan.discountPercent ? Number(plan.discountPercent) : 0;
  const isOfferActive =
    disc > 0 &&
    (!plan.offerValidFrom || now >= new Date(plan.offerValidFrom)) &&
    (!plan.offerValidTo || now <= new Date(plan.offerValidTo));

  const baseMonthly = Number(plan.monthlyPrice);
  // yearlyPrice in DB is annual total; divide by 12 for per-seat/month equivalent
  const baseYearlyPerMonth = plan.yearlyPrice ? Number(plan.yearlyPrice) / 12 : Math.round(baseMonthly * 0.85);

  const effectiveMonthly = isOfferActive ? Math.round(baseMonthly * (1 - disc / 100)) : baseMonthly;
  const effectiveYearly = isOfferActive ? Math.round(baseYearlyPerMonth * (1 - disc / 100)) : Math.round(baseYearlyPerMonth);

  return {
    label: plan.displayName,
    pricePerSeat: effectiveMonthly,
    yearlyPricePerSeat: effectiveYearly,
    features: Array.isArray(plan.features) ? (plan.features as string[]) : [],
    color: plan.badgeColor || "#0077B6",
    discountPercent: isOfferActive ? disc : 0,
    offerLabel: isOfferActive ? plan.offerLabel : null,
  };
}

async function getAllSeatPlans(): Promise<Record<string, SeatPlanInfo>> {
  const [maxPlan, proPlan] = await Promise.all([
    getOrgSeatPlan("max"),
    getOrgSeatPlan("pro"),
  ]);
  const result: Record<string, SeatPlanInfo> = {};
  if (maxPlan) result["max"] = maxPlan;
  if (proPlan) result["pro"] = proPlan;
  // Fallback if DB has no data yet
  if (!result["max"]) result["max"] = { label: "Max", pricePerSeat: 199, yearlyPricePerSeat: 169, features: [], color: "#0077B6", discountPercent: 0, offerLabel: null };
  if (!result["pro"]) result["pro"] = { label: "Pro", pricePerSeat: 249, yearlyPricePerSeat: 211, features: [], color: "#7C3AED", discountPercent: 0, offerLabel: null };
  return result;
}

async function getAoraneGstin(): Promise<string> {
  try {
    const rows = await db.select({ gstin: companySettingsTable.gstin }).from(companySettingsTable).limit(1);
    return rows[0]?.gstin || "UPDATE_IN_ADMIN_PANEL";
  } catch { return "UPDATE_IN_ADMIN_PANEL"; }
}
const AORANE_STATE = "UP";
const GST_RATE = 0.18;

router.get("/business/billing/seat-plans", requireBusinessAuth, async (_req: BusinessRequest, res) => {
  try {
    const plans = await getAllSeatPlans();
    res.json({ plans, gstRate: GST_RATE * 100, aoranState: AORANE_STATE });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch seat plans" });
  }
});

router.post("/business/billing/seat-order", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    const { plan, seats, billingCycle, orgGstin, orgState } = req.body as { plan: string; seats: number; billingCycle: "monthly" | "yearly"; orgGstin?: string; orgState?: string };
    if (!plan || !["max", "pro"].includes(plan)) { res.status(400).json({ error: "Invalid plan. Choose 'max' or 'pro'" }); return; }
    const minSeats = plan === "pro" ? 20 : 10;
    if (!seats || seats < minSeats) { res.status(400).json({ error: `Minimum ${minSeats} seats required for ${plan === "pro" ? "Pro" : "Max"} plan` }); return; }
    if (!billingCycle || !["monthly", "yearly"].includes(billingCycle)) { res.status(400).json({ error: "billingCycle must be 'monthly' or 'yearly'" }); return; }

    const planInfo = await getOrgSeatPlan(plan);
    if (!planInfo) { res.status(400).json({ error: "Plan not found in database" }); return; }
    const pricePerSeat = billingCycle === "yearly" ? planInfo.yearlyPricePerSeat : planInfo.pricePerSeat;
    const months = billingCycle === "yearly" ? 12 : 1;
    const baseAmount = pricePerSeat * seats * months;
    const isSameState = (orgState || "").toUpperCase() === AORANE_STATE;
    const gstAmount = Math.round(baseAmount * GST_RATE);
    const cgstAmount = isSameState ? Math.round(gstAmount / 2) : 0;
    const sgstAmount = isSameState ? Math.round(gstAmount / 2) : 0;
    const igstAmount = isSameState ? 0 : gstAmount;
    const totalAmount = baseAmount + gstAmount;

    // Invoice number
    const year = new Date().getFullYear();
    const fy = new Date().getMonth() >= 3 ? `${year}-${String(year + 1).slice(2)}` : `${year - 1}-${String(year).slice(2)}`;
    const invoiceSeq = Math.floor(Math.random() * 9000) + 1000;
    const invoiceNumber = `AOR/${fy}/${invoiceSeq}`;

    const liveMode = isLiveMode();
    const testModeActive = isTestMode();

    if (!liveMode && !testModeActive) {
      res.status(503).json({ error: "Payment gateway not configured. Please contact support." }); return;
    }

    let razorpayOrderId: string | null = null;
    if (liveMode) {
      const rzOrder = await createOrder({ amount: totalAmount, receipt: `biz_${req.orgId!.substring(0, 8)}` });
      razorpayOrderId = rzOrder.id;
    }

    const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, req.orgId!));
    const [payment] = await db.insert(orgPaymentsTable).values({
      orgId: req.orgId!,
      plan,
      seats,
      amount: String(totalAmount),
      razorpayOrderId: razorpayOrderId || undefined,
      status: "pending",
    }).returning();

    res.json({
      paymentId: payment.id,
      invoiceNumber,
      plan,
      planLabel: planInfo.label,
      seats,
      billingCycle,
      pricePerSeat,
      months,
      baseAmount,
      gstAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      totalAmount,
      isSameState,
      gstRate: GST_RATE * 100,
      orgGstin: orgGstin || org.gstin,
      orgState: orgState || org.state,
      orgName: org.name,
      aoranGstin: await getAoraneGstin(),
      razorpayOrderId,
      razorpayKeyId: process.env["RAZORPAY_KEY_ID"] || null,
      isTestMode: testModeActive && !liveMode,
    });
  } catch (e) {
    req.log.error({ err: e }, "seat-order error");
    const msg = e instanceof Error && e.message ? e.message : "Failed to create seat order";
    res.status(500).json({ error: `Payment setup failed: ${msg}` });
  }
});

router.post("/business/billing/seat-verify", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    const { paymentId, razorpayPaymentId, razorpayOrderId, razorpaySignature, seats, plan, billingCycle } = req.body as Record<string, unknown>;
    if (!paymentId) { res.status(400).json({ error: "paymentId required" }); return; }

    // ALWAYS verify signature in LIVE mode — no isTestMode bypass allowed
    if (isLiveMode()) {
      if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        res.status(400).json({ error: "Payment details missing" }); return;
      }
      const { verifyPaymentSignature } = await import("../../lib/razorpay.js");
      const valid = verifyPaymentSignature(String(razorpayOrderId), String(razorpayPaymentId), String(razorpaySignature));
      if (!valid) { res.status(400).json({ error: "Payment verification failed" }); return; }
    }
    // Verify payment belongs to this org
    const [existingPay] = await db.select().from(orgPaymentsTable)
      .where(and(eq(orgPaymentsTable.id, String(paymentId)), eq(orgPaymentsTable.orgId, req.orgId!)));
    if (!existingPay) { res.status(404).json({ error: "Payment not found" }); return; }
    if (existingPay.status === "success") {
      const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, req.orgId!));
      res.json({ success: true, org, message: "Already activated", alreadyDone: true }); return;
    }

    const months = billingCycle === "yearly" ? 12 : 1;
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + (months as number));

    await db.update(orgPaymentsTable).set({
      status: "success",
      razorpayPaymentId: String(razorpayPaymentId || "test_" + Date.now()),
      expiresAt,
    }).where(eq(orgPaymentsTable.id, String(paymentId)));

    const seatCount = Number(seats) || 10;
    await db.update(organizationsTable).set({
      totalSeats: seatCount,
      plan: billingPlanToOrgPlan(String(plan)),
      isVerified: true,
    }).where(eq(organizationsTable.id, req.orgId!));

    const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, req.orgId!));

    // Send invoice email
    const [payment] = await db.select().from(orgPaymentsTable).where(eq(orgPaymentsTable.id, String(paymentId)));
    if (payment && org?.contactEmail) {
      const year = new Date().getFullYear();
      const fy = new Date().getMonth() >= 3 ? `${year}-${String(year + 1).slice(2)}` : `${year - 1}-${String(year).slice(2)}`;
      const invoiceSeq = Math.floor(Math.random() * 9000) + 1000;
      const invoiceNumber = `AOR/${fy}/${invoiceSeq}`;
      const planInfo = await getOrgSeatPlan(String(plan)) ?? { label: String(plan), pricePerSeat: 0, yearlyPricePerSeat: 0, features: [], color: "#0077B6", discountPercent: 0, offerLabel: null };
      const months = billingCycle === "yearly" ? 12 : 1;
      const pricePerSeat = billingCycle === "yearly" ? planInfo.yearlyPricePerSeat : planInfo.pricePerSeat;
      const baseAmt = pricePerSeat * seatCount * months;
      const isSameState = (org.state || "").toUpperCase() === AORANE_STATE;
      const gstAmt = Math.round(baseAmt * GST_RATE);
      const cgstAmt = isSameState ? Math.round(gstAmt / 2) : 0;
      const sgstAmt = isSameState ? Math.round(gstAmt / 2) : 0;
      const igstAmt = isSameState ? 0 : gstAmt;
      const totalAmt = baseAmt + gstAmt;
      sendInvoiceEmail({
        toEmail: org.contactEmail,
        orgName: org.name,
        invoiceData: {
          invoiceNumber,
          invoiceDate: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
          orgName: org.name,
          orgGstin: org.gstin || undefined,
          orgState: org.state || undefined,
          planLabel: planInfo.label,
          seats: seatCount,
          billingCycle: String(billingCycle || "monthly"),
          pricePerSeat,
          months,
          baseAmount: baseAmt,
          cgstAmount: cgstAmt,
          sgstAmount: sgstAmt,
          igstAmount: igstAmt,
          gstAmount: gstAmt,
          totalAmount: totalAmt,
          isSameState,
          razorpayPaymentId: String(razorpayPaymentId || ""),
        },
      }).catch((err) => logger.warn({ err }, "Invoice Email fire-and-forget error"));
      // Also send corporate payment welcome email with Enrollment Code
      db.select({ fullName: orgAdminsTable.fullName }).from(orgAdminsTable)
        .where(and(eq(orgAdminsTable.orgId, req.orgId!), eq(orgAdminsTable.role, "owner"))).limit(1)
        .then((admins) => {
          sendCorporatePaymentWelcomeEmail({
            toEmail: org.contactEmail!,
            adminName: admins[0]?.fullName || org.name,
            orgName: org.name,
            orgCode: org.orgCode,
            planName: planInfo.label,
            seats: seatCount,
            amountPaid: totalAmt,
            expiresAt,
          }).catch(() => {});
        }).catch(() => {});
    }

    res.json({ success: true, message: `${seatCount} seats activated! Your enrollment code is ready.`, org, expiresAt });
  } catch (e) {
    req.log.error({ err: e }, "seat-verify error");
    res.status(500).json({ error: "Failed to verify payment" });
  }
});

// ─── GET INVOICE ─────────────────────────────────────────────────────────────
router.get("/business/billing/invoices", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    const payments = await db.select().from(orgPaymentsTable)
      .where(and(eq(orgPaymentsTable.orgId, req.orgId!), eq(orgPaymentsTable.status, "success")))
      .orderBy(desc(orgPaymentsTable.createdAt));
    res.json({ invoices: payments });
  } catch { res.status(500).json({ error: "Failed to fetch invoices" }); }
});

// ─── CANCEL MEMBER SUBSCRIPTION ──────────────────────────────────────────────
router.post("/business/members/:userId/cancel-subscription", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    const userId = String(req.params.userId);
    const member = await db.select().from(orgMembersTable)
      .where(and(eq(orgMembersTable.orgId, req.orgId!), eq(orgMembersTable.userId, userId), eq(orgMembersTable.isActive, true)));
    if (!member.length) { res.status(404).json({ error: "Member not found in your organization" }); return; }

    // Downgrade user to free plan
    await db.update(usersTable).set({ plan: "free" }).where(eq(usersTable.id, userId));
    // Mark their subscription as cancelled if exists
    await db.update(subscriptionsTable).set({ status: "cancelled" }).where(and(eq(subscriptionsTable.userId, userId), eq(subscriptionsTable.status, "active")));

    res.json({ success: true, message: "Member subscription cancelled. Their plan downgraded to free." });
  } catch (e) {
    req.log.error({ err: e }, "cancel-member-sub error");
    res.status(500).json({ error: "Failed to cancel member subscription" });
  }
});

// ─── VERIFICATION STUBS (structure ready, implement when OTP/Gmail ready) ────
router.post("/business/verify/send-email", requireBusinessAuth, async (req: BusinessRequest, res) => {
  // STUB: Will send verification email when email service is configured
  res.json({ success: true, message: "Verification email sent (stub — configure email service to activate)", stub: true });
});

router.get("/business/verify/confirm-email", async (req, res) => {
  // STUB: Will verify email token when implemented
  const { token } = req.query as { token?: string };
  if (!token) { res.status(400).json({ error: "Verification token required" }); return; }
  res.json({ success: true, message: "Email verification stub — will be activated with email service", stub: true });
});

router.post("/business/verify/send-phone-otp", requireBusinessAuth, async (req: BusinessRequest, res) => {
  // STUB: Will send phone OTP when Twilio/MSG91 is configured
  res.json({ success: true, message: "Phone OTP sent (stub)", stub: true, devOtp: "123456" });
});

router.post("/business/verify/confirm-phone-otp", requireBusinessAuth, async (req: BusinessRequest, res) => {
  // STUB: Will verify phone OTP when implemented
  res.json({ success: true, message: "Phone OTP verified (stub)", stub: true });
});

function generateOrgCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default router;
