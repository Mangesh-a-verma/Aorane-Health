import { Router } from "express";
import { db, bloodDonorsTable, bloodEmergencyRequestsTable, bloodEmergencyResponsesTable, bloodDonationsTable } from "@workspace/db";
import { eq, and, or, ilike, isNull, lt, sql } from "drizzle-orm";
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

// ── Haversine distance (km) ───────────────────────────────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Blood Donors Search (supports city OR lat/lng proximity) ──────────────────
router.get("/blood/donors", async (req, res) => {
  try {
    const { bloodGroup, city, lat, lng, radiusKm = "50" } = req.query as Record<string, string>;
    const now = new Date();
    const conditions = [
      eq(bloodDonorsTable.isAvailable, true),
      eq(bloodDonorsTable.otpVerified, true),
      // 90-day cooldown: exclude donors who donated in the last 90 days
      or(isNull(bloodDonorsTable.donorInactiveUntil), lt(bloodDonorsTable.donorInactiveUntil, now))!,
    ];
    if (bloodGroup) {
      const compatible = COMPATIBLE_DONORS[bloodGroup] || [bloodGroup];
      conditions.push(or(...compatible.map((g) => eq(bloodDonorsTable.bloodGroup, g as "A+" | "A-" | "B+" | "B-" | "O+" | "O-" | "AB+" | "AB-")))!);
    }
    if (city) conditions.push(ilike(bloodDonorsTable.city, `%${city}%`));

    const donors = await db.select().from(bloodDonorsTable).where(and(...conditions)).limit(50);

    // If GPS provided — filter by radius and sort by distance
    if (lat && lng) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      const radius = parseFloat(radiusKm);
      const withDist = donors
        .map(d => ({
          ...d,
          distanceKm: d.lat && d.lng
            ? haversineKm(userLat, userLng, parseFloat(d.lat), parseFloat(d.lng))
            : null,
        }))
        .filter(d => d.distanceKm === null || d.distanceKm <= radius)
        .sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999))
        .slice(0, 20);
      res.json({ donors: withDist, nearbySearch: true });
      return;
    }

    res.json({ donors: donors.slice(0, 20), nearbySearch: false });
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
    const requestId = String(req.params.id);
    const [existing] = await db.select().from(bloodEmergencyResponsesTable)
      .where(and(eq(bloodEmergencyResponsesTable.requestId, requestId), eq(bloodEmergencyResponsesTable.donorId, req.userId!)));
    if (existing) {
      await db.update(bloodEmergencyResponsesTable).set({ response }).where(eq(bloodEmergencyResponsesTable.id, existing.id));
    } else {
      await db.insert(bloodEmergencyResponsesTable).values({
        requestId, donorId: req.userId!, response,
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
    const flagId = String(req.params.id);
    const [request] = await db.select().from(bloodEmergencyRequestsTable).where(eq(bloodEmergencyRequestsTable.id, flagId));
    if (!request) { res.status(404).json({ error: "Request not found" }); return; }
    const newCount = request.flagCount + 1;
    await db.update(bloodEmergencyRequestsTable).set({
      flagCount: newCount,
      isFlagged: newCount >= 3,
    }).where(eq(bloodEmergencyRequestsTable.id, flagId));
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
        eq(bloodEmergencyRequestsTable.id, String(req.params.id)),
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
    if (!patientName) missing.push("Patient name");
    if (!bloodGroup) missing.push("Blood group");
    if (!hospitalName) missing.push("Hospital name");
    if (!hospitalAddress) missing.push("Hospital address");
    if (!hospitalCity) missing.push("Hospital city");
    if (!hospitalPhone) missing.push("Hospital contact number");
    if (!contactPhone) missing.push("Your contact number");

    if (missing.length) {
      res.status(400).json({
        error: `The following fields are required: ${missing.join(", ")}`,
        missingFields: missing,
      });
      return;
    }

    // Rate limit: max 3 per month
    const monthKey = `blood_direct:${req.userId as string}:${new Date().toISOString().slice(0, 7)}`;
    const monthCount = cache.getRateLimit(monthKey);
    if (monthCount >= 3) {
      res.status(429).json({ error: "Maximum 3 blood requests are allowed per month." });
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

// ── Confirm Blood Donation (V2) — records donation + 90-day cooldown ─────────
// Called when a donor actually donates blood (verified by donor themselves OR admin)
router.post("/blood/donate/confirm", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { requestId, bloodGroup, unitsDoanted = 1, hospitalName, hospitalCity, notes } = req.body as {
      requestId?: string;
      bloodGroup: string;
      unitsDoanted?: number;
      hospitalName?: string;
      hospitalCity?: string;
      notes?: string;
    };

    if (!bloodGroup) { res.status(400).json({ error: "bloodGroup required" }); return; }

    // Check if donor is within cooldown
    const [donor] = await db.select().from(bloodDonorsTable)
      .where(eq(bloodDonorsTable.userId, userId)).limit(1);

    if (donor?.donorInactiveUntil && donor.donorInactiveUntil > new Date()) {
      const daysLeft = Math.ceil((donor.donorInactiveUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      res.status(409).json({
        error: `You can donate again in ${daysLeft} days. A 90-day rest period is required after blood donation.`,
        daysLeft,
        inactiveUntil: donor.donorInactiveUntil,
      });
      return;
    }

    // Record donation
    const donatedAt = new Date();
    const inactiveUntil = new Date(donatedAt);
    inactiveUntil.setDate(inactiveUntil.getDate() + 90);

    const [donation] = await db.insert(bloodDonationsTable).values({
      donorId: userId,
      requestId: requestId || null,
      bloodGroup: bloodGroup as "A+" | "A-" | "B+" | "B-" | "O+" | "O-" | "AB+" | "AB-",
      unitsDoanted: Number(unitsDoanted) || 1,
      hospitalName,
      hospitalCity,
      donatedAt,
      donorInactiveUntil: inactiveUntil,
      notes,
    }).returning();

    // Update blood_donors: set cooldown + increment donation count
    if (donor) {
      await db.update(bloodDonorsTable)
        .set({
          donorInactiveUntil: inactiveUntil,
          isAvailable: false,
          lastDonatedAt: donatedAt.toISOString(),
          donationCount: (donor.donationCount || 0) + 1,
          nextEligibleAt: inactiveUntil.toISOString(),
        })
        .where(eq(bloodDonorsTable.userId, userId));
    }

    res.status(201).json({
      success: true,
      donation,
      message: "Donation recorded! A 90-day rest period has begun. Thank you for saving lives! 🙏",
      inactiveUntil,
      daysInactive: 90,
    });
  } catch (err) {
    console.error("Blood donation confirm error:", err);
    res.status(500).json({ error: "Failed to confirm donation" });
  }
});

// ── My Donation History ───────────────────────────────────────────────────────
router.get("/blood/donate/history", requireAuth, async (req: AuthRequest, res) => {
  try {
    const donations = await db.select().from(bloodDonationsTable)
      .where(eq(bloodDonationsTable.donorId, req.userId!))
      .orderBy(sql`${bloodDonationsTable.donatedAt} DESC`)
      .limit(20);

    const [donor] = await db.select().from(bloodDonorsTable)
      .where(eq(bloodDonorsTable.userId, req.userId!)).limit(1);

    const isOnCooldown = !!(donor?.donorInactiveUntil && donor.donorInactiveUntil > new Date());
    const daysUntilEligible = isOnCooldown
      ? Math.ceil((donor!.donorInactiveUntil!.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 0;

    res.json({
      donations,
      totalDonations: donations.length,
      isOnCooldown,
      daysUntilEligible,
      inactiveUntil: donor?.donorInactiveUntil ?? null,
    });
  } catch {
    res.status(500).json({ error: "Failed to get donation history" });
  }
});

void sql;

export default router;
