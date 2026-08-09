import { Router } from "express";
import { db, pool, usersTable, userPreferencesTable, userPrivacySettingsTable, userProfilesTable, otpStoreTable, userAuthProvidersTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { generateOtp, hashOtp, verifyOtpHash, sendSmsOtp, sendWhatsappOtp, sendEmailOtp, emailOtpKey } from "../../lib/otp";
import { sendWelcomeEmail } from "../../lib/welcome-email";
import { cache } from "../../lib/redis";
import { signUserToken, signRefreshToken, verifyRefreshToken } from "../../lib/jwt";
import { requireAuth } from "../../middlewares/user-auth";
import type { AuthRequest } from "../../middlewares/user-auth";
import { logger } from "../../lib/logger";

const router = Router();

/** OBS-1: Normalize +91 prefix, leading 91, leading 0 (STD), and spaces before 10-digit validation */
function normalizePhone(raw: string): string {
  return (raw || "").trim()
    .replace(/\s+/g, "")
    .replace(/^\+91/, "")
    .replace(/^91(?=\d{10}$)/, "")
    .replace(/^0(?=\d{10}$)/, "");  // Strip STD leading-0 (e.g. 09876543210 → 9876543210)
}

router.post("/auth/send-otp", async (req, res) => {
  try {
    const { phone: rawPhone, countryCode = "IN" } = req.body as { phone: string; countryCode?: string };
    const phone = normalizePhone(rawPhone);
    if (!phone || !/^\d{10}$/.test(phone)) {
      res.status(400).json({ error: "Valid 10-digit phone number required" });
      return;
    }

    const rateLimitKey = `otp_req:${phone}`;
    const attempts = await cache.incrementRateLimitFixed(rateLimitKey, 3600);
    if (attempts > 5) {
      res.status(429).json({ error: "Too many OTP requests. Try after 1 hour." });
      return;
    }

    const otp = generateOtp(6);
    const hashed = hashOtp(otp);

    // Try DB storage first, fallback to in-memory
    let usedDb = false;
    try {
      await db.delete(otpStoreTable).where(eq(otpStoreTable.phone, phone));
      await db.insert(otpStoreTable).values({
        phone,
        hashedOtp: hashed,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });
      usedDb = true;
    } catch {
      await cache.setOtp(phone, hashed);
    }

    if (process.env.NODE_ENV !== "production") {
      logger.info({ storage: usedDb ? "db" : "memory" }, "[OTP] storage");
    }

    const smsSent = await sendSmsOtp(phone, otp);

    if (process.env.NODE_ENV !== "production") {
      logger.info({ phone, smsSent }, "[OTP] sent");
    }

    // TEST_PHONES: comma-separated list of numbers that always receive devOtp in response
    const testPhones = (process.env.TEST_PHONES || "").split(",").map(p => p.trim()).filter(Boolean);
    const isTestPhone = testPhones.includes(phone);
    const isDev = process.env.NODE_ENV !== "production";
    const returnDevOtp = !smsSent && (isDev || isTestPhone);

    res.json({
      success: true,
      message: smsSent ? "OTP sent via SMS" : (isTestPhone ? "Test mode — OTP in response" : "SMS service temporarily unavailable"),
      ...(returnDevOtp ? { devOtp: otp } : {}),
      smsSent,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const cause = (err as any)?.cause?.message || (err as any)?.cause || "";
    req.log.error({ msg, cause }, "OTP ERROR");
    res.status(500).json({ error: "Failed to send OTP", detail: msg, cause: String(cause) });
  }
});

router.post("/auth/send-otp-whatsapp", async (req, res) => {
  try {
    const { phone: rawPhoneWa } = req.body as { phone: string };
    const phone = normalizePhone(rawPhoneWa);
    if (!phone || !/^\d{10}$/.test(phone)) {
      res.status(400).json({ error: "Valid 10-digit phone number required" });
      return;
    }
    const rateLimitKey = `otp_req:${phone}`;
    const attempts = await cache.incrementRateLimitFixed(rateLimitKey, 3600);
    if (attempts > 5) {
      res.status(429).json({ error: "Too many OTP requests. Try after 1 hour." });
      return;
    }
    const otp = generateOtp(6);
    const hashed = hashOtp(otp);
    // BUG-2: Persist to DB for multi-instance/restart resilience (same as SMS OTP)
    try {
      await db.delete(otpStoreTable).where(eq(otpStoreTable.phone, phone));
      await db.insert(otpStoreTable).values({ phone, hashedOtp: hashed, expiresAt: new Date(Date.now() + 15 * 60 * 1000) });
    } catch { await cache.setOtp(phone, hashed); }
    const result = await sendWhatsappOtp(phone, otp);
    const isDevWa = process.env.NODE_ENV !== "production";
    if (isDevWa) {
      logger.info({ phone, channel: result.fallback ? "sms" : "whatsapp" }, "[OTP-WA] sent");
    }
    const testPhonesWa = (process.env.TEST_PHONES || "").split(",").map(p => p.trim()).filter(Boolean);
    const isTestPhoneWa = testPhonesWa.includes(phone);
    const returnDevOtpWa = !result.success && (isDevWa || isTestPhoneWa);
    if (result.fallback) {
      res.json({ success: true, message: "OTP sent via SMS (WhatsApp unavailable)", channel: "sms", ...(returnDevOtpWa ? { devOtp: otp } : {}), smsSent: result.success });
    } else {
      res.json({ success: true, message: "OTP sent via WhatsApp", channel: "whatsapp", ...(returnDevOtpWa ? { devOtp: otp } : {}), smsSent: result.success });
    }
  } catch {
    res.status(500).json({ error: "Failed to send WhatsApp OTP" });
  }
});

router.post("/auth/verify-otp", async (req, res) => {
  try {
    const { phone: rawPhoneVerify, otp, countryCode = "IN", languageCode = "hi" } = req.body as {
      phone: string; otp: string; countryCode?: string; languageCode?: string;
    };
    const phone = normalizePhone(rawPhoneVerify);
    if (!phone || !otp) {
      res.status(400).json({ error: "Phone and OTP required" });
      return;
    }

    // 🔒 FIX H3: Added Rate Limiting for OTP verification to prevent brute-force attacks
    // Ek number par 15 minute mein sirf 5 attempts allow honge
    const verifyLimitKey = `otp_verify:${phone}`;
    const verifyAttempts = await cache.incrementRateLimitFixed(verifyLimitKey, 900); // 900 seconds = 15 minutes
    if (verifyAttempts > 5) {
      res.status(429).json({ error: "Too many failed attempts. Please request a new OTP after 15 minutes." });
      return;
    }

    // Try DB first, then in-memory fallback
    let storedHash: string | null = null;
    let fromDb = false;
    try {
      const [otpRecord] = await db
        .select()
        .from(otpStoreTable)
        .where(and(eq(otpStoreTable.phone, phone), gt(otpStoreTable.expiresAt, new Date())))
        .limit(1);
      if (otpRecord) { storedHash = otpRecord.hashedOtp; fromDb = true; }
    } catch {
      storedHash = await cache.getOtp(phone);
    }

    if (!storedHash) {
      res.status(400).json({ error: "OTP expired or not found. Request a new one." });
      return;
    }
    if (!verifyOtpHash(otp, storedHash)) {
      res.status(400).json({ error: "Invalid OTP" });
      return;
    }

    if (fromDb) {
      await db.delete(otpStoreTable).where(eq(otpStoreTable.phone, phone)).catch(() => {});
    } else {
      await cache.deleteOtp(phone);
    }

    let [user] = await db.select().from(usersTable).where(eq(usersTable.phone, phone));
    let isNewUser = false;

    if (!user) {
      try {
        const [newUser] = await db.insert(usersTable).values({
          phone,
          countryCode,
          languageCode,
          referralCode: generateReferralCode(),
        }).returning();
        user = newUser;
        isNewUser = true;
      } catch (insertErr) {
        // CRIT-2: Race condition — another concurrent request created this user first
        if ((insertErr as any)?.code === "23505" || String(insertErr).includes("unique")) {
          const [existing] = await db.select().from(usersTable).where(eq(usersTable.phone, phone));
          if (existing) { user = existing; isNewUser = false; }
          else throw insertErr;
        } else { throw insertErr; }
      }
    }

    // Ensure supporting rows exist using raw SQL (bypasses Drizzle for pooler compat)
    await pool.query(`INSERT INTO user_preferences (user_id, language_code) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [user.id, languageCode]).catch(() => {});
    await pool.query(`INSERT INTO user_privacy_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [user.id]).catch(() => {});
    await pool.query(`INSERT INTO user_profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [user.id]).catch(() => {});
    await pool.query(`UPDATE users SET last_login_at=NOW() WHERE id=$1`, [user.id]).catch(() => {});
    // OBS-4: Record auth provider linkage so user_auth_providers is populated
    await pool.query(
      `INSERT INTO user_auth_providers (user_id, provider, provider_user_id, is_primary)
       VALUES ($1, 'mobile', $2, true)
       ON CONFLICT (user_id, provider) DO NOTHING`,
      [user.id, phone]
    ).catch(() => {});

    // Fetch onboarding_step from DB — client uses this to skip onboarding for returning users
    const profileRow = await pool.query(`SELECT onboarding_step FROM user_profiles WHERE user_id=$1`, [user.id]).catch(() => null);
    const onboardingStep: number = profileRow?.rows?.[0]?.onboarding_step ?? 0;

    const payload = { userId: user.id, phone: phone, plan: user.plan };
    const accessToken = signUserToken(payload);
    const refreshToken = signRefreshToken(payload);

    res.json({
      accessToken,
      refreshToken,
      isNewUser,
      onboardingStep,
      user: {
        id: user.id,
        phone: user.phone,
        plan: user.plan,
        languageCode: user.languageCode,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "OTP verification failed" });
  }
});

router.post("/auth/firebase-login", async (req, res) => {
  try {
    const { idToken, phone: rawPhone, languageCode = "hi", countryCode = "IN" } = req.body as {
      idToken: string; phone?: string; languageCode?: string; countryCode?: string;
    };
    if (!idToken) {
      res.status(400).json({ error: "Firebase ID token required" });
      return;
    }

    const firebaseApiKey = process.env.FIREBASE_API_KEY;
    if (!firebaseApiKey) {
      res.status(500).json({ error: "Firebase not configured on server" });
      return;
    }

    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      }
    );
    const verifyData = await verifyRes.json() as { users?: Array<{ localId: string; phoneNumber?: string }>; error?: { message: string } };

    if (!verifyRes.ok || !verifyData.users?.[0]) {
      logger.warn({ error: verifyData.error?.message }, "[Firebase] token verification failed");
      res.status(401).json({ error: "Invalid or expired Firebase token" });
      return;
    }

    const firebaseUser = verifyData.users[0];
    const phone = firebaseUser.phoneNumber
      ? firebaseUser.phoneNumber.replace(/^\+91/, "")
      : (rawPhone || "").replace(/^\+91/, "");

    if (!phone || !/^\d{10}$/.test(phone)) {
      res.status(400).json({ error: "Could not extract valid phone number from Firebase token" });
      return;
    }

    let [user] = await db.select().from(usersTable).where(eq(usersTable.phone, phone));
    let isNewUser = false;

    if (!user) {
      try {
        const [newUser] = await db.insert(usersTable).values({
          phone,
          countryCode,
          languageCode,
          referralCode: generateReferralCode(),
        }).returning();
        user = newUser;
        isNewUser = true;
      } catch (insertErr) {
        // CRIT-2: Race condition — another concurrent request created this user first
        if ((insertErr as any)?.code === "23505" || String(insertErr).includes("unique")) {
          const [existing] = await db.select().from(usersTable).where(eq(usersTable.phone, phone));
          if (existing) { user = existing; isNewUser = false; }
          else throw insertErr;
        } else { throw insertErr; }
      }
    }

    await pool.query(`INSERT INTO user_preferences (user_id, language_code) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [user.id, languageCode]).catch(() => {});
    await pool.query(`INSERT INTO user_privacy_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [user.id]).catch(() => {});
    await pool.query(`INSERT INTO user_profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [user.id]).catch(() => {});
    await pool.query(`UPDATE users SET last_login_at=NOW() WHERE id=$1`, [user.id]).catch(() => {});
    // OBS-4: Record Firebase phone auth linkage (provider='mobile' since Firebase verifies phone)
    await pool.query(
      `INSERT INTO user_auth_providers (user_id, provider, provider_user_id, is_primary)
       VALUES ($1, 'mobile', $2, true)
       ON CONFLICT (user_id, provider) DO NOTHING`,
      [user.id, firebaseUser.localId]
    ).catch(() => {});

    const fbProfileRow = await pool.query(`SELECT onboarding_step FROM user_profiles WHERE user_id=$1`, [user.id]).catch(() => null);
    const fbOnboardingStep: number = fbProfileRow?.rows?.[0]?.onboarding_step ?? 0;

    const payload = { userId: user.id, phone, plan: user.plan };
    const accessToken = signUserToken(payload);
    const refreshToken = signRefreshToken(payload);

    logger.info({ phone, isNewUser }, "[Firebase] login success");

    res.json({
      accessToken,
      refreshToken,
      isNewUser,
      onboardingStep: fbOnboardingStep,
      user: {
        id: user.id,
        phone: user.phone,
        plan: user.plan,
        languageCode: user.languageCode || languageCode,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg }, "[Firebase] login error");
    res.status(500).json({ error: "Firebase login failed", detail: msg });
  }
});

router.post("/auth/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body as { refreshToken: string };
    if (!refreshToken) {
      res.status(400).json({ error: "Refresh token required" });
      return;
    }
    const payload = verifyRefreshToken(refreshToken);

    // FIX H9 — Respect logout revocation just like requireAuth() does.
    const logoutTs = await cache.get(`logout:user:${payload.userId}`);
    if (logoutTs) {
      const decoded = payload as unknown as { iat?: number };
      const iat = decoded.iat ?? 0;
      if (iat < parseInt(logoutTs, 10)) {
        res.status(401).json({ error: "Token has been revoked. Please log in again." });
        return;
      }
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
    if (!user || !user.isActive || user.isBanned) {
      res.status(401).json({ error: "User not found or inactive" });
      return;
    }
    const newPayload = { userId: user.id, phone: user.phone || undefined, plan: user.plan };
    const accessToken = signUserToken(newPayload);
    const newRefreshToken = signRefreshToken(newPayload);
    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch {
    res.status(401).json({ error: "Invalid refresh token" });
  }
});

router.post("/auth/google", async (req, res) => {
  try {
    const { idToken, accessToken: googleAccessToken, languageCode = "hi", countryCode = "IN" } = req.body as {
      idToken?: string; accessToken?: string; languageCode?: string; countryCode?: string;
    };
    if (!idToken && !googleAccessToken) {
      res.status(400).json({ error: "Google ID token or access token required" });
      return;
    }

    let googleData: { sub?: string; email: string; name?: string; picture?: string; aud?: string; error_description?: string };
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

    if (googleAccessToken) {
      // --- FIX C-3: Strict Audience verification for Access Tokens ---
      const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${googleAccessToken}`);
      if (!tokenInfoRes.ok) {
        res.status(401).json({ error: "Invalid Google access token" });
        return;
      }
      const tokenInfo = await tokenInfoRes.json() as { aud?: string };
      
      // Check if token belongs to AORANE
      if (GOOGLE_CLIENT_ID && tokenInfo.aud && tokenInfo.aud !== GOOGLE_CLIENT_ID) {
        res.status(401).json({ error: "Google access token audience mismatch! (Security Block)" });
        return;
      }

      // Safe to fetch profile via Google userinfo endpoint
      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${googleAccessToken}` },
      });
      if (!userInfoRes.ok) {
        res.status(401).json({ error: "Invalid Google access token profile" });
        return;
      }
      googleData = await userInfoRes.json() as typeof googleData;
    } else {
      // Verify ID token via tokeninfo endpoint
      const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
      if (!googleRes.ok) {
        res.status(401).json({ error: "Invalid Google token" });
        return;
      }
      googleData = await googleRes.json() as typeof googleData;
      if (googleData.error_description) {
        res.status(401).json({ error: "Invalid Google token" });
        return;
      }
      // Verify the token was issued for this app
      if (GOOGLE_CLIENT_ID && googleData.aud && googleData.aud !== GOOGLE_CLIENT_ID) {
        res.status(401).json({ error: "Google token audience mismatch" });
        return;
      }
    }

    if (!googleData.email) {
      res.status(401).json({ error: "Could not get email from Google" });
      return;
    }

    let [user] = await db.select().from(usersTable).where(eq(usersTable.email, googleData.email));
    let isNewUser = false;

    if (!user) {
      try {
        const [newUser] = await db.insert(usersTable).values({
          email: googleData.email,
          countryCode,
          languageCode,
          referralCode: generateReferralCode(),
        }).returning();
        user = newUser;
        isNewUser = true;
        await db.insert(userPreferencesTable).values({ userId: user.id, languageCode });
        await db.insert(userPrivacySettingsTable).values({ userId: user.id });
        await db.insert(userProfilesTable).values({
          userId: user.id,
          fullName: googleData.name,
          profilePhotoUrl: googleData.picture,
        });
        // Send welcome email to new Google-auth users (fire & forget)
        sendWelcomeEmail({ toEmail: googleData.email, name: googleData.name }).catch(() => {});
      } catch (insertErr) {
        // CRIT-2: Race condition — another concurrent request created this user first
        if ((insertErr as any)?.code === "23505" || String(insertErr).includes("unique")) {
          const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, googleData.email));
          if (existing) { user = existing; isNewUser = false; }
          else throw insertErr;
        } else { throw insertErr; }
      }
    }

    await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));
    // OBS-4: Record Google auth provider linkage
    await pool.query(
      `INSERT INTO user_auth_providers (user_id, provider, provider_user_id, email, is_primary)
       VALUES ($1, 'google', $2, $3, true)
       ON CONFLICT (user_id, provider) DO NOTHING`,
      [user.id, googleData.sub || googleData.email, googleData.email]
    ).catch(() => {});

    const gProfileRow = await pool.query(`SELECT onboarding_step FROM user_profiles WHERE user_id=$1`, [user.id]).catch(() => null);
    const gOnboardingStep: number = gProfileRow?.rows?.[0]?.onboarding_step ?? 0;

    const payload = { userId: user.id, email: googleData.email, plan: user.plan };
    const accessToken = signUserToken(payload);
    const refreshToken = signRefreshToken(payload);

    res.json({ accessToken, refreshToken, isNewUser, onboardingStep: gOnboardingStep, user: { id: user.id, plan: user.plan, languageCode: user.languageCode } });
  } catch (err) {
    res.status(500).json({ error: "Google authentication failed" });
  }
});

router.get("/auth/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ user: { id: user.id, phone: user.phone, email: user.email, plan: user.plan, languageCode: user.languageCode } });
  } catch {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// ─── Email OTP ───────────────────────────────────────────────────────────────
router.post("/auth/send-email-otp", async (req, res) => {
  try {
    const { email } = req.body as { email: string };
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "Valid email address required" });
      return;
    }
    const rateLimitKey = `email_otp:${email.toLowerCase()}`;
    const attempts = await cache.incrementRateLimitFixed(rateLimitKey, 3600);
    if (attempts > 5) {
      res.status(429).json({ error: "Too many OTP requests. Try after 1 hour." });
      return;
    }
    const otp = generateOtp(6);
    const hashed = hashOtp(otp);
    const emailKey = emailOtpKey(email);

    // Store in memory cache (fast path)
    await cache.setOtp(emailKey, hashed);

    // Also persist in DB so OTP survives server restarts & multiple instances
    await pool.query(`DELETE FROM otp_store WHERE phone = $1`, [emailKey]).catch(() => {});
    await pool.query(
      `INSERT INTO otp_store (phone, hashed_otp, expires_at) VALUES ($1, $2, $3) ON CONFLICT (phone) DO UPDATE SET hashed_otp=$2, expires_at=$3`,
      [emailKey, hashed, new Date(Date.now() + 5 * 60 * 1000)]
    ).catch(() => {});

    const sent = await sendEmailOtp(email, otp);
    const isDev = process.env.NODE_ENV !== "production";
    if (isDev) req.log.info({ email }, "Dev Email OTP generated");
    const testEmails = (process.env.TEST_EMAILS || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
    const isTestEmail = testEmails.includes(email.toLowerCase());
    const returnDevOtp = !sent && (isDev || isTestEmail);

    res.json({
      success: true,
      message: sent ? "OTP sent to your email" : (isDev ? "Dev mode — OTP in response" : "Email service unavailable"),
      ...(returnDevOtp ? { devOtp: otp } : {}),
      sent,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to send email OTP", detail: msg });
  }
});

router.post("/auth/verify-email-otp", async (req, res) => {
  try {
    const { email, otp, languageCode = "hi", countryCode = "IN" } = req.body as {
      email: string; otp: string; languageCode?: string; countryCode?: string;
    };
    if (!email || !otp) {
      res.status(400).json({ error: "Email and OTP required" });
      return;
    }

    // SECURITY FIX: this endpoint had no rate limit on verify attempts,
    // unlike /auth/verify-otp (phone) which limits to 5/15min. A 6-digit
    // OTP is brute-forceable without this within its validity window.
    const emailVerifyLimitKey = `email_otp_verify:${email.toLowerCase()}`;
    const emailVerifyAttempts = await cache.incrementRateLimitFixed(emailVerifyLimitKey, 900);
    if (emailVerifyAttempts > 5) {
      res.status(429).json({ error: "Too many failed attempts. Please request a new OTP after 15 minutes." });
      return;
    }

    const emailKey = emailOtpKey(email);

    // Check memory cache first (fast path)
    let storedHash: string | null = (await cache.getOtp(emailKey)) ?? null;

    // Fallback to DB
    if (!storedHash) {
      const { rows: dbRows } = await pool.query(
        `SELECT hashed_otp FROM otp_store WHERE phone = $1 AND expires_at > NOW() LIMIT 1`,
        [emailKey]
      ).catch(() => ({ rows: [] as { hashed_otp: string }[] }));
      if (dbRows[0]) storedHash = dbRows[0].hashed_otp;
    }

    if (!storedHash) {
      res.status(400).json({ error: "OTP expired or not found. Please request a new one." });
      return;
    }
    if (!verifyOtpHash(otp, storedHash)) {
      res.status(400).json({ error: "Incorrect OTP. Please try again." });
      return;
    }
    // Success hone par counter reset kar dein (matches pin_login pattern)
    await cache.resetRateLimit(emailVerifyLimitKey);
    // Clean up from both cache and DB
    await cache.deleteOtp(emailKey);
    await pool.query(`DELETE FROM otp_store WHERE phone = $1`, [emailKey]).catch(() => {});

    let [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
    let isNewUser = false;
    if (!user) {
      try {
        const [newUser] = await db.insert(usersTable).values({
          email: email.toLowerCase(),
          countryCode,
          languageCode,
          referralCode: generateReferralCode(),
        }).returning();
        user = newUser;
        isNewUser = true;
        sendWelcomeEmail({ toEmail: email.toLowerCase() }).catch(() => {});
      } catch (insertErr) {
        if ((insertErr as any)?.code === "23505" || String(insertErr).includes("unique")) {
          const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
          if (existing) { user = existing; isNewUser = false; }
          else throw insertErr;
        } else { throw insertErr; }
      }
    }
    await pool.query(`INSERT INTO user_preferences (user_id, language_code) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [user.id, languageCode]).catch(() => {});
    await pool.query(`INSERT INTO user_privacy_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [user.id]).catch(() => {});
    await pool.query(`INSERT INTO user_profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [user.id]).catch(() => {});
    await pool.query(`UPDATE users SET last_login_at=NOW() WHERE id=$1`, [user.id]).catch(() => {});

    const eProfileRow = await pool.query(`SELECT onboarding_step FROM user_profiles WHERE user_id=$1`, [user.id]).catch(() => null);
    const eOnboardingStep: number = eProfileRow?.rows?.[0]?.onboarding_step ?? 0;

    const payload = { userId: user.id, email: email.toLowerCase(), plan: user.plan };
    const accessToken = signUserToken(payload);
    const refreshToken = signRefreshToken(payload);

    res.json({
      accessToken, refreshToken, isNewUser, onboardingStep: eOnboardingStep,
      user: { id: user.id, email: user.email, plan: user.plan, languageCode: user.languageCode },
    });
  } catch (err) {
    res.status(500).json({ error: "Email OTP verification failed" });
  }
});

// ─── PIN Login ───────────────────────────────────────────────────────────────
// A5: Logout — revoke token by recording logout timestamp in cache
router.post("/auth/logout", requireAuth, async (req: AuthRequest, res) => {
  try {
    const nowSec = Math.floor(Date.now() / 1000);
    await cache.set(`logout:user:${req.userId}`, String(nowSec), 30 * 24 * 3600);
    await pool.query(`UPDATE users SET last_logout_at = NOW() WHERE id = $1`, [req.userId]).catch(() => {});
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Logout failed" });
  }
});

router.post("/auth/pin/set", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { pin } = req.body as { pin: string };
    if (!pin || !/^\d{4,6}$/.test(pin)) {
      res.status(400).json({ error: "PIN must be 4–6 digits" }); return;
    }
    const pinHash = hashOtp(pin);
    await db.update(userPreferencesTable).set({ pinHash }).where(eq(userPreferencesTable.userId, req.userId!));
    res.json({ success: true, message: "PIN set successfully." });
  } catch {
    res.status(500).json({ error: "Failed to set PIN" });
  }
});

router.post("/auth/pin/login", async (req, res) => {
  try {
    const { phone, pin } = req.body as { phone: string; pin: string };
    if (!phone || !pin) { res.status(400).json({ error: "Phone and PIN required" }); return; }

    // --- FIX H-6: PIN Rate Limiting ---
    const pinRateLimitKey = `pin_login:${phone}`;
    const pinAttempts = await cache.incrementRateLimitFixed(pinRateLimitKey, 600);
    if (pinAttempts > 5) {
      res.status(429).json({ error: "Too many attempts. Please try again after 10 minutes." });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.phone, phone));
    if (!user || !user.isActive || user.isBanned) {
      res.status(401).json({ error: "User not found or account is banned." }); return;
    }
    const [prefs] = await db.select({ pinHash: userPreferencesTable.pinHash })
      .from(userPreferencesTable).where(eq(userPreferencesTable.userId, user.id));
    if (!prefs?.pinHash) {
      res.status(400).json({ error: "PIN not set. Please log in via OTP." }); return;
    }
    if (!verifyOtpHash(pin, prefs.pinHash)) {
      res.status(401).json({ error: "Incorrect PIN." }); return;
    }
    
    // Success hone par counter reset kar dein
    await cache.resetRateLimit(pinRateLimitKey);

    await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));
    const payload = { userId: user.id, phone: phone, plan: user.plan };
    const accessToken = signUserToken(payload);
    const refreshToken = signRefreshToken(payload);
    res.json({ accessToken, refreshToken, user: { id: user.id, phone: user.phone, plan: user.plan } });
  } catch {
    res.status(500).json({ error: "PIN login failed" });
  }
});

// ─── CRIT-3: Account Linking — merge a phone-only account into an email/Google account ─
router.post("/auth/link-phone", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { phone, otp } = req.body as { phone: string; otp: string };
    if (!phone || !otp || !/^\d{10}$/.test(phone)) {
      res.status(400).json({ error: "Valid 10-digit phone and OTP required" }); return;
    }

    // SECURITY FIX: no rate limit existed on this verify attempt. A
    // successful brute force here merges another user's phone-linked
    // account (and its health data) into the attacker's account — higher
    // value than a normal login OTP guess, so this needs the same
    // protection /auth/verify-otp already has.
    const linkVerifyLimitKey = `link_phone_verify:${phone}`;
    const linkVerifyAttempts = await cache.incrementRateLimitFixed(linkVerifyLimitKey, 900);
    if (linkVerifyAttempts > 5) {
      res.status(429).json({ error: "Too many failed attempts. Please request a new OTP after 15 minutes." });
      return;
    }

    let storedHash: string | null = null;
    let fromDb = false;
    try {
      const [otpRecord] = await db.select().from(otpStoreTable)
        .where(and(eq(otpStoreTable.phone, phone), gt(otpStoreTable.expiresAt, new Date()))).limit(1);
      if (otpRecord) { storedHash = otpRecord.hashedOtp; fromDb = true; }
    } catch { storedHash = await cache.getOtp(phone); }

    if (!storedHash) { res.status(400).json({ error: "OTP expired or not found. Request a new one." }); return; }
    if (!verifyOtpHash(otp, storedHash)) { res.status(400).json({ error: "Invalid OTP." }); return; }
    // Success hone par counter reset kar dein (matches pin_login pattern)
    await cache.resetRateLimit(linkVerifyLimitKey);
    if (fromDb) await db.delete(otpStoreTable).where(eq(otpStoreTable.phone, phone)).catch(() => {});
    else await cache.deleteOtp(phone);

    const [phoneUser] = await db.select().from(usersTable).where(eq(usersTable.phone, phone));
    const [currentUser] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!currentUser) { res.status(404).json({ error: "Current account not found" }); return; }
    
    // --- FIX C-5: Strict Account Merging Security ---
    if (phoneUser && phoneUser.email && phoneUser.email !== currentUser.email) {
       res.status(403).json({ error: "Security Alert: This phone number is already linked to a different email address. Merge blocked." });
       return;
    }

    if (!phoneUser) {
      await db.update(usersTable).set({ phone }).where(eq(usersTable.id, req.userId!));
      res.json({ success: true, merged: false, message: "Phone number linked to your account." });
      return;
    }
    if (phoneUser.id === currentUser.id) {
      res.json({ success: true, merged: false, message: "Phone already linked to this account." });
      return;
    }

    const phoneUserId = phoneUser.id;
    const currentUserId = currentUser.id;
    // 🔒 FIX H1: Replaced dynamic SQL interpolation with safe pre-defined queries to bypass SQL Injection pattern flags
    const transferQueries = [
      "UPDATE food_logs SET user_id=$1 WHERE user_id=$2",
      "UPDATE water_logs SET user_id=$1 WHERE user_id=$2",
      "UPDATE exercise_logs SET user_id=$1 WHERE user_id=$2",
      "UPDATE stress_logs SET user_id=$1 WHERE user_id=$2",
      "UPDATE medicine_schedules SET user_id=$1 WHERE user_id=$2",
      "UPDATE medicine_logs SET user_id=$1 WHERE user_id=$2",
      "UPDATE daily_health_scores SET user_id=$1 WHERE user_id=$2",
      "UPDATE user_health_goals SET user_id=$1 WHERE user_id=$2",
      "UPDATE user_medical_conditions SET user_id=$1 WHERE user_id=$2",
      "UPDATE blood_donors SET user_id=$1 WHERE user_id=$2",
      "UPDATE subscriptions SET user_id=$1 WHERE user_id=$2",
      "UPDATE push_tokens SET user_id=$1 WHERE user_id=$2",
      "UPDATE period_logs SET user_id=$1 WHERE user_id=$2",
      "UPDATE medical_reports SET user_id=$1 WHERE user_id=$2"
    ];

    for (const query of transferQueries) {
      await pool.query(query, [currentUserId, phoneUserId]).catch(() => {});
    }

    await db.update(usersTable).set({ phone }).where(eq(usersTable.id, currentUserId));
    const planOrder: string[] = ["free", "pro", "max", "family"];
    if (planOrder.indexOf(phoneUser.plan) > planOrder.indexOf(currentUser.plan)) {
      await db.update(usersTable).set({ plan: phoneUser.plan }).where(eq(usersTable.id, currentUserId));
    }

    await pool.query(`UPDATE users SET is_active=false, phone=null WHERE id=$1`, [phoneUserId]).catch(() => {});

    req.log.info({ currentUserId, phoneUserId }, "Accounts merged via link-phone");
    res.json({ success: true, merged: true, message: "Accounts merged. Your phone health data has been moved to this account." });
  } catch (err) {
    req.log.error({ err }, "Account link-phone error");
    res.status(500).json({ error: "Failed to link accounts" });
  }
});

function generateReferralCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "AOR";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default router;