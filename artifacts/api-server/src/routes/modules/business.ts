import { Router } from "express";
import { logger } from "../../lib/logger";
import { db, pool, organizationsTable, orgAdminsTable, orgMembersTable, orgDepartmentsTable, orgDepartmentChangesTable, enrollmentCodesTable, usersTable, dailyHealthScoresTable, userProfilesTable, orgPaymentsTable, orgAnnouncementsTable, planPricingTable, subscriptionsTable, companySettingsTable, stressLogsTable, userPrivacySettingsTable, enquiriesTable } from "@workspace/db";
import { eq, and, inArray, gte, lte, desc, ilike, sql } from "drizzle-orm";
import { requireBusinessAuth } from "../../middlewares/business-auth";
import { requireAuth } from "../../middlewares/user-auth";
import { cache } from "../../lib/redis";
import { signBusinessToken, signUserToken, signRefreshToken } from "../../lib/jwt";
import type { BusinessRequest } from "../../middlewares/business-auth";
import { invalidateUserPlanCache } from "../../middlewares/user-auth";
import bcrypt from "bcryptjs";
import { generateOtp, hashOtp, verifyOtpHash, sendEmailOtp } from "../../lib/otp";
import { verifyAndMigratePassword } from "../../lib/auth-utils";
import {
  isLiveMode, isTestMode, createPlan, createSubscription, cancelSubscription,
  verifySubscriptionSignature, verifyPaymentSignature, createOrder,
} from "../../lib/razorpay";
import { sendInvoiceEmail } from "../../lib/invoice-email";
import { sendBusinessWelcomeEmail, sendCorporatePaymentWelcomeEmail, sendTeamMemberJoinedEmail } from "../../lib/welcome-email";
import { getNextInvoiceNumber } from "../../lib/invoice-number";
import { sanitizeAttribution } from "../../lib/attribution";
import { buildReportData } from "./corporate-report";

const router = Router();

router.post("/business/register", async (req, res) => {
  try {
    // C6: Rate limiting — max 5 registration attempts per IP per hour
    const { cache } = await import("../../lib/redis");
    const ip = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "unknown").split(",")[0].trim();
    const rlKey = `biz_register:${ip}`;
    const attempts = await cache.incrementRateLimitFixed(rlKey, 3600);
    if (attempts > 5) {
      res.status(429).json({ error: "Too many registration attempts. Please try again after 1 hour." });
      return;
    }

    const { orgType, name, contactEmail, contactPhone, city, state, countryCode = "IN", gstin, industry, companySize, hospitalType, bedCount, nabhAccredited, gymType, memberCount, irdaiLicense, totalSeats = 10, adminName, adminPassword, enquiryId, attribution } = req.body as Record<string, unknown>;

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

    // ── Marketing attribution linkage (best-effort, never blocks registration) ──
    // A company either arrives here having already filled the "Talk to an
    // expert"/demo enquiry (enquiryId links back to it, and its attribution
    // snapshot is inherited if this request didn't send its own), or it
    // self-registers straight from the pricing page (attribution captured
    // fresh, no enquiry). Either is a normal, expected path.
    let linkedEnquiryId: string | undefined;
    let orgAttribution = sanitizeAttribution(attribution) ?? null;
    if (typeof enquiryId === "string" && enquiryId.length > 0) {
      try {
        const [enquiry] = await db
          .select({ id: enquiriesTable.id, attribution: enquiriesTable.attribution })
          .from(enquiriesTable)
          .where(eq(enquiriesTable.id, enquiryId))
          .limit(1);
        if (enquiry) {
          linkedEnquiryId = enquiry.id;
          if (!orgAttribution && enquiry.attribution) orgAttribution = enquiry.attribution;
        }
      } catch {
        // Invalid/malformed enquiryId (e.g. not a UUID) — ignore, registration proceeds without the link.
      }
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
      enquiryId: linkedEnquiryId,
      attribution: orgAttribution,
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
    await cache.setOtp(`biz_email_verify:${admin.id}`, hashOtp(verifyOtp));
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
    const attempts = await cache.incrementRateLimitFixed(rlKey, 15 * 60);
    if (attempts > 10) {
      res.status(429).json({ error: "Too many login attempts. Try after 15 minutes." });
      return;
    }

    const [admin] = await db.select().from(orgAdminsTable).where(eq(orgAdminsTable.email, email));
    if (!admin || !admin.isActive) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const valid = await verifyAndMigratePassword(password, admin.passwordHash, async (h: any) => {
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
    const storedHash = await cache.getOtp(`biz_email_verify:${req.orgAdminId}`);
    if (!storedHash) { res.status(400).json({ error: "Verification code expired. Request a new one." }); return; }
    if (!verifyOtpHash(otp, storedHash)) { res.status(400).json({ error: "Invalid verification code" }); return; }
    await cache.deleteOtp(`biz_email_verify:${req.orgAdminId}`);
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
    await cache.setOtp(`biz_email_verify:${req.orgAdminId}`, hashOtp(verifyOtp));
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
    await cache.setOtp(`biz_forgot_otp:${email.toLowerCase()}`, hashed);
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

    // SECURITY FIX (CRITICAL): this had no rate limit on the verify step.
    // Unrestricted OTP guessing on a password-reset endpoint is a direct
    // account-takeover path — no valid session is even needed. Same
    // protection as /auth/verify-otp, applied here.
    const forgotVerifyLimitKey = `biz_forgot_verify:${email.toLowerCase()}`;
    const forgotVerifyAttempts = await cache.incrementRateLimitFixed(forgotVerifyLimitKey, 900);
    if (forgotVerifyAttempts > 5) {
      res.status(429).json({ error: "Too many failed attempts. Please request a new code after 15 minutes." });
      return;
    }

    const storedHash = await cache.getOtp(`biz_forgot_otp:${email.toLowerCase()}`);
    if (!storedHash) { res.status(400).json({ error: "Reset code expired or invalid. Request a new one." }); return; }
    if (!verifyOtpHash(otp, storedHash as string)) { res.status(400).json({ error: "Incorrect code. Please try again." }); return; }
    await cache.deleteOtp(`biz_forgot_otp:${email.toLowerCase()}`);
    await cache.resetRateLimit(forgotVerifyLimitKey);
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

    // SECURITY FIX: no rate limit on this verify step — only the send step
    // (/business/login/send-email-otp) was limited. Login-bypass risk via
    // OTP brute force.
    const loginVerifyLimitKey = `biz_login_verify:${email.toLowerCase()}`;
    const loginVerifyAttempts = await cache.incrementRateLimitFixed(loginVerifyLimitKey, 900);
    if (loginVerifyAttempts > 5) {
      res.status(429).json({ error: "Too many failed attempts. Please request a new OTP after 15 minutes." });
      return;
    }

    const storedHash = await cache.getOtp(`biz_login_otp:${email.toLowerCase()}`);
    if (!storedHash) {
      res.status(400).json({ error: "OTP expired or not found. Please log in again." });
      return;
    }
    if (!verifyOtpHash(otp, storedHash as string)) {
      res.status(400).json({ error: "Incorrect OTP. Please try again." });
      return;
    }
    await cache.resetRateLimit(loginVerifyLimitKey);
    await cache.deleteOtp(`biz_login_otp:${email.toLowerCase()}`);

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
    await cache.setOtp(`biz_reg_otp:${email.toLowerCase()}`, hashed);
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
    const storedHash = await cache.getOtp(`biz_reg_otp:${email.toLowerCase()}`);
    if (!storedHash) {
      res.status(400).json({ error: "Verification code expired. Please request a new one." });
      return;
    }
    if (!verifyOtpHash(otp, storedHash as string)) {
      res.status(400).json({ error: "Incorrect verification code. Please try again." });
      return;
    }
    await cache.deleteOtp(`biz_reg_otp:${email.toLowerCase()}`);
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
    const attempts = await cache.incrementRateLimitFixed(rlKey, 3600);
    if (attempts > 5) {
      res.status(429).json({ error: "Too many OTP requests. Try after 1 hour." });
      return;
    }
    const otp = generateOtp(6);
    const hashed = hashOtp(otp);
    await cache.setOtp(`biz_login_otp:${email.toLowerCase()}`, hashed);
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
      // Department is org/employment data, not health data, so it belongs on
      // this list. departmentStatus travels with it because the UI has to tell
      // "no department yet" (reassignable) apart from "chose not to say"
      // (must not be reassigned).
      departmentId: orgMembersTable.departmentId,
      departmentName: orgDepartmentsTable.name,
      departmentStatus: orgMembersTable.departmentStatus,
    }).from(orgMembersTable)
      .leftJoin(userProfilesTable, eq(orgMembersTable.userId, userProfilesTable.userId))
      .leftJoin(orgDepartmentsTable, eq(orgMembersTable.departmentId, orgDepartmentsTable.id))
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

    let queryCondition = isAoraneId
      ? eq(userProfilesTable.aoraneId, q)
      : ilike(userProfilesTable.fullName, `%${q}%`);

    const resultsRaw = await db.select({
      userId: userProfilesTable.userId,
      aoraneId: userProfilesTable.aoraneId,
      name: userProfilesTable.fullName,
      gender: userProfilesTable.gender,
      dateOfBirth: userProfilesTable.dateOfBirth,
      city: userProfilesTable.city,
      plan: usersTable.plan,
      // bmi and bloodGroup were selected here and returned per person to the
      // employer with no privacy check of any kind. Both are health data;
      // this endpoint exists to find a member to administer, not to profile
      // them, so neither is fetched any more.
    })
    .from(userProfilesTable)
    .innerJoin(orgMembersTable, eq(orgMembersTable.userId, userProfilesTable.userId))
    .leftJoin(usersTable, eq(usersTable.id, userProfilesTable.userId))
    .where(
      and(
        eq(orgMembersTable.orgId, req.orgId!),
        eq(orgMembersTable.isActive, true),
        queryCondition
      )
    )
    .limit(10);

    const results = resultsRaw.map((p: any) => ({
      userId: p.userId,
      aoraneId: p.aoraneId,
      name: p.name,
      gender: p.gender,
      age: p.dateOfBirth ? Math.floor((Date.now() - new Date(p.dateOfBirth).getTime()) / (86400000 * 365.25)) : null,
      city: p.city,
      plan: p.plan,
    }));

    res.json({ results, count: results.length });
  } catch (err) {
    req.log.error({ err }, "Business search error");
    res.status(500).json({ error: "Search failed" });
  }
});

// ─── Per-employee health data is deliberately NOT exposed here ───────────
// There was a GET /business/members/:userId/stress endpoint at this spot,
// returning one named employee's stress score, their 14-day trend and a
// "burnout risk" flag, straight to their employer. It is gone on purpose,
// and nothing per-person and health-related should take its place.
//
// Health data in this CRM is aggregate-only. That is what the product
// promises publicly (see the business portal's landing copy), it is what
// the org-level analytics endpoints below already deliver, and it is the
// only version of this feature that does not depend on employee consent
// that an employee is not in a position to freely refuse.
//
// The split to hold to is by DATA TYPE, not by admin permission level:
//   - employment/billing data (name, Aorane ID, join date, plan, seat
//     status) is per-person and fine - an admin has to run their seats;
//   - health data (scores, stress, sleep, BMI) is aggregate-only, at every
//     permission level, with no exception for owners or admins.
//
// Aggregate stress for the whole org is already served by
// GET /business/health-analytics (avgStressScore and the high/moderate/low
// distribution). Department-level breakdowns land in a later phase, behind
// a minimum-cohort threshold.

/**
 * How long an organization's employees keep their plan after the org's payment
 * window closes. Confirmed with Shiva at 7 days.
 *
 * The point is that the lapse is the ORGANIZATION's, not the employee's: an
 * employee who wakes up to find their health tracking downgraded because
 * someone in finance missed a renewal has been punished for a decision they had
 * no part in and no way to see coming. Seven days is enough for a renewal to be
 * chased without leaving an unpaid org running indefinitely.
 */
export const ORG_PLAN_GRACE_DAYS = 7;

export type OrgPlanState =
  /** A successful payment whose window is still open. */
  | "active"
  /** Window closed within the last ORG_PLAN_GRACE_DAYS. Existing employees keep
   *  their plan; new enrolments are not granted one. */
  | "grace"
  /** Window closed longer ago than that, or no successful payment at all. */
  | "expired";

/**
 * The single computation behind every "is this org paid up" question.
 *
 * Derived from org_payments on every call rather than read from
 * organizations.plan_status. That column is a denormalised label the lifecycle
 * job refreshes for the admin panel to display — if it ever drifts from the
 * payments (a manual edit, a missed cron run) the drift shows up as a stale
 * badge, not as an org that can or cannot grant plans. Access decisions are
 * never allowed to depend on a cache.
 */
export async function orgPlanState(orgId: string): Promise<OrgPlanState> {
  const { rows } = await pool.query<{ state: OrgPlanState }>(
    `SELECT CASE
              WHEN MAX(window_end) > NOW() THEN 'active'
              WHEN MAX(window_end) > NOW() - ($2 || ' days')::interval THEN 'grace'
              ELSE 'expired'
            END AS state
       FROM (
         SELECT COALESCE(expires_at, next_renewal_at, '-infinity'::timestamptz) AS window_end
           FROM org_payments
          WHERE org_id = $1 AND status = 'success'
       ) w`,
    [orgId, ORG_PLAN_GRACE_DAYS],
  );
  // No successful payment at all produces MAX(NULL) -> the ELSE branch, and an
  // org with no payment rows produces one row of NULL, so both land on expired.
  return rows[0]?.state ?? "expired";
}

// ─── Org payment gate — the single source of truth for "is this org allowed
// to grant employees a plan right now" ───────────────────────────────────
// Strict on purpose: grace covers employees who ALREADY hold a plan, not new
// ones being handed out. An org that has stopped paying should not keep
// enrolling people onto a paid tier for another week.
//
// Used at every point that grants an employee a plan: creating enrollment
// codes, and redeeming them (both the org-code path and the enrollment-code
// path). A code that was legitimately created while the org was paid must stop
// working the moment the org's payment lapses; checking only at creation time
// let a stale/leftover code keep minting free Pro/Max plans indefinitely.
async function hasActiveOrgPayment(orgId: string): Promise<boolean> {
  return (await orgPlanState(orgId)) === "active";
}

router.post("/business/enroll", requireAuth, async (req, res) => {
  try {
    const { orgCode } = req.body as { orgCode: string };
    const userId = (req as unknown as { userId: string }).userId;
    if (!orgCode) { res.status(400).json({ error: "Org code required" }); return; }

    const [org] = await db.select().from(organizationsTable).where(and(eq(organizationsTable.orgCode, orgCode), eq(organizationsTable.isActive, true)));
    if (!org) { res.status(404).json({ error: "Organization not found or inactive" }); return; }

    // An organization that has not paid does not block enrolment; it just does
    // not grant a plan. The employee becomes a member on Free and is told why,
    // and the lifecycle job upgrades them the moment the org pays. Refusing
    // instead would turn a billing lapse into the employee's problem and leave
    // the org with nobody enrolled to benefit from renewing.
    const orgState = await orgPlanState(org.id);
    const grantsPlan = orgState === "active";

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
    // Same reasoning as the enrollment-code path: joining an organization is
    // what makes someone an employee, whichever code they used to do it.
    // joinType is recorded either way — they are an employee regardless of
    // whether their employer is currently paying. The plan is not.
    await db.update(usersTable)
      .set(grantsPlan ? { plan: orgPlan, joinType: "employee" as const } : { joinType: "employee" as const })
      .where(eq(usersTable.id, userId));
    if (grantsPlan) {
      await db.insert(subscriptionsTable).values({
        userId, plan: orgPlan, status: "active", source: "organization",
        expiresAt, paymentType: "one_time", autoRenew: false, nextRenewalAt: expiresAt,
      }).onConflictDoNothing();
    }

    // FIX C3 + B1 — issue fresh JWT so the user's app sees the upgraded plan
    // on the very next request (no 30-day wait for the old token to expire).
    invalidateUserPlanCache(userId);
    let newAccessToken: string | undefined, newRefreshToken: string | undefined;
    try {
      const [u] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
      if (u) {
        const tokenPayload = { userId: u.id, phone: u.phone || undefined, email: u.email || undefined, plan: u.plan };
        newAccessToken = signUserToken(tokenPayload);
        newRefreshToken = signRefreshToken(tokenPayload);
      }
    } catch (e) {
      logger.warn({ err: (e as Error).message }, "Failed to rotate tokens after org enrollment");
    }

    // Best-effort personalized welcome email for the newly-enrolled employee
    try {
      const [u] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
      if (u?.email) {
        const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
        sendTeamMemberJoinedEmail({ toEmail: u.email, name: profile?.fullName || "", orgName: org.name }).catch(() => {});
      }
    } catch (e) {
      logger.warn({ err: (e as Error).message }, "Failed to send team-member-joined email (non-fatal)");
    }

    res.status(201).json({
      success: true,
      planUpgraded: grantsPlan ? orgPlan : null,
      orgPlanState: orgState,
      // Said plainly rather than left for the user to notice: a downgrade with
      // no explanation reads as the app being broken.
      notice: grantsPlan ? null
        : "Your company's plan is inactive, so you're on the Free plan for now. Ask your HR team to renew — you'll be upgraded automatically.",
      org: { name: org.name, type: org.orgType },
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch {
    res.status(500).json({ error: "Failed to enroll in organization" });
  }
});

// ─── POST: Use enrollment code (from enrollmentCodesTable) → upgrade user plan ─
router.post("/business/use-enrollment-code", requireAuth, async (req, res) => {
  try {
    // departmentId / departmentStatus / shareOrgAggregate arrive together with
    // the code from the employee onboarding flow, which asks for all of them
    // before redeeming. They stay optional so the older "enter a code from your
    // profile" path keeps working unchanged: it simply lands on the
    // not_listed default and leaves the aggregate consent untouched.
    const { code, departmentId, departmentStatus, shareOrgAggregate } = req.body as {
      code: string;
      departmentId?: string | null;
      departmentStatus?: "assigned" | "not_listed" | "declined";
      shareOrgAggregate?: boolean;
    };
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

    // Same as the org-code path: a lapsed organization is joinable, it just
    // does not grant its tier. See that path for why refusing would be worse.
    const orgState = await orgPlanState(org.id);
    const grantsPlan = orgState === "active";

    // Check if user already enrolled in this org
    const existing = await db.select().from(orgMembersTable)
      .where(and(eq(orgMembersTable.orgId, org.id), eq(orgMembersTable.userId, userId)));
    if (existing.length) { res.status(409).json({ error: "Already enrolled in this organization" }); return; }

    // Resolve the declared department against THIS org before writing it, so a
    // client cannot attach a member to another organization's department by
    // sending its id. Anything that does not resolve degrades to not_listed
    // rather than failing the whole enrolment — losing a department is
    // recoverable by the admin, losing the enrolment is not.
    let deptId: string | null = null;
    let deptStatus: "assigned" | "not_listed" | "declined" =
      departmentStatus === "declined" ? "declined" : "not_listed";
    if (departmentStatus === "assigned" && departmentId) {
      const [dept] = await db.select({ id: orgDepartmentsTable.id }).from(orgDepartmentsTable)
        .where(and(
          eq(orgDepartmentsTable.id, departmentId),
          eq(orgDepartmentsTable.orgId, org.id),
          eq(orgDepartmentsTable.isActive, true),
        )).limit(1);
      if (dept) { deptId = dept.id; deptStatus = "assigned"; }
    }

    // Enroll user
    await db.insert(orgMembersTable).values({
      orgId: org.id, userId, enrolledViaCode: code,
      departmentId: deptId, departmentStatus: deptStatus,
    });

    // Record the declaration in the same trail as admin reassignments, so the
    // history of a member's department is complete from the moment they join.
    // changedByAdminId is null: the member declared this themselves.
    await db.insert(orgDepartmentChangesTable).values({
      orgId: org.id, userId,
      fromDepartmentId: null, toDepartmentId: deptId,
      fromStatus: "not_listed", toStatus: deptStatus,
      changedByAdminId: null,
    }).catch(() => {});

    // Consent to being counted in the employer's department averages. Only
    // written when the client actually asked one way or the other — an older
    // client that never shows the question must not be read as consent.
    if (typeof shareOrgAggregate === "boolean") {
      await pool.query(
        `INSERT INTO user_privacy_settings (user_id, share_org_aggregate) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET share_org_aggregate = EXCLUDED.share_org_aggregate`,
        [userId, shareOrgAggregate],
      ).catch(() => {});
    }
    await db.update(enrollmentCodesTable).set({ usedSeats: enrollCode.usedSeats + 1 }).where(eq(enrollmentCodesTable.id, enrollCode.id));
    await db.update(organizationsTable).set({ usedSeats: org.usedSeats + 1 }).where(eq(organizationsTable.id, org.id));

    // Upgrade user plan based on enrollment code's planType
    const planToGrant = (["pro", "max", "family"].includes(enrollCode.planType) ? enrollCode.planType : "pro") as "pro" | "max" | "family";
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + enrollCode.validityDays);
    // join_type is set here rather than at the app's individual/employee
    // fork, because that fork happens before an account exists and is only
    // a statement of intent. Redeeming a code is the point at which the
    // user actually becomes an employee, so it is the only place the
    // server can record it as fact.
    await db.update(usersTable)
      .set(grantsPlan ? { plan: planToGrant, joinType: "employee" as const } : { joinType: "employee" as const })
      .where(eq(usersTable.id, userId));
    if (grantsPlan) {
      await db.insert(subscriptionsTable).values({
        userId, plan: planToGrant, status: "active", source: "organization",
        expiresAt, paymentType: "one_time", autoRenew: false, nextRenewalAt: expiresAt,
      }).onConflictDoNothing();
    }

    // FIX C3 + B1 — issue fresh JWT so the user's app sees the upgraded plan
    // on the very next request (no 30-day wait for the old token to expire).
    invalidateUserPlanCache(userId);
    let newAccessToken: string | undefined, newRefreshToken: string | undefined;
    try {
      const [u] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
      if (u) {
        const tokenPayload = { userId: u.id, phone: u.phone || undefined, email: u.email || undefined, plan: u.plan };
        newAccessToken = signUserToken(tokenPayload);
        newRefreshToken = signRefreshToken(tokenPayload);
      }
    } catch (e) {
      logger.warn({ err: (e as Error).message }, "Failed to rotate tokens after enrollment code use");
    }

    res.status(201).json({
      success: true,
      planUpgraded: grantsPlan ? planToGrant : null,
      orgPlanState: orgState,
      notice: grantsPlan ? null
        : "Your company's plan is inactive, so you're on the Free plan for now. Ask your HR team to renew — you'll be upgraded automatically.",
      expiresAt: grantsPlan ? expiresAt : null,
      org: { name: org.name, type: org.orgType },
      message: grantsPlan
        ? `${planToGrant.toUpperCase()} plan activated via ${org.name}!`
        : `You've joined ${org.name}.`,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch {
    res.status(500).json({ error: "Failed to use enrollment code" });
  }
});

router.post("/business/enrollment-codes", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    // PAYMENT GATE: only orgs with an active payment can create enrollment codes
    if (!(await hasActiveOrgPayment(req.orgId!))) {
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

// ─── ORG DEPARTMENTS ──────────────────────────────────────────────────────────
// The admin-managed list that employee onboarding offers as a dropdown. Kept a
// closed list on purpose: free-text departments fragment analytics across
// "Sales" / "sales" / "Sale", and no amount of cleaning afterwards recovers
// which of them was meant.

/** Shape returned to the portal for one department, with its live headcount. */
type DepartmentRow = {
  id: string; name: string; isActive: boolean;
  memberCount: number; createdAt: Date;
};

async function listDepartments(orgId: string): Promise<DepartmentRow[]> {
  const rows = await db
    .select({
      id: orgDepartmentsTable.id,
      name: orgDepartmentsTable.name,
      isActive: orgDepartmentsTable.isActive,
      createdAt: orgDepartmentsTable.createdAt,
      // Counts ACTIVE members only: a suspended or removed member still holds
      // a department row, but showing them in the headcount would disagree
      // with every other member count in the portal.
      memberCount: sql<number>`count(${orgMembersTable.id}) FILTER (WHERE ${orgMembersTable.isActive})::int`,
    })
    .from(orgDepartmentsTable)
    .leftJoin(orgMembersTable, eq(orgMembersTable.departmentId, orgDepartmentsTable.id))
    .where(eq(orgDepartmentsTable.orgId, orgId))
    .groupBy(orgDepartmentsTable.id)
    .orderBy(orgDepartmentsTable.name);
  return rows as DepartmentRow[];
}

router.get("/business/departments", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    const departments = await listDepartments(req.orgId!);
    // The two non-assigned buckets are reported alongside the departments
    // because they mean different things to an admin: `needsDepartment` is a
    // to-do (people whose department is not on the list yet), `declined` is
    // not (people who chose not to say, and must be left alone).
    const [counts] = await db
      .select({
        needsDepartment: sql<number>`count(*) FILTER (WHERE ${orgMembersTable.departmentStatus} = 'not_listed')::int`,
        declined: sql<number>`count(*) FILTER (WHERE ${orgMembersTable.departmentStatus} = 'declined')::int`,
      })
      .from(orgMembersTable)
      .where(and(eq(orgMembersTable.orgId, req.orgId!), eq(orgMembersTable.isActive, true)));
    res.json({ departments, unassigned: counts ?? { needsDepartment: 0, declined: 0 } });
  } catch (err) {
    req.log.error({ err }, "Department list error");
    res.status(500).json({ error: "Failed to fetch departments" });
  }
});

router.post("/business/departments", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    const name = String((req.body as { name?: unknown }).name ?? "").trim();
    if (!name) { res.status(400).json({ error: "Department name required" }); return; }
    if (name.length > 60) { res.status(400).json({ error: "Department name must be 60 characters or fewer" }); return; }

    // A soft-deleted department keeps its name (the unique index covers
    // inactive rows too), so "create Sales" when an inactive Sales exists is
    // a reactivation, not a conflict. Doing it any other way would leave the
    // admin unable to create a department whose name they can't see.
    const [existing] = await db.select().from(orgDepartmentsTable)
      .where(and(eq(orgDepartmentsTable.orgId, req.orgId!), sql`lower(${orgDepartmentsTable.name}) = lower(${name})`))
      .limit(1);
    if (existing) {
      if (existing.isActive) { res.status(409).json({ error: `"${existing.name}" already exists` }); return; }
      const [revived] = await db.update(orgDepartmentsTable)
        .set({ isActive: true, name })
        .where(eq(orgDepartmentsTable.id, existing.id)).returning();
      res.status(200).json({ department: revived, reactivated: true });
      return;
    }

    const [created] = await db.insert(orgDepartmentsTable)
      .values({ orgId: req.orgId!, name }).returning();
    res.status(201).json({ department: created });
  } catch (err) {
    req.log.error({ err }, "Department create error");
    res.status(500).json({ error: "Failed to create department" });
  }
});

router.patch("/business/departments/:id", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    const id = String(req.params["id"]);
    const body = req.body as { name?: unknown; isActive?: unknown };
    // Scoped by orgId as well as id, so an admin cannot rename another org's
    // department by guessing its UUID.
    const [dept] = await db.select().from(orgDepartmentsTable)
      .where(and(eq(orgDepartmentsTable.id, id), eq(orgDepartmentsTable.orgId, req.orgId!))).limit(1);
    if (!dept) { res.status(404).json({ error: "Department not found" }); return; }

    const patch: { name?: string; isActive?: boolean } = {};
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) { res.status(400).json({ error: "Department name required" }); return; }
      if (name.length > 60) { res.status(400).json({ error: "Department name must be 60 characters or fewer" }); return; }
      const [clash] = await db.select({ id: orgDepartmentsTable.id }).from(orgDepartmentsTable)
        .where(and(
          eq(orgDepartmentsTable.orgId, req.orgId!),
          sql`lower(${orgDepartmentsTable.name}) = lower(${name})`,
          sql`${orgDepartmentsTable.id} <> ${id}`,
        )).limit(1);
      if (clash) { res.status(409).json({ error: `"${name}" already exists` }); return; }
      patch.name = name;
    }
    if (body.isActive !== undefined) patch.isActive = Boolean(body.isActive);
    if (!Object.keys(patch).length) { res.status(400).json({ error: "Nothing to update" }); return; }

    const [updated] = await db.update(orgDepartmentsTable).set(patch)
      .where(eq(orgDepartmentsTable.id, id)).returning();
    res.json({ department: updated });
  } catch (err) {
    req.log.error({ err }, "Department update error");
    res.status(500).json({ error: "Failed to update department" });
  }
});

router.delete("/business/departments/:id", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    const id = String(req.params["id"]);
    const [dept] = await db.select().from(orgDepartmentsTable)
      .where(and(eq(orgDepartmentsTable.id, id), eq(orgDepartmentsTable.orgId, req.orgId!))).limit(1);
    if (!dept) { res.status(404).json({ error: "Department not found" }); return; }

    // Deactivate rather than DELETE, and move its members out explicitly.
    // The foreign key would already null out department_id on a hard delete,
    // but it would leave department_status reading 'assigned' with nothing
    // assigned - a state no other code path can produce. Members land in
    // 'not_listed', which is exactly right: their department no longer exists
    // and somebody has to choose a new one.
    //
    // Members who chose 'declined' are untouched: they have no department_id
    // to move, and overwriting their status would silently undo an opt-out.
    let movedMembers = 0;
    await db.transaction(async (tx) => {
      const affected = await tx.select({ userId: orgMembersTable.userId })
        .from(orgMembersTable)
        .where(and(eq(orgMembersTable.orgId, req.orgId!), eq(orgMembersTable.departmentId, id)));
      if (affected.length) {
        await tx.insert(orgDepartmentChangesTable).values(affected.map((m) => ({
          orgId: req.orgId!, userId: m.userId,
          fromDepartmentId: id, toDepartmentId: null,
          fromStatus: "assigned" as const, toStatus: "not_listed" as const,
          changedByAdminId: req.orgAdminId!,
        })));
        await tx.update(orgMembersTable)
          .set({ departmentId: null, departmentStatus: "not_listed" })
          .where(and(eq(orgMembersTable.orgId, req.orgId!), eq(orgMembersTable.departmentId, id)));
      }
      await tx.update(orgDepartmentsTable).set({ isActive: false }).where(eq(orgDepartmentsTable.id, id));
      movedMembers = affected.length;
    });

    res.json({ success: true, movedMembers,
      message: movedMembers
        ? `"${dept.name}" removed. ${movedMembers} member${movedMembers === 1 ? "" : "s"} now need a department.`
        : `"${dept.name}" removed.` });
  } catch (err) {
    req.log.error({ err }, "Department delete error");
    res.status(500).json({ error: "Failed to delete department" });
  }
});

// ─── Reassign one member's department ────────────────────────────────────────
// The documented answer to the fact that departments are self-declared and
// cannot be verified without an HRMS/SSO integration: rather than pretend the
// declaration is trustworthy, let an admin correct it afterwards, and record
// every correction.
router.post("/business/members/:userId/department", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    const userId = String(req.params["userId"]);
    const raw = (req.body as { departmentId?: unknown }).departmentId;
    const departmentId = raw === null || raw === undefined || raw === "" ? null : String(raw);

    const [member] = await db.select().from(orgMembersTable)
      .where(and(eq(orgMembersTable.orgId, req.orgId!), eq(orgMembersTable.userId, userId))).limit(1);
    if (!member) { res.status(404).json({ error: "Member not in organization" }); return; }

    // 'declined' means the member explicitly chose not to state a department.
    // An admin overriding that would make the opt-out decorative, so it is
    // refused here rather than merely hidden in the UI.
    if (member.departmentStatus === "declined") {
      res.status(403).json({
        error: "This member chose not to share their department. That choice cannot be overridden.",
        declined: true,
      });
      return;
    }

    let toStatus: "assigned" | "not_listed" = "not_listed";
    if (departmentId) {
      const [dept] = await db.select().from(orgDepartmentsTable)
        .where(and(
          eq(orgDepartmentsTable.id, departmentId),
          eq(orgDepartmentsTable.orgId, req.orgId!),
          eq(orgDepartmentsTable.isActive, true),
        )).limit(1);
      if (!dept) { res.status(404).json({ error: "Department not found in this organization" }); return; }
      toStatus = "assigned";
    }

    if (member.departmentId === departmentId && member.departmentStatus === toStatus) {
      res.json({ success: true, unchanged: true });
      return;
    }

    await db.transaction(async (tx) => {
      await tx.update(orgMembersTable)
        .set({ departmentId, departmentStatus: toStatus })
        .where(and(eq(orgMembersTable.orgId, req.orgId!), eq(orgMembersTable.userId, userId)));
      await tx.insert(orgDepartmentChangesTable).values({
        orgId: req.orgId!, userId,
        fromDepartmentId: member.departmentId, toDepartmentId: departmentId,
        fromStatus: member.departmentStatus, toStatus,
        changedByAdminId: req.orgAdminId!,
      });
    });

    res.json({ success: true, departmentId, departmentStatus: toStatus });
  } catch (err) {
    req.log.error({ err }, "Department reassign error");
    res.status(500).json({ error: "Failed to update member department" });
  }
});

// ─── EMPLOYEE ONBOARDING (pre-enrolment) ─────────────────────────────────────
// Used by the mobile app's employee path, which asks for an enrolment code
// BEFORE sign-in so the user is never sent through account creation only to
// discover their code is wrong.

/** Client IP, honouring the proxy header Render sits behind. */
function clientIp(req: { headers: Record<string, unknown>; socket: { remoteAddress?: string } }): string {
  const fwd = req.headers["x-forwarded-for"];
  const raw = (typeof fwd === "string" ? fwd : "") || req.socket.remoteAddress || "unknown";
  return raw.split(",")[0].trim();
}

/**
 * Resolve an enrolment code to its organization, applying every gate that
 * redemption itself applies. Returns a reason rather than throwing so callers
 * can decide what to tell the user.
 *
 * Deliberately shares one implementation with the "can this code still grant a
 * plan" question: a code that verifies here but fails at redemption would send
 * the user through sign-up and then reject them, which is the exact failure
 * this pre-check exists to prevent.
 */
type CodeCheck =
  // planState is carried rather than gating: an organization whose payment has
  // lapsed can still be JOINED, the employee just does not get its paid tier.
  // Refusing outright would punish an employee for their employer's billing,
  // and would leave the org with nobody enrolled to benefit when it renews.
  | { ok: true; org: { id: string; name: string }; planState: OrgPlanState }
  | { ok: false; reason: "invalid" | "expired" | "full" | "org_inactive" };

async function resolveEnrollmentCode(rawCode: string): Promise<CodeCheck> {
  const code = rawCode.toUpperCase().trim();
  const [enrollCode] = await db.select().from(enrollmentCodesTable)
    .where(and(eq(enrollmentCodesTable.code, code), eq(enrollmentCodesTable.isActive, true))).limit(1);
  if (!enrollCode) return { ok: false, reason: "invalid" };
  if (enrollCode.expiresAt && new Date(enrollCode.expiresAt) < new Date()) return { ok: false, reason: "expired" };
  if (enrollCode.usedSeats >= enrollCode.totalSeats) return { ok: false, reason: "full" };

  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, enrollCode.orgId)).limit(1);
  if (!org || !org.isActive) return { ok: false, reason: "org_inactive" };
  return { ok: true, org: { id: org.id, name: org.name }, planState: await orgPlanState(org.id) };
}

/** User-facing copy per failure. Every one of these ends with the same advice,
 *  because in every case the employee cannot fix it themselves. */
const CODE_ERROR_COPY: Record<Exclude<CodeCheck & { ok: false }, { ok: true }>["reason"], string> = {
  invalid:      "That code doesn't match any organization.",
  expired:      "This code has expired.",
  full:         "All seats for this code have been taken.",
  org_inactive: "This organization is not active right now.",
};

// UNAUTHENTICATED. It has to be: the whole point is to check the code before
// the user creates an account. Two consequences are handled deliberately.
//
// 1. It is an oracle. A caller can ask "is this code real" and, on success,
//    learn an organization's name. The org name is required by the product
//    ("Welcome to {Org}" before sign-in), so the mitigation is not secrecy but
//    cost: a tight per-IP budget below, far tighter than the global 300/15min
//    limiter, which would allow ~29k guesses a day.
// 2. It makes guessing a code worth more than it used to be, since previously
//    a code could only be tried from inside a signed-in account. Codes are 8
//    characters over a 36-character alphabet (~2.8e12 combinations), so 20
//    attempts an hour is not a practical search — but note the generator uses
//    Math.random(), not a CSPRNG. That predates this endpoint and is worth
//    revisiting separately; it is not what this rate limit is for.
router.post("/org/verify-code", async (req, res) => {
  try {
    const ip = clientIp(req as never);
    const attempts = await cache.incrementRateLimitFixed(`org_verify_code:${ip}`, 3600);
    if (attempts > 20) {
      res.status(429).json({ error: "Too many attempts. Please try again in an hour." });
      return;
    }

    const code = String((req.body as { code?: unknown }).code ?? "").trim();
    if (!code) { res.status(400).json({ error: "Enrollment code required", contactHr: true }); return; }

    const check = await resolveEnrollmentCode(code);
    if (!check.ok) {
      res.status(404).json({ error: CODE_ERROR_COPY[check.reason], reason: check.reason, contactHr: true });
      return;
    }
    // Name only. Nothing about seats, plan, member count or the org's id —
    // none of it is needed to render the welcome step, and all of it would be
    // readable by anyone holding a valid code.
    // planState lets the code screen say "you can join, but you'll be on Free
    // until they renew" before the user commits, instead of discovering it as
    // a silent downgrade after enrolling.
    res.json({ valid: true, org: { name: check.org.name }, planState: check.planState });
  } catch (err) {
    req.log.error({ err }, "Enrollment code verification error");
    res.status(500).json({ error: "Could not verify that code. Please try again." });
  }
});

// Departments for the code's organization, for the dropdown shown immediately
// after sign-in. requireAuth rather than public: by this point the user has an
// account, so there is no reason to expose an organization's internal
// structure to anonymous callers. The code is still required — being signed in
// does not entitle you to browse other organizations' departments.
router.get("/org/departments", requireAuth, async (req, res) => {
  try {
    const code = String((req.query["code"] as string | undefined) ?? "").trim();
    if (!code) { res.status(400).json({ error: "Enrollment code required" }); return; }

    const check = await resolveEnrollmentCode(code);
    if (!check.ok) {
      res.status(404).json({ error: CODE_ERROR_COPY[check.reason], reason: check.reason, contactHr: true });
      return;
    }

    const departments = await db.select({ id: orgDepartmentsTable.id, name: orgDepartmentsTable.name })
      .from(orgDepartmentsTable)
      .where(and(eq(orgDepartmentsTable.orgId, check.org.id), eq(orgDepartmentsTable.isActive, true)))
      .orderBy(orgDepartmentsTable.name);

    // An org with no departments configured is a normal state, not an error:
    // the client shows only the "not listed" and "prefer not to say" choices.
    res.json({ org: { name: check.org.name }, departments });
  } catch (err) {
    req.log.error({ err }, "Onboarding department list error");
    res.status(500).json({ error: "Could not load departments. Please try again." });
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
    const activePayment = payments.find((p: any) => p.status === "success") || payments.find((p: any) => p.autoRenew) || payments[0] || null;
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
    const { paymentId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body as Record<string, unknown>;
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
    // ISSUE 2 FIX: plan comes from the DB-stored payment record (decided
    // server-side at /business/billing/order time), never from client body.
    const plan = existingPayment.plan;
    const orgPlansVerify = await getOrgPlansFromDB();
    const planInfo = orgPlansVerify[plan];
    if (!planInfo) { res.status(400).json({ error: "Invalid plan" }); return; }
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    await db.transaction(async (tx) => {
      // `expiresAt` (computed just above, one year out) was previously used
      // only for the welcome email and never stored, leaving every one-time
      // org payment with a NULL expires_at — which is why the access gate
      // above had nothing to check and treated lapsed orgs as paid forever.
      await tx.update(orgPaymentsTable).set({ status: "success", razorpayPaymentId: razorpayPaymentId as string, expiresAt }).where(eq(orgPaymentsTable.id, paymentId as string));
      await tx.update(organizationsTable).set({
        totalSeats: planInfo.seats, plan: billingPlanToOrgPlan(plan), isVerified: true,
      }).where(eq(organizationsTable.id, req.orgId!));
    });
    const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, req.orgId!));
    // Fire-and-forget corporate payment welcome email with Enrollment Code
    if (org?.contactEmail) {
      db.select({ fullName: orgAdminsTable.fullName }).from(orgAdminsTable)
        .where(and(eq(orgAdminsTable.orgId, req.orgId!), eq(orgAdminsTable.role, "owner"))).limit(1)
        .then((admins: any) => {
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
        autoRenew: true, nextRenewalAt: expiresAt, expiresAt,
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
    const { paymentId, razorpaySubscriptionId, razorpayPaymentId, razorpaySignature } = req.body as Record<string, string>;
    if (isLiveMode()) {
      const valid = verifySubscriptionSignature(razorpaySubscriptionId, razorpayPaymentId, razorpaySignature);
      if (!valid) { res.status(400).json({ error: "Payment signature invalid" }); return; }
    }
    // ISSUE 2 FIX: plan comes from the org_payments row (set server-side at
    // /business/billing/subscription/create), never from client body.
    const [payRow] = await db.select().from(orgPaymentsTable)
      .where(and(eq(orgPaymentsTable.id, paymentId), eq(orgPaymentsTable.orgId, req.orgId!)));
    if (!payRow) { res.status(404).json({ error: "Payment not found" }); return; }
    const plan = payRow.plan;
    const orgPlans = await getOrgPlansFromDB();
    const planInfo = orgPlans[plan];
    if (!planInfo) { res.status(400).json({ error: "Invalid plan" }); return; }
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    await db.transaction(async (tx) => {
      await tx.update(orgPaymentsTable).set({ status: "success", nextRenewalAt: expiresAt }).where(eq(orgPaymentsTable.id, paymentId));
      await tx.update(organizationsTable).set({
        totalSeats: planInfo.seats, plan: billingPlanToOrgPlan(plan), isVerified: true,
      }).where(eq(organizationsTable.id, req.orgId!));
    });
    const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, req.orgId!));
    // Fire-and-forget corporate payment welcome email with Enrollment Code
    if (org?.contactEmail) {
      db.select({ fullName: orgAdminsTable.fullName }).from(orgAdminsTable)
        .where(and(eq(orgAdminsTable.orgId, req.orgId!), eq(orgAdminsTable.role, "owner"))).limit(1)
        .then((admins: any) => {
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
    const memberIds = memberRows.map((m: any) => m.userId);

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
// ─── Smart Alerts (notification bell) — Phase 4 polish ────────────────────
// No new table: computed live, each turn, from data the portal already
// has (payment status, health analytics, seat capacity). Each alert links
// to the exact page that resolves it. Deliberately conservative — only
// surfaces something when there's a real, specific condition to flag.
router.get("/business/alerts", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    const orgId = req.orgId!;
    const alerts: { id: string; severity: "info" | "warning" | "critical"; title: string; detail: string; href: string }[] = [];

    const [activePayment] = await db.select({ id: orgPaymentsTable.id }).from(orgPaymentsTable)
      .where(and(eq(orgPaymentsTable.orgId, orgId), eq(orgPaymentsTable.status, "success"))).limit(1);
    if (!activePayment) {
      alerts.push({ id: "no-active-payment", severity: "warning", title: "Subscription not active", detail: "Activate your plan to start onboarding employees.", href: "/billing" });
    }

    const [org] = await db.select({ totalSeats: organizationsTable.totalSeats, usedSeats: organizationsTable.usedSeats })
      .from(organizationsTable).where(eq(organizationsTable.id, orgId));
    if (org && org.totalSeats > 0 && org.usedSeats / org.totalSeats >= 0.9) {
      alerts.push({ id: "seats-almost-full", severity: "warning", title: "Seats almost full", detail: `${org.usedSeats} of ${org.totalSeats} seats used — consider upgrading.`, href: "/billing" });
    }

    const memberRows = await db.select({ userId: orgMembersTable.userId }).from(orgMembersTable)
      .where(and(eq(orgMembersTable.orgId, orgId), eq(orgMembersTable.isActive, true)));
    const memberIds = memberRows.map((m: any) => m.userId);
    if (memberIds.length > 0) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentStress = await db.select({ stressScore: stressLogsTable.stressScore }).from(stressLogsTable)
        .where(and(inArray(stressLogsTable.userId, memberIds), gte(stressLogsTable.loggedAt, sevenDaysAgo)));
      if (recentStress.length > 0) {
        const avgStress = recentStress.reduce((a: number, r: any) => a + r.stressScore, 0) / recentStress.length;
        if (avgStress >= 75) {
          alerts.push({ id: "high-stress", severity: "critical", title: "Elevated team stress this week", detail: `Average stress score is ${Math.round(avgStress)}/100 — consider a wellness check-in.`, href: "/dashboard" });
        }
      }
    }

    res.json({ alerts });
  } catch (e) {
    logger.error({ err: e }, "alerts computation error");
    res.status(500).json({ error: "Failed to compute alerts" });
  }
});

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
    // A 7-day window of this employee's daily_health_scores used to be read
    // here and returned to their employer, gated by nothing at all - the
    // privacy check below only ever covered the profile fields. Health data
    // is aggregate-only in this CRM, so the query is gone rather than merely
    // filtered: the rows are never fetched.

    // BUG-8: Respect shareBasicProfile — if false, hide all identity fields
    const shareBasic = privacy?.shareBasicProfile !== false;
    const safeProfile = profile ? {
      fullName: shareBasic ? profile.fullName : null,
      gender: shareBasic ? profile.gender : null,
      city: shareBasic ? profile.city : null,
      state: shareBasic ? profile.state : null,
    } : null;

    res.json({ member, profile: safeProfile, user: { plan: user?.plan, aoraneId: profile?.aoraneId } });
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
    const valid = await verifyAndMigratePassword(currentPassword, admin.passwordHash, async (h: any) => {
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
      // No health fields here. These lists exist so an admin can see who holds
      // a seat; bloodGroup used to ride along and had nothing to do with that.
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
    const memberIds = memberRows.map((m: any) => m.userId);
    if (!memberIds.length) {
      res.json({ totalMembers: 0, activeToday: 0, activeLast7Days: 0, avgHealthScore: 0, healthScoreTrendPct: null, avgFood: 0, avgWater: 0, avgExercise: 0, avgMedicine: 0, healthyCount: 0, atRiskCount: 0, inactiveCount: 0, dailyActiveTrend: [], avgStressScore: null, highStressCount: 0, moderateStressCount: 0, lowStressCount: 0, stressTrackedCount: 0 });
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
    // Sub-scores are nullable: null means "this member never tracked that
    // metric", which is not the same as scoring 0 at it. healthScore is
    // NOT NULL in the schema, so only the four sub-scores carry null.
    const latestByUser = new Map<string, { scoreDate: string; healthScore: number; foodScore: number | null; waterScore: number | null; exerciseScore: number | null; medicineScore: number | null }>();
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
    // Mean of the tracked values only; null when none were tracked.
    const avgSub = (bucket: [number, number] | number[]): number | null =>
      bucket[1] > 0 ? Math.round(bucket[0] / bucket[1]) : null;
    let sumHealth = 0;
    // Each sub-score averages over the members who actually tracked it, not
    // over everyone. Summing a null as 0 would both produce NaN and drag a
    // company's average down for metrics its staff simply never logged.
    const subScores = { food: [0, 0], water: [0, 0], exercise: [0, 0], medicine: [0, 0] };
    const addSub = (bucket: [number, number] | number[], value: number | null) => {
      if (value === null) return;
      bucket[0] += value;
      bucket[1] += 1;
    };
    const scored = Array.from(latestByUser.values());
    for (const s of scored) {
      sumHealth += s.healthScore;
      addSub(subScores.food, s.foodScore);
      addSub(subScores.water, s.waterScore);
      addSub(subScores.exercise, s.exerciseScore);
      addSub(subScores.medicine, s.medicineScore);
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
      ? Math.round(stressValues.reduce((a: any, b: any) => a + b, 0) / stressValues.length)
      : null;
    const highStressCount = stressValues.filter(v => v >= 70).length;
    const moderateStressCount = stressValues.filter(v => v >= 40 && v < 70).length;
    const lowStressCount = stressValues.filter(v => v < 40).length;
    const stressTrackedCount = stressValues.length;

    // ── Week-over-week Org Health Index trend (real, from the same
    // 30-day `scores` already fetched above — no new query needed) ──
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const thisWeekScores = scores.filter(s => s.scoreDate >= sevenDaysAgo);
    const lastWeekScores = scores.filter(s => s.scoreDate >= fourteenDaysAgo && s.scoreDate < sevenDaysAgo);
    const avg = (arr: typeof scores) => arr.length ? arr.reduce((a, s) => a + s.healthScore, 0) / arr.length : null;
    const avgThisWeek = avg(thisWeekScores);
    const avgLastWeek = avg(lastWeekScores);
    const healthScoreTrendPct = (avgThisWeek !== null && avgLastWeek !== null && avgLastWeek > 0)
      ? Math.round(((avgThisWeek - avgLastWeek) / avgLastWeek) * 100)
      : null;

    res.json({
      totalMembers: memberIds.length,
      activeToday: activeTodayIds.size,
      activeLast7Days: activeUserIds7.size,
      avgHealthScore: Math.round(sumHealth / scoredCount),
      healthScoreTrendPct,
      // null (not 0) when nobody in the company tracked that metric at all —
      // the client already renders a null sub-score as "not tracked".
      avgFood: avgSub(subScores.food),
      avgWater: avgSub(subScores.water),
      avgExercise: avgSub(subScores.exercise),
      avgMedicine: avgSub(subScores.medicine),
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
  if (!result["pro"]) result["pro"] = { label: "Pro", pricePerSeat: 199, yearlyPricePerSeat: 169, features: [], color: "#0077B6", discountPercent: 0, offerLabel: null };
  if (!result["max"]) result["max"] = { label: "Max", pricePerSeat: 249, yearlyPricePerSeat: 211, features: [], color: "#7C3AED", discountPercent: 0, offerLabel: null };
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

// ─── PUBLIC MARKETING ENDPOINTS (no auth — safe, non-sensitive, aggregate-only) ─

// Public pricing — same seat-plan data shown on the business landing page.
// Unauthenticated on purpose: pricing is public information by definition.
router.get("/business/public/plans", async (_req, res) => {
  try {
    const plans = await getAllSeatPlans();
    res.json({ plans, gstRate: GST_RATE * 100, aoraneState: AORANE_STATE });
  } catch (e) {
    logger.error({ err: e }, "public plans error");
    res.status(500).json({ error: "Failed to fetch plans" });
  }
});

// Public, platform-wide (not per-org) 7-day engagement rate — used by the
// landing page's "built for engagement" stat. Deliberately aggregate-only
// (no org names, no individual data) and gated behind a minimum sample size
// so a handful of pilot orgs can never produce a misleadingly high/low
// percentage. Reuses the exact same "active in last 7 days" definition as
// the authenticated /business/health-analytics endpoint (any dailyHealthScoresTable
// row for the user within the last 7 days), just summed across every active org
// instead of one.
const MIN_SAMPLE_SIZE_FOR_PUBLIC_STAT = 50;

router.get("/business/public/engagement-stat", async (_req, res) => {
  try {
    const activeOrgs = await db.select({ id: organizationsTable.id })
      .from(organizationsTable)
      .where(eq(organizationsTable.isActive, true));
    const orgIds = activeOrgs.map((o: any) => o.id);
    if (!orgIds.length) {
      res.json({ sampleSufficient: false, totalMembers: 0, activeLast7Days: 0, engagementRatePercent: null });
      return;
    }

    const memberRows = await db.select({ userId: orgMembersTable.userId })
      .from(orgMembersTable)
      .where(and(inArray(orgMembersTable.orgId, orgIds), eq(orgMembersTable.isActive, true)));
    const memberIds = Array.from(new Set(memberRows.map((m: any) => m.userId)));

    if (memberIds.length < MIN_SAMPLE_SIZE_FOR_PUBLIC_STAT) {
      res.json({ sampleSufficient: false, totalMembers: memberIds.length, activeLast7Days: 0, engagementRatePercent: null });
      return;
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const scores = await db.select({ userId: dailyHealthScoresTable.userId })
      .from(dailyHealthScoresTable)
      .where(and(
        inArray(dailyHealthScoresTable.userId, memberIds),
        gte(dailyHealthScoresTable.scoreDate, sevenDaysAgo)
      ));
    const activeLast7Days = new Set(scores.map((s: any) => s.userId)).size;
    const engagementRatePercent = Math.round((activeLast7Days / memberIds.length) * 100);

    res.json({
      sampleSufficient: true,
      totalMembers: memberIds.length,
      activeLast7Days,
      engagementRatePercent,
    });
  } catch (e) {
    logger.error({ err: e }, "public engagement-stat error");
    // Fail closed: the landing page treats a non-200 as "no stat available"
    // and falls back to the industry-benchmark comparison copy instead.
    res.status(500).json({ error: "Failed to compute engagement stat" });
  }
});

// ─── "Aorane Health-Certified Workplace" — real, threshold-based, public ──
// From the Differentiation & Whitespace Strategy: a shareable certification
// an org can display on their careers page / LinkedIn once real usage
// clears a bar. Deliberately conservative, real thresholds computed from
// the SAME data as the authenticated monthly report — nothing invented.
// Public by design (that's the point of a badge someone can verify), but
// only exposes: org name, pass/fail, and the month it was computed for —
// never member-level data or the org's enrollment code.
const CERTIFICATION_THRESHOLDS = { minEngagementPct: 50, minAvgHealthScore: 65 };

async function computeCertification(orgId: string) {
  const [org] = await db.select({ id: organizationsTable.id, name: organizationsTable.name, isActive: organizationsTable.isActive })
    .from(organizationsTable).where(eq(organizationsTable.id, orgId));
  if (!org || !org.isActive) return null;

  const month = new Date().toISOString().slice(0, 7);
  const report = await buildReportData(orgId, month);
  const engagementPct = report.totalMembers > 0 ? Math.round((report.activeMembers / report.totalMembers) * 100) : 0;
  const avgHealthScore = report.averages?.healthScore ?? 0;

  const certified = report.totalMembers >= 10
    && engagementPct >= CERTIFICATION_THRESHOLDS.minEngagementPct
    && avgHealthScore >= CERTIFICATION_THRESHOLDS.minAvgHealthScore;

  return { orgName: org.name, month, certified, engagementPct, avgHealthScore, thresholds: CERTIFICATION_THRESHOLDS };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get("/business/public/certification/:orgId", async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.orgId)) {
      res.status(400).json({ error: "Invalid organization ID format. This must be the organization's internal UUID, not its enrollment/org code." });
      return;
    }
    const result = await computeCertification(req.params.orgId);
    if (!result) { res.status(404).json({ error: "Organization not found" }); return; }
    res.json(result);
  } catch (e) {
    logger.error({ err: e }, "certification status error");
    res.status(500).json({ error: "Failed to compute certification status" });
  }
});

router.get("/business/public/certification/:orgId/badge.svg", async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.orgId)) {
      res.status(400).send("");
      return;
    }
    const result = await computeCertification(req.params.orgId);
    const certified = result?.certified ?? false;
    const label = certified ? "Aorane Health-Certified" : "Aorane Health — Not Yet Certified";
    const fill = certified ? "#05473C" : "#9CA3AF";
    const accent = certified ? "#00C79A" : "#D1D5DB";
    const width = certified ? 268 : 300;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="56" viewBox="0 0 ${width} 56">
  <rect width="${width}" height="56" rx="14" fill="${fill}"/>
  <circle cx="28" cy="28" r="12" fill="${accent}"/>
  ${certified ? `<path d="M22 28l4 4 8-8" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : `<path d="M28 20v10M28 33v1" stroke="white" stroke-width="2.5" stroke-linecap="round"/>`}
  <text x="50" y="24" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="white">${label}</text>
  <text x="50" y="39" font-family="Arial, sans-serif" font-size="9" fill="rgba(255,255,255,0.7)">${result?.orgName ?? "Aorane Business"} · ${result?.month ?? ""}</text>
</svg>`;
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(svg);
  } catch (e) {
    logger.error({ err: e }, "certification badge error");
    res.status(500).send("");
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
    // ISSUE 4 FIX: invoice number is no longer generated here — it's a
    // preview/estimate before payment, not a real invoice yet. The actual
    // sequential invoice number is generated only at seat-verify (payment
    // success) time, via getNextInvoiceNumber().

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
      billingCycle,
      amount: String(totalAmount),
      razorpayOrderId: razorpayOrderId || undefined,
      status: "pending",
    }).returning();

    res.json({
      paymentId: payment.id,
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
    const { paymentId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body as Record<string, unknown>;
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
    // ISSUE 2 FIX: seats, plan, and billingCycle ALL now come from the DB
    // order record (set server-side at /business/billing/seat-order time) —
    // previously this endpoint trusted all three directly from the client
    // body, meaning an org could pay for e.g. 10 seats and claim 500 seats,
    // or claim a different (cheaper-billed) plan than what was actually paid.
    const seats = existingPay.seats;
    const plan = existingPay.plan;
    const billingCycle = existingPay.billingCycle ?? "monthly";

    const months = billingCycle === "yearly" ? 12 : 1;
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + (months as number));
    const seatCount = Number(seats) || 10;

    await db.transaction(async (tx) => {
      await tx.update(orgPaymentsTable).set({
        status: "success",
        razorpayPaymentId: String(razorpayPaymentId || "test_" + Date.now()),
        expiresAt,
      }).where(eq(orgPaymentsTable.id, String(paymentId)));

      await tx.update(organizationsTable).set({
        totalSeats: seatCount,
        plan: billingPlanToOrgPlan(String(plan)),
        isVerified: true,
      }).where(eq(organizationsTable.id, req.orgId!));
    });

    const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, req.orgId!));

    // Send invoice email
    const [payment] = await db.select().from(orgPaymentsTable).where(eq(orgPaymentsTable.id, String(paymentId)));
    if (payment && org?.contactEmail) {
      // ISSUE 4 FIX: sequential, DB-backed invoice number (was Math.random()).
      const invoiceNumber = await getNextInvoiceNumber();
      await db.update(orgPaymentsTable).set({ invoiceNumber }).where(eq(orgPaymentsTable.id, String(paymentId)));
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
        .then((admins: any) => {
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
