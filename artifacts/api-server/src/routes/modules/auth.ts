import { Router } from "express";
import { db, pool, usersTable, userPreferencesTable, userPrivacySettingsTable, userProfilesTable, otpStoreTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { generateOtp, hashOtp, verifyOtpHash, sendSmsOtp, sendWhatsappOtp, sendEmailOtp } from "../../lib/otp";
import { cache } from "../../lib/redis";
import { signUserToken, signRefreshToken, verifyRefreshToken } from "../../lib/jwt";
import { requireAuth } from "../../middlewares/user-auth";
import type { AuthRequest } from "../../middlewares/user-auth";
import { logger } from "../../lib/logger";

const router = Router();

router.post("/auth/send-otp", async (req, res) => {
  try {
    const { phone, countryCode = "IN" } = req.body as { phone: string; countryCode?: string };
    if (!phone || !/^\d{10}$/.test(phone)) {
      res.status(400).json({ error: "Valid 10-digit phone number required" });
      return;
    }

    const rateLimitKey = `otp_req:${phone}`;
    const attempts = cache.incrementRateLimitFixed(rateLimitKey, 3600);
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
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });
      usedDb = true;
    } catch {
      cache.setOtp(phone, hashed);
    }

    if (process.env.NODE_ENV !== "production") {
      logger.info({ storage: usedDb ? "db" : "memory" }, "[OTP] storage");
    }

    const smsSent = await sendSmsOtp(phone, otp);

    if (process.env.NODE_ENV !== "production") {
      logger.info({ phone, smsSent }, "[OTP] sent");
    }

    // TEST_PHONES: comma-separated list of numbers that always receive devOtp in response
    // Used for testing without a paid SMS provider (e.g. "9876543210,9123456789")
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
    console.error("[OTP ERROR]", msg, cause);
    res.status(500).json({ error: "Failed to send OTP", detail: msg, cause: String(cause) });
  }
});

router.post("/auth/send-otp-whatsapp", async (req, res) => {
  try {
    const { phone } = req.body as { phone: string };
    if (!phone || !/^\d{10}$/.test(phone)) {
      res.status(400).json({ error: "Valid 10-digit phone number required" });
      return;
    }
    const rateLimitKey = `otp_req:${phone}`;
    const attempts = cache.incrementRateLimitFixed(rateLimitKey, 3600);
    if (attempts > 5) {
      res.status(429).json({ error: "Too many OTP requests. Try after 1 hour." });
      return;
    }
    const otp = generateOtp(6);
    const hashed = hashOtp(otp);
    cache.setOtp(phone, hashed);
    const result = await sendWhatsappOtp(phone, otp);
    const isDevWa = process.env.NODE_ENV !== "production";
    if (isDevWa) {
      logger.info({ phone, channel: result.fallback ? "sms" : "whatsapp" }, "[OTP-WA] sent");
    }
    const testPhonesWa = (process.env.TEST_PHONES || "").split(",").map(p => p.trim()).filter(Boolean);
    const isTestPhoneWa = testPhonesWa.includes(phone);
    const returnDevOtpWa = !result.success && (isDevWa || isTestPhoneWa);
    if (result.fallback) {
      res.json({ success: true, message: "OTP SMS se bheja gaya (WhatsApp unavailable)", channel: "sms", ...(returnDevOtpWa ? { devOtp: otp } : {}), smsSent: result.success });
    } else {
      res.json({ success: true, message: "OTP WhatsApp pe bheja gaya", channel: "whatsapp", ...(returnDevOtpWa ? { devOtp: otp } : {}), smsSent: result.success });
    }
  } catch {
    res.status(500).json({ error: "Failed to send WhatsApp OTP" });
  }
});

router.post("/auth/verify-otp", async (req, res) => {
  try {
    const { phone, otp, countryCode = "IN", languageCode = "hi" } = req.body as {
      phone: string; otp: string; countryCode?: string; languageCode?: string;
    };
    if (!phone || !otp) {
      res.status(400).json({ error: "Phone and OTP required" });
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
      storedHash = cache.getOtp(phone);
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
      cache.deleteOtp(phone);
    }

    let [user] = await db.select().from(usersTable).where(eq(usersTable.phone, phone));
    let isNewUser = false;

    if (!user) {
      const [newUser] = await db.insert(usersTable).values({
        phone,
        countryCode,
        languageCode,
        referralCode: generateReferralCode(),
      }).returning();
      user = newUser;
      isNewUser = true;
    }

    // Ensure supporting rows exist using raw SQL (bypasses Drizzle for pooler compat)
    await pool.query(`INSERT INTO user_preferences (user_id, language_code) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [user.id, languageCode]).catch(() => {});
    await pool.query(`INSERT INTO user_privacy_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [user.id]).catch(() => {});
    await pool.query(`INSERT INTO user_profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [user.id]).catch(() => {});
    await pool.query(`UPDATE users SET last_login_at=NOW() WHERE id=$1`, [user.id]).catch(() => {});

    const payload = { userId: user.id, phone: phone, plan: user.plan };
    const accessToken = signUserToken(payload);
    const refreshToken = signRefreshToken(payload);

    res.json({
      accessToken,
      refreshToken,
      isNewUser,
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
      const [newUser] = await db.insert(usersTable).values({
        phone,
        countryCode,
        languageCode,
        referralCode: generateReferralCode(),
      }).returning();
      user = newUser;
      isNewUser = true;
    }

    await pool.query(`INSERT INTO user_preferences (user_id, language_code) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [user.id, languageCode]).catch(() => {});
    await pool.query(`INSERT INTO user_privacy_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [user.id]).catch(() => {});
    await pool.query(`INSERT INTO user_profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [user.id]).catch(() => {});
    await pool.query(`UPDATE users SET last_login_at=NOW() WHERE id=$1`, [user.id]).catch(() => {});

    const payload = { userId: user.id, phone, plan: user.plan };
    const accessToken = signUserToken(payload);
    const refreshToken = signRefreshToken(payload);

    logger.info({ phone, isNewUser }, "[Firebase] login success");

    res.json({
      accessToken,
      refreshToken,
      isNewUser,
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

    if (googleAccessToken) {
      // Verify access token via Google userinfo endpoint
      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${googleAccessToken}` },
      });
      if (!userInfoRes.ok) {
        res.status(401).json({ error: "Invalid Google access token" });
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
      const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
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
    }

    await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));

    const payload = { userId: user.id, email: googleData.email, plan: user.plan };
    const accessToken = signUserToken(payload);
    const refreshToken = signRefreshToken(payload);

    res.json({ accessToken, refreshToken, isNewUser, user: { id: user.id, plan: user.plan } });
  } catch (err) {
    res.status(500).json({ error: "Google authentication failed" });
  }
});

router.post("/auth/logout", requireAuth, async (req: AuthRequest, res) => {
  res.json({ success: true });
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
    const attempts = cache.incrementRateLimitFixed(rateLimitKey, 3600);
    if (attempts > 5) {
      res.status(429).json({ error: "Too many OTP requests. Try after 1 hour." });
      return;
    }
    const otp = generateOtp(6);
    const hashed = hashOtp(otp);
    cache.setOtp(`email:${email.toLowerCase()}`, hashed);

    const sent = await sendEmailOtp(email, otp);
    const isDev = process.env.NODE_ENV !== "production";
    const testEmails = (process.env.TEST_EMAILS || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
    const isTestEmail = testEmails.includes(email.toLowerCase());
    const returnDevOtp = !sent && (isDev || isTestEmail);

    res.json({
      success: true,
      message: sent ? "OTP aapke email pe bheja gaya" : (isDev ? "Dev mode — OTP response mein hai" : "Email service unavailable"),
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
    const storedHash = cache.getOtp(`email:${email.toLowerCase()}`);
    if (!storedHash) {
      res.status(400).json({ error: "OTP expired ya nahin mila. Dobara bhejein." });
      return;
    }
    if (!verifyOtpHash(otp, storedHash as string)) {
      res.status(400).json({ error: "Galat OTP" });
      return;
    }
    cache.deleteOtp(`email:${email.toLowerCase()}`);

    let [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
    let isNewUser = false;
    if (!user) {
      const [newUser] = await db.insert(usersTable).values({
        email: email.toLowerCase(),
        countryCode,
        languageCode,
        referralCode: generateReferralCode(),
      }).returning();
      user = newUser;
      isNewUser = true;
    }
    await pool.query(`INSERT INTO user_preferences (user_id, language_code) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [user.id, languageCode]).catch(() => {});
    await pool.query(`INSERT INTO user_privacy_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [user.id]).catch(() => {});
    await pool.query(`INSERT INTO user_profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [user.id]).catch(() => {});
    await pool.query(`UPDATE users SET last_login_at=NOW() WHERE id=$1`, [user.id]).catch(() => {});

    const payload = { userId: user.id, email: email.toLowerCase(), plan: user.plan };
    const accessToken = signUserToken(payload);
    const refreshToken = signRefreshToken(payload);

    res.json({
      accessToken, refreshToken, isNewUser,
      user: { id: user.id, email: user.email, plan: user.plan, languageCode: user.languageCode },
    });
  } catch (err) {
    res.status(500).json({ error: "Email OTP verification failed" });
  }
});

// ─── PIN Login ───────────────────────────────────────────────────────────────
router.post("/auth/pin/set", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { pin } = req.body as { pin: string };
    if (!pin || !/^\d{4,6}$/.test(pin)) {
      res.status(400).json({ error: "PIN 4-6 digits ka hona chahiye" }); return;
    }
    const pinHash = hashOtp(pin);
    cache.set(`pin:${req.userId}`, pinHash, 86400 * 365);
    res.json({ success: true, message: "PIN set ho gaya" });
  } catch {
    res.status(500).json({ error: "Failed to set PIN" });
  }
});

router.post("/auth/pin/login", async (req, res) => {
  try {
    const { phone, pin } = req.body as { phone: string; pin: string };
    if (!phone || !pin) { res.status(400).json({ error: "Phone and PIN required" }); return; }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.phone, phone));
    if (!user || !user.isActive || user.isBanned) {
      res.status(401).json({ error: "User nahi mila ya ban hai" }); return;
    }
    const storedPinHash = cache.get(`pin:${user.id}`);
    if (!storedPinHash) {
      res.status(400).json({ error: "PIN set nahi kiya gaya. OTP se login karo." }); return;
    }
    if (!verifyOtpHash(pin, storedPinHash as string)) {
      res.status(401).json({ error: "Galat PIN" }); return;
    }
    await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));
    const payload = { userId: user.id, phone: phone, plan: user.plan };
    const accessToken = signUserToken(payload);
    const refreshToken = signRefreshToken(payload);
    res.json({ accessToken, refreshToken, user: { id: user.id, phone: user.phone, plan: user.plan } });
  } catch {
    res.status(500).json({ error: "PIN login failed" });
  }
});

function generateReferralCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "AOR";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default router;
