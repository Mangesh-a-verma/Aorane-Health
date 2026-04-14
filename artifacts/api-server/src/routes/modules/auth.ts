import { Router } from "express";
import { db, usersTable, userPreferencesTable, userPrivacySettingsTable, userProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { generateOtp, hashOtp, verifyOtpHash, sendSmsOtp, sendWhatsappOtp } from "../../lib/otp";
import { cache } from "../../lib/redis";
import { signUserToken, signRefreshToken, verifyRefreshToken } from "../../lib/jwt";
import { requireAuth } from "../../middlewares/user-auth";
import type { AuthRequest } from "../../middlewares/user-auth";

const router = Router();

router.post("/auth/send-otp", async (req, res) => {
  try {
    const { phone, countryCode = "IN" } = req.body as { phone: string; countryCode?: string };
    if (!phone || !/^\d{10}$/.test(phone)) {
      res.status(400).json({ error: "Valid 10-digit phone number required" });
      return;
    }

    const rateLimitKey = `otp_req:${phone}`;
    const attempts = cache.incrementRateLimit(rateLimitKey, 3600);
    if (attempts > 5) {
      res.status(429).json({ error: "Too many OTP requests. Try after 1 hour." });
      return;
    }

    const otp = generateOtp(6);
    const hashed = hashOtp(otp);
    cache.setOtp(phone, hashed);

    const smsSent = await sendSmsOtp(phone, otp);
    console.log(`[OTP] ${phone} → ${otp} | SMS sent: ${smsSent}`);

    res.json({
      success: true,
      message: smsSent ? "OTP sent via SMS" : "SMS service temporarily unavailable",
      ...(!smsSent ? { devOtp: otp } : {}),
      smsSent,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to send OTP" });
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
    const attempts = cache.incrementRateLimit(rateLimitKey, 3600);
    if (attempts > 5) {
      res.status(429).json({ error: "Too many OTP requests. Try after 1 hour." });
      return;
    }
    const otp = generateOtp(6);
    const hashed = hashOtp(otp);
    cache.setOtp(phone, hashed);
    const result = await sendWhatsappOtp(phone, otp);
    console.log(`[OTP-WA] ${phone} → ${otp} | channel: ${result.fallback ? "sms" : "whatsapp"}`);
    const isDevWa = process.env.NODE_ENV !== "production";
    if (result.fallback) {
      res.json({ success: true, message: "OTP SMS se bheja gaya (WhatsApp unavailable)", channel: "sms", ...(isDevWa ? { devOtp: otp } : {}), smsSent: result.success });
    } else {
      res.json({ success: true, message: "OTP WhatsApp pe bheja gaya", channel: "whatsapp", ...(isDevWa ? { devOtp: otp } : {}), smsSent: result.success });
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

    const storedHash = cache.getOtp(phone);
    if (!storedHash) {
      res.status(400).json({ error: "OTP expired or not found. Request a new one." });
      return;
    }
    if (!verifyOtpHash(otp, storedHash)) {
      res.status(400).json({ error: "Invalid OTP" });
      return;
    }
    cache.deleteOtp(phone);

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

      await db.insert(userPreferencesTable).values({ userId: user.id, languageCode });
      await db.insert(userPrivacySettingsTable).values({ userId: user.id });
      await db.insert(userProfilesTable).values({ userId: user.id });
    }

    await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));

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
    const { idToken, languageCode = "hi", countryCode = "IN" } = req.body as {
      idToken: string; languageCode?: string; countryCode?: string;
    };
    if (!idToken) {
      res.status(400).json({ error: "Google ID token required" });
      return;
    }

    const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
    const googleData = await googleRes.json() as {
      sub: string; email: string; name: string; picture: string; aud: string;
    };

    if (!googleData.sub) {
      res.status(401).json({ error: "Invalid Google token" });
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
