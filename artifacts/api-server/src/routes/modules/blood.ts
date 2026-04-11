import { Router } from "express";
import { db, bloodDonorsTable, bloodEmergencyRequestsTable, bloodEmergencyResponsesTable } from "@workspace/db";
import { eq, and, or, ilike } from "drizzle-orm";
import { requireAuth } from "../../middlewares/user-auth";
import { cache } from "../../lib/redis";
import { generateOtp, hashOtp, verifyOtpHash, sendSmsOtp } from "../../lib/otp";
import type { AuthRequest } from "../../middlewares/user-auth";

const COMPATIBLE_DONORS: Record<string, string[]> = {
  "A+":  ["A+", "A-", "O+", "O-"],
  "A-":  ["A-", "O-"],
  "B+":  ["B+", "B-", "O+", "O-"],
  "B-":  ["B-", "O-"],
  "O+":  ["O+", "O-"],
  "O-":  ["O-"],
  "AB+": ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"],
  "AB-": ["A-", "B-", "O-", "AB-"],
};

const router = Router();

// ── Donor Registration ────────────────────────────────────────────────────────
router.post("/blood/donor/register", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { bloodGroup, city, state, countryCode = "IN", lat, lng, phone } = req.body as Record<string, string>;
    if (!bloodGroup || !city || !state) {
      res.status(400).json({ error: "Blood group, city, state required" });
      return;
    }
    const otp = generateOtp(6);
    const hashed = hashOtp(otp);
    cache.setOtp(`blood_donor:${req.userId}`, hashed);
    if (phone) await sendSmsOtp(phone, otp);
    const existing = await db.select().from(bloodDonorsTable).where(eq(bloodDonorsTable.userId, req.userId!));
    if (existing.length) {
      res.json({ success: true, requiresOtp: true, message: "OTP sent for verification" });
      return;
    }
    await db.insert(bloodDonorsTable).values({
      userId: req.userId!,
      bloodGroup: bloodGroup as "A+" | "A-" | "B+" | "B-" | "O+" | "O-" | "AB+" | "AB-",
      city, state, countryCode, lat, lng,
    });
    res.json({ success: true, requiresOtp: true, message: "OTP sent for verification" });
  } catch {
    res.status(500).json({ error: "Failed to register donor" });
  }
});

router.post("/blood/donor/verify-otp", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { otp } = req.body as { otp: string };
    const stored = cache.getOtp(`blood_donor:${req.userId}`);
    if (!stored || !verifyOtpHash(otp, stored)) {
      res.status(400).json({ error: "Invalid or expired OTP" });
      return;
    }
    cache.deleteOtp(`blood_donor:${req.userId}`);
    await db.update(bloodDonorsTable).set({ otpVerified: true, verifiedAt: new Date() }).where(eq(bloodDonorsTable.userId, req.userId!));
    res.json({ success: true, message: "Donor verified successfully" });
  } catch {
    res.status(500).json({ error: "OTP verification failed" });
  }
});

// ── Blood Donors Search ───────────────────────────────────────────────────────
router.get("/blood/donors", async (req, res) => {
  try {
    const { bloodGroup, city } = req.query as Record<string, string>;
    const conditions = [eq(bloodDonorsTable.isAvailable, true), eq(bloodDonorsTable.otpVerified, true)];
    if (bloodGroup) {
      const compatible = COMPATIBLE_DONORS[bloodGroup] || [bloodGroup];
      conditions.push(or(...compatible.map((g) => eq(bloodDonorsTable.bloodGroup, g as "A+" | "A-" | "B+" | "B-" | "O+" | "O-" | "AB+" | "AB-")))!);
    }
    if (city) conditions.push(ilike(bloodDonorsTable.city, `%${city}%`));
    const donors = await db.select().from(bloodDonorsTable).where(and(...conditions)).limit(20);
    res.json({ donors });
  } catch {
    res.status(500).json({ error: "Failed to fetch donors" });
  }
});

// ── Emergency Request (OTP-based — for web portal) ────────────────────────────
router.post("/blood/request", requireAuth, async (req: AuthRequest, res) => {
  try {
    const monthKey = `blood_req:${req.userId}:${new Date().toISOString().slice(0, 7)}`;
    const monthCount = cache.getRateLimit(monthKey);
    if (monthCount >= 3) {
      res.status(429).json({ error: "Maximum 3 blood requests per month allowed" });
      return;
    }
    const { patientName, bloodGroupNeeded, hospitalName, hospitalAddress, hospitalCity, hospitalState, hospitalPincode, hospitalPhone, doctorName, doctorPhone, unitsNeeded, contactPhone, contactName, urgency, notes } = req.body as Record<string, unknown>;

    if (!patientName || !bloodGroupNeeded || !hospitalName || !hospitalCity || !contactPhone) {
      res.status(400).json({ error: "patientName, bloodGroupNeeded, hospitalName, hospitalCity, contactPhone are required" });
      return;
    }

    const otp = generateOtp(6);
    const hashed = hashOtp(otp);
    cache.setOtp(`blood_req:${req.userId}`, hashed);
    if (contactPhone) await sendSmsOtp(contactPhone as string, otp);

    cache.set(`blood_req_pending:${req.userId}`, JSON.stringify({ patientName, bloodGroupNeeded, hospitalName, hospitalAddress, hospitalCity, hospitalState, hospitalPincode, hospitalPhone, doctorName, doctorPhone, unitsNeeded, contactPhone, contactName, urgency: urgency || "urgent", notes }), 600);
    res.json({ success: true, requiresOtp: true, message: "OTP sent for verification" });
  } catch {
    res.status(500).json({ error: "Failed to create blood request" });
  }
});

router.post("/blood/request/verify-otp", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { otp } = req.body as { otp: string };
    const stored = cache.getOtp(`blood_req:${req.userId}`);
    if (!stored || !verifyOtpHash(otp, stored)) {
      res.status(400).json({ error: "Invalid or expired OTP" });
      return;
    }
    cache.deleteOtp(`blood_req:${req.userId}`);

    const pendingStr = cache.get(`blood_req_pending:${req.userId}`);
    if (!pendingStr) {
      res.status(400).json({ error: "Request session expired. Please start again." });
      return;
    }
    const pending = JSON.parse(pendingStr);
    cache.delete(`blood_req_pending:${req.userId}`);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    const [request] = await db.insert(bloodEmergencyRequestsTable).values({
      requesterId: req.userId!,
      ...pending,
      otpVerified: true,
      expiresAt,
    }).returning();

    const monthKey = `blood_req:${req.userId}:${new Date().toISOString().slice(0, 7)}`;
    cache.incrementRateLimit(monthKey, 31 * 24 * 3600);

    res.status(201).json({ success: true, request });
  } catch {
    res.status(500).json({ error: "Failed to create verified blood request" });
  }
});

// ── Active Requests ───────────────────────────────────────────────────────────
router.get("/blood/requests/active", async (req, res) => {
  try {
    const requests = await db.select().from(bloodEmergencyRequestsTable)
      .where(and(
        eq(bloodEmergencyRequestsTable.status, "active"),
        eq(bloodEmergencyRequestsTable.otpVerified, true),
        eq(bloodEmergencyRequestsTable.isFlagged, false),
      ));
    res.json({ requests });
  } catch {
    res.status(500).json({ error: "Failed to fetch blood requests" });
  }
});

// ── Donor Response ────────────────────────────────────────────────────────────
router.post("/blood/request/:id/respond", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { response } = req.body as { response: "can_help" | "later" | "unavailable" };
    const [existing] = await db.select().from(bloodEmergencyResponsesTable)
      .where(and(eq(bloodEmergencyResponsesTable.requestId, req.params.id), eq(bloodEmergencyResponsesTable.donorId, req.userId!)));
    if (existing) {
      await db.update(bloodEmergencyResponsesTable).set({ response }).where(eq(bloodEmergencyResponsesTable.id, existing.id));
    } else {
      await db.insert(bloodEmergencyResponsesTable).values({
        requestId: req.params.id, donorId: req.userId!, response,
      });
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to submit response" });
  }
});

// ── Flag Request ──────────────────────────────────────────────────────────────
router.post("/blood/request/:id/flag", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [request] = await db.select().from(bloodEmergencyRequestsTable).where(eq(bloodEmergencyRequestsTable.id, req.params.id));
    if (!request) { res.status(404).json({ error: "Request not found" }); return; }
    const newCount = request.flagCount + 1;
    await db.update(bloodEmergencyRequestsTable).set({
      flagCount: newCount,
      isFlagged: newCount >= 3,
    }).where(eq(bloodEmergencyRequestsTable.id, req.params.id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to flag request" });
  }
});

// ── Mark as Fulfilled ─────────────────────────────────────────────────────────
router.patch("/blood/request/:id/fulfil", requireAuth, async (req: AuthRequest, res) => {
  try {
    await db.update(bloodEmergencyRequestsTable)
      .set({ status: "fulfilled", fulfilledAt: new Date() })
      .where(and(
        eq(bloodEmergencyRequestsTable.id, req.params.id),
        eq(bloodEmergencyRequestsTable.requesterId, req.userId!),
      ));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to mark as fulfilled" });
  }
});

// ── Direct Emergency (Mobile — OTP-less but verified session token) ───────────
// All hospital fields are validated here; this is the mobile app's primary path
router.post("/blood/emergency/direct", requireAuth, async (req: AuthRequest, res) => {
  try {
    const {
      patientName, bloodGroup, unitsNeeded,
      hospitalName, hospitalAddress, hospitalCity, hospitalState, hospitalPincode, hospitalPhone,
      doctorName, doctorPhone,
      contactPhone, contactName,
      urgency, notes,
    } = req.body as Record<string, unknown>;

    // ── Validation — compulsory fields ────────────────────────────────────────
    const missing: string[] = [];
    if (!patientName) missing.push("Patient ka naam");
    if (!bloodGroup) missing.push("Blood group");
    if (!hospitalName) missing.push("Hospital ka naam");
    if (!hospitalAddress) missing.push("Hospital ka address");
    if (!hospitalCity) missing.push("Hospital city");
    if (!hospitalPhone) missing.push("Hospital contact number");
    if (!contactPhone) missing.push("Aapka contact number");

    if (missing.length) {
      res.status(400).json({
        error: `Yeh fields compulsory hain: ${missing.join(", ")}`,
        missingFields: missing,
      });
      return;
    }

    // Rate limit: max 3 per month
    const monthKey = `blood_direct:${req.userId as string}:${new Date().toISOString().slice(0, 7)}`;
    const monthCount = cache.getRateLimit(monthKey);
    if (monthCount >= 3) {
      res.status(429).json({ error: "Is mahine maximum 3 blood requests allowed hain" });
      return;
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 72);

    const [request] = await db.insert(bloodEmergencyRequestsTable).values({
      requesterId: req.userId!,
      patientName: String(patientName),
      bloodGroupNeeded: bloodGroup as "A+" | "A-" | "B+" | "B-" | "O+" | "O-" | "AB+" | "AB-",
      unitsNeeded: Number(unitsNeeded) || 1,
      hospitalName: String(hospitalName),
      hospitalAddress: String(hospitalAddress),
      hospitalCity: String(hospitalCity),
      hospitalState: String(hospitalState || ""),
      hospitalPincode: hospitalPincode ? String(hospitalPincode) : undefined,
      hospitalPhone: String(hospitalPhone),
      doctorName: doctorName ? String(doctorName) : undefined,
      doctorPhone: doctorPhone ? String(doctorPhone) : undefined,
      contactPhone: String(contactPhone),
      contactName: contactName ? String(contactName) : undefined,
      urgency: String(urgency || "urgent"),
      notes: notes ? String(notes) : undefined,
      otpVerified: true,
      expiresAt,
    }).returning();

    cache.incrementRateLimit(monthKey, 31 * 24 * 3600);

    res.status(201).json({ success: true, request });
  } catch (err) {
    console.error("Blood emergency error:", err);
    res.status(500).json({ error: "Failed to create blood emergency" });
  }
});

export default router;
