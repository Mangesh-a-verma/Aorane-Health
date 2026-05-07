// Blood Emergency Module — pool.query fix applied
import { Router } from "express";
import { db, pool, bloodDonorsTable, bloodDonationsTable, bloodEmergencyRequestsTable } from "@workspace/db";
import { eq, and, or, ilike, isNull, isNotNull, lt, sql, inArray, ne } from "drizzle-orm";
import { requireAuth } from "../../middlewares/user-auth";
import { cache } from "../../lib/redis";
import { logger } from "../../lib/logger";
import { generateOtp, hashOtp, verifyOtpHash, sendSmsOtp } from "../../lib/otp";
import type { AuthRequest } from "../../middlewares/user-auth";
import { sendExpoPushNotifications, getTokensForUsers } from "./support";

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
      const donor = existing[0];
      const cooldownExpired = !donor.donorInactiveUntil || donor.donorInactiveUntil < new Date();
      if (cooldownExpired && !donor.isAvailable) {
        await db.update(bloodDonorsTable).set({
          isAvailable: true,
          bloodGroup: bloodGroup as "A+" | "A-" | "B+" | "B-" | "O+" | "O-" | "AB+" | "AB-",
          city, state,
          lat: lat ?? donor.lat,
          lng: lng ?? donor.lng,
        }).where(eq(bloodDonorsTable.userId, req.userId!));
      }
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

// ── My Donor Status ───────────────────────────────────────────────────────────
router.get("/blood/donor/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [donor] = await db.select().from(bloodDonorsTable)
      .where(eq(bloodDonorsTable.userId, req.userId!)).limit(1);
    if (!donor) { res.json({ registered: false }); return; }
    const now = new Date();
    const isOnCooldown = !!(donor.donorInactiveUntil && donor.donorInactiveUntil > now);
    const daysLeft = isOnCooldown
      ? Math.ceil((donor.donorInactiveUntil!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    res.json({
      registered: true,
      isAvailable: donor.isAvailable,
      otpVerified: donor.otpVerified,
      isOnCooldown,
      daysLeft,
      inactiveUntil: donor.donorInactiveUntil ?? null,
      bloodGroup: donor.bloodGroup,
      city: donor.city,
      state: donor.state,
      donationCount: donor.donationCount ?? 0,
    });
  } catch {
    res.status(500).json({ error: "Failed to get donor status" });
  }
});

// ── Toggle Availability ───────────────────────────────────────────────────────
router.patch("/blood/donor/availability", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { available } = req.body as { available: boolean };
    if (typeof available !== "boolean") {
      res.status(400).json({ error: "available must be true or false" });
      return;
    }
    const [donor] = await db.select().from(bloodDonorsTable)
      .where(eq(bloodDonorsTable.userId, req.userId!)).limit(1);
    if (!donor) { res.status(404).json({ error: "You are not registered as a donor" }); return; }
    if (!donor.otpVerified) { res.status(403).json({ error: "Complete OTP verification first" }); return; }
    if (available && donor.donorInactiveUntil && donor.donorInactiveUntil > new Date()) {
      const daysLeft = Math.ceil((donor.donorInactiveUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      res.status(409).json({ error: `90-day cooldown active — ${daysLeft} days remaining`, daysLeft });
      return;
    }
    await db.update(bloodDonorsTable)
      .set({ isAvailable: available })
      .where(eq(bloodDonorsTable.userId, req.userId!));
    res.json({ success: true, isAvailable: available });
  } catch {
    res.status(500).json({ error: "Failed to update availability" });
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

    // GPS search: only fetch donors who have coordinates stored (scalability fix)
    const gpsSearch = !!(lat && lng);
    if (gpsSearch) conditions.push(isNotNull(bloodDonorsTable.lat), isNotNull(bloodDonorsTable.lng));

    const donors = await db.select().from(bloodDonorsTable).where(and(...conditions)).limit(200);

    // If GPS provided — filter by radius and sort by distance; auto-expand if <3 donors
    if (gpsSearch) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      const baseRadius = parseFloat(radiusKm);
      const withDist = donors.map(d => ({
        ...d,
        distanceKm: haversineKm(userLat, userLng, parseFloat(d.lat!), parseFloat(d.lng!)),
      }));

      let filtered = withDist.filter(d => d.distanceKm <= baseRadius).sort((a, b) => a.distanceKm - b.distanceKm);
      let searchedRadius = baseRadius;

      if (filtered.length < 3) {
        const at100 = withDist.filter(d => d.distanceKm <= 100).sort((a, b) => a.distanceKm - b.distanceKm);
        if (at100.length > filtered.length) { filtered = at100; searchedRadius = 100; }
      }
      if (filtered.length < 3 && searchedRadius === 100) {
        const at200 = withDist.filter(d => d.distanceKm <= 200).sort((a, b) => a.distanceKm - b.distanceKm);
        if (at200.length > filtered.length) { filtered = at200; searchedRadius = 200; }
      }

      res.json({
        donors: filtered.slice(0, 20),
        nearbySearch: true,
        searchedRadiusKm: searchedRadius,
        expanded: searchedRadius !== baseRadius,
      });
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
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM blood_emergency_requests
       WHERE requester_id = $1
         AND DATE_TRUNC('month', created_at AT TIME ZONE 'UTC') = DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC')`,
      [req.userId]
    );
    if (parseInt(countRows[0].count) >= 3) {
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
      requesterId: req.userId as string,
      patientName: String(pending.patientName || ""),
      bloodGroupNeeded: String(pending.bloodGroupNeeded || "") as "A+" | "A-" | "B+" | "B-" | "O+" | "O-" | "AB+" | "AB-",
      unitsNeeded: Number(pending.unitsNeeded) || 1,
      hospitalName: String(pending.hospitalName || ""),
      hospitalAddress: pending.hospitalAddress ? String(pending.hospitalAddress) : undefined,
      hospitalCity: String(pending.hospitalCity || ""),
      hospitalState: String(pending.hospitalState || ""),
      hospitalPincode: pending.hospitalPincode ? String(pending.hospitalPincode) : undefined,
      hospitalPhone: pending.hospitalPhone ? String(pending.hospitalPhone) : undefined,
      doctorName: pending.doctorName ? String(pending.doctorName) : undefined,
      doctorPhone: pending.doctorPhone ? String(pending.doctorPhone) : undefined,
      contactPhone: String(pending.contactPhone || ""),
      contactName: pending.contactName ? String(pending.contactName) : undefined,
      urgency: String(pending.urgency || "urgent"),
      notes: pending.notes ? String(pending.notes) : undefined,
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
    const result = await pool.query(
      `SELECT * FROM blood_emergency_requests
       WHERE status = 'active'
         AND otp_verified = TRUE
         AND is_flagged = FALSE
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC
       LIMIT 100`
    );
    // Map snake_case DB columns to camelCase for mobile app compatibility
    const requests = result.rows.map((r) => ({
      id: r.id,
      requesterId: r.requester_id,
      patientName: r.patient_name,
      bloodGroupNeeded: r.blood_group_needed,
      unitsNeeded: r.units_needed,
      hospitalName: r.hospital_name,
      hospitalAddress: r.hospital_address,
      hospitalCity: r.hospital_city,
      hospitalState: r.hospital_state,
      hospitalPincode: r.hospital_pincode,
      hospitalPhone: r.hospital_phone,
      doctorName: r.doctor_name,
      doctorPhone: r.doctor_phone,
      contactPhone: r.contact_phone,
      contactName: r.contact_name,
      urgency: r.urgency,
      status: r.status,
      donorsNotified: r.donors_notified,
      donorsResponded: r.donors_responded,
      otpVerified: r.otp_verified,
      flagCount: r.flag_count,
      isFlagged: r.is_flagged,
      notes: r.notes,
      expiresAt: r.expires_at,
      fulfilledAt: r.fulfilled_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
    res.json({ requests });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "Blood requests fetch failed");
    res.status(500).json({ error: "Failed to fetch blood requests" });
  }
});

// ── Donor Response ────────────────────────────────────────────────────────────
router.post("/blood/request/:id/respond", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { response } = req.body as { response: string };
    const requestId = String(req.params.id);
    const existing = await pool.query(
      `SELECT id FROM blood_emergency_responses WHERE request_id = $1 AND donor_id = $2`,
      [requestId, req.userId]
    );
    if (existing.rows.length) {
      await pool.query(
        `UPDATE blood_emergency_responses SET response = $1 WHERE id = $2`,
        [response, existing.rows[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO blood_emergency_responses (request_id, donor_id, response) VALUES ($1, $2, $3)`,
        [requestId, req.userId, response]
      );
    }
    res.json({ success: true });

    // ── Fire-and-forget: notify requester when a donor accepts ────────────────
    if (response === "accepted") {
      (async () => {
        try {
          const reqRow = await pool.query(
            `SELECT requester_id, blood_group_needed, hospital_name, hospital_city
             FROM blood_emergency_requests WHERE id = $1 LIMIT 1`,
            [requestId]
          );
          if (!reqRow.rows.length) return;
          const { requester_id, blood_group_needed, hospital_name, hospital_city } = reqRow.rows[0];

          const donorRow = await pool.query(
            `SELECT blood_group FROM blood_donors WHERE user_id = $1 LIMIT 1`,
            [req.userId]
          );
          const donorBg = donorRow.rows[0]?.blood_group || blood_group_needed;

          const tokens = await getTokensForUsers([requester_id]);
          if (!tokens.length) return;

          await sendExpoPushNotifications(
            tokens,
            "🩸 Donor is Coming!",
            `A ${donorBg} donor has accepted your request for ${hospital_name || hospital_city}. They will contact the hospital directly.`,
            { screen: "blood", requestId },
            3600,
          );
          logger.info({ requestId, donorId: req.userId }, "[BloodEmergency] Requester notified — donor accepted");
        } catch (notifErr) {
          logger.warn({ err: (notifErr as Error).message }, "[BloodEmergency] Donor-accept notification failed");
        }
      })().catch(() => {});
    }
  } catch (err) {
    logger.error({ err: (err as Error).message }, "Blood respond failed");
    res.status(500).json({ error: "Failed to submit response" });
  }
});

// ── Flag Request (one flag per user — duplicate ignored) ─────────────────────
router.post("/blood/request/:id/flag", requireAuth, async (req: AuthRequest, res) => {
  try {
    const flagId = String(req.params.id);
    const reqRow = await pool.query(
      `SELECT id FROM blood_emergency_requests WHERE id = $1`,
      [flagId]
    );
    if (!reqRow.rows.length) { res.status(404).json({ error: "Request not found" }); return; }

    const dupCheck = await pool.query(
      `SELECT id FROM blood_request_flags WHERE request_id = $1 AND user_id = $2`,
      [flagId, req.userId]
    );
    if (dupCheck.rows.length) {
      res.json({ success: true, alreadyFlagged: true });
      return;
    }

    await pool.query(
      `INSERT INTO blood_request_flags (request_id, user_id) VALUES ($1, $2)`,
      [flagId, req.userId]
    );
    await pool.query(
      `UPDATE blood_emergency_requests
       SET flag_count = flag_count + 1,
           is_flagged = (flag_count + 1 >= 3)
       WHERE id = $1`,
      [flagId]
    );
    res.json({ success: true });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "Blood flag failed");
    res.status(500).json({ error: "Failed to flag request" });
  }
});

// ── Mark as Fulfilled ─────────────────────────────────────────────────────────
router.patch("/blood/request/:id/fulfil", requireAuth, async (req: AuthRequest, res) => {
  try {
    await pool.query(
      `UPDATE blood_emergency_requests SET status = 'fulfilled', fulfilled_at = NOW()
       WHERE id = $1 AND requester_id = $2`,
      [String(req.params.id), req.userId]
    );
    res.json({ success: true });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "Blood fulfil failed");
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

    // Rate limit: max 3 per month — DB-backed (survives server restarts)
    const { rows: rlRows } = await pool.query(
      `SELECT COUNT(*) FROM blood_emergency_requests
       WHERE requester_id = $1
         AND DATE_TRUNC('month', created_at AT TIME ZONE 'UTC') = DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC')`,
      [req.userId]
    );
    if (parseInt(rlRows[0].count) >= 3) {
      res.status(429).json({ error: "Maximum 3 blood requests are allowed per month." });
      return;
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 72);

    const [request] = await db.insert(bloodEmergencyRequestsTable).values({
      requesterId: req.userId as string,
      patientName: String(patientName),
      bloodGroupNeeded: String(bloodGroup) as "A+" | "A-" | "B+" | "B-" | "O+" | "O-" | "AB+" | "AB-",
      unitsNeeded: Number(unitsNeeded) || 1,
      hospitalName: String(hospitalName),
      hospitalAddress: hospitalAddress ? String(hospitalAddress) : undefined,
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

    // ── Fire-and-forget: notify compatible donors (city first, then state fallback) ─
    (async () => {
      try {
        const compatible = COMPATIBLE_DONORS[String(bloodGroup)] || [];
        if (!compatible.length) return;
        const bgs = compatible as ("A+" | "A-" | "B+" | "B-" | "O+" | "O-" | "AB+" | "AB-")[];

        // 1. City-level donors
        let donorRows = await db.select({ userId: bloodDonorsTable.userId })
          .from(bloodDonorsTable)
          .where(and(
            inArray(bloodDonorsTable.bloodGroup, bgs),
            sql`LOWER(${bloodDonorsTable.city}) = LOWER(${String(hospitalCity || "")})`,
            eq(bloodDonorsTable.isAvailable, true),
            ne(bloodDonorsTable.userId, req.userId!)
          ))
          .limit(100);

        // 2. State-level fallback if city donors < 5
        if (donorRows.length < 5 && hospitalState) {
          const stateRows = await db.select({ userId: bloodDonorsTable.userId })
            .from(bloodDonorsTable)
            .where(and(
              inArray(bloodDonorsTable.bloodGroup, bgs),
              sql`LOWER(${bloodDonorsTable.state}) = LOWER(${String(hospitalState)})`,
              eq(bloodDonorsTable.isAvailable, true),
              ne(bloodDonorsTable.userId, req.userId!)
            ))
            .limit(100);
          const existingIds = new Set(donorRows.map(r => r.userId));
          const extra = stateRows.filter(r => !existingIds.has(r.userId));
          donorRows = [...donorRows, ...extra].slice(0, 100);
        }

        const uids: string[] = donorRows.map(r => r.userId);

        // No donors found anywhere — notify requester so they can share manually
        if (!uids.length) {
          const requesterTokens = await getTokensForUsers([req.userId!]);
          if (requesterTokens.length) {
            await sendExpoPushNotifications(
              requesterTokens,
              "⚠️ No Donors Found Nearby",
              `No ${bloodGroup} donors found in ${String(hospitalCity || "your area")} right now. Please share the request on WhatsApp/social media for faster help.`,
              { screen: "blood", requestId: request?.id || "" },
              3600,
            );
          }
          logger.warn({ bloodGroup, hospitalCity }, "[BloodEmergency] No donors found — requester notified");
          return;
        }

        const tokens = await getTokensForUsers(uids);
        if (!tokens.length) return;

        // TTL = 3600s (1 hour) — blood emergency notifications are useless after that
        await sendExpoPushNotifications(
          tokens,
          "🩸 Blood Needed Urgently Nearby!",
          `${bloodGroup} blood needed at ${String(hospitalName || "a hospital")} in ${String(hospitalCity || "your city")}. Please help!`,
          { screen: "blood", requestId: request?.id || "" },
          3600,
        );
        logger.info({ tokens: tokens.length, bloodGroup, hospitalCity }, "[BloodEmergency] Push notifications sent");
      } catch (notifErr) {
        logger.warn({ err: (notifErr as Error).message }, "[BloodEmergency] Push notification failed (non-fatal)");
      }
    })().catch(() => {});
  } catch (err) {
    logger.error({ err: (err as Error).message }, "Blood emergency create failed");
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
    req.log.error({ err }, "Blood donation confirm error");
    res.status(500).json({ error: "Failed to confirm donation" });
  }
});

// ── My Emergency Requests (as requester) ─────────────────────────────────────
router.get("/blood/requests/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM blood_emergency_requests
       WHERE requester_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [req.userId]
    );
    const requests = result.rows.map((r) => ({
      id: r.id,
      patientName: r.patient_name,
      bloodGroupNeeded: r.blood_group_needed,
      unitsNeeded: r.units_needed,
      urgency: r.urgency,
      hospitalName: r.hospital_name,
      hospitalCity: r.hospital_city,
      hospitalState: r.hospital_state,
      status: r.status,
      expiresAt: r.expires_at,
      fulfilledAt: r.fulfilled_at,
      createdAt: r.created_at,
      donorsNotified: r.donors_notified,
      donorsResponded: r.donors_responded,
    }));
    res.json({ requests });
  } catch {
    res.status(500).json({ error: "Failed to fetch your requests" });
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
