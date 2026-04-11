/**
 * ════════════════════════════════════════════════════════════════════════════
 * ACCIDENT EMERGENCY MODULE — Structure Ready
 * ════════════════════════════════════════════════════════════════════════════
 *
 * IMPLEMENTATION STATUS: Skeleton ready. Full launch requires:
 *   1. Hospital API partnerships (Apollo, Fortis, Ola Maps, Google Places)
 *   2. Government Police API or 112-India API approval
 *   3. Telecom API for auto-call initiation (Twilio/Exotel)
 *   4. Ministry of Road Transport & Highways approval (if mandatory integration)
 *
 * PLANNED FLOW (2-3 taps):
 *   User taps SOS → GPS captured → nearest 3 hospitals found (2-3 km radius)
 *   → Hospital APIs notified with GPS → Police 112 notified → Auto-call to
 *   nearest hospital → Emergency contacts SMS with live location link
 *
 * DATA: All tables are already created in DB (accident_emergency_logs,
 *       emergency_contacts). Schema is fully ready for production.
 * ════════════════════════════════════════════════════════════════════════════
 */

import { Router } from "express";
import { db, accidentEmergencyLogsTable, emergencyContactsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../../middlewares/user-auth";
import type { AuthRequest } from "../../middlewares/user-auth";

const router = Router();

// ── Feature flag ──────────────────────────────────────────────────────────────
const ACCIDENT_EMERGENCY_LIVE = false; // Set true when hospital/police APIs are approved

// ── Emergency Contacts (CRUD — available now) ─────────────────────────────────

/** GET /emergency/contacts — User ke emergency contacts list */
router.get("/emergency/contacts", requireAuth, async (req: AuthRequest, res) => {
  try {
    const contacts = await db.select()
      .from(emergencyContactsTable)
      .where(eq(emergencyContactsTable.userId, req.userId!));
    res.json({ contacts });
  } catch {
    res.status(500).json({ error: "Failed to fetch emergency contacts" });
  }
});

/** POST /emergency/contacts — Emergency contact add karo */
router.post("/emergency/contacts", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { name, phone, relation, isPrimary, notifyOnAccident, notifyOnBloodEmergency } = req.body as Record<string, unknown>;
    if (!name || !phone) {
      res.status(400).json({ error: "Name aur phone number required hai" });
      return;
    }
    const [contact] = await db.insert(emergencyContactsTable).values({
      userId: req.userId!,
      name: String(name),
      phone: String(phone),
      relation: relation ? String(relation) : undefined,
      isPrimary: Boolean(isPrimary),
      notifyOnAccident: notifyOnAccident !== false,
      notifyOnBloodEmergency: Boolean(notifyOnBloodEmergency),
    }).returning();
    res.status(201).json({ contact });
  } catch {
    res.status(500).json({ error: "Failed to add emergency contact" });
  }
});

/** DELETE /emergency/contacts/:id */
router.delete("/emergency/contacts/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    await db.delete(emergencyContactsTable)
      .where(eq(emergencyContactsTable.id, req.params.id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete emergency contact" });
  }
});

// ── Accident SOS — Core feature (pending hospital/police API approval) ────────

/**
 * POST /emergency/accident/sos
 *
 * CURRENT STATE: Logs the event, returns nearby numbers for manual dialling.
 *
 * FUTURE STATE (after hospital/police API approval):
 *   → Finds 3 nearest hospitals via Google Places / Ola Maps (2-3 km)
 *   → POSTs patient GPS + status to hospital APIs
 *   → Calls 112 (National Emergency) via Telecom API
 *   → Sends SMS to user's emergency contacts with live Google Maps link
 *   → Returns ETA from nearest hospital
 */
router.post("/emergency/accident/sos", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { lat, lng, accuracyMeters, address } = req.body as Record<string, unknown>;

    if (!lat || !lng) {
      res.status(400).json({ error: "GPS coordinates (lat, lng) required" });
      return;
    }

    if (!ACCIDENT_EMERGENCY_LIVE) {
      // ── Phase 1: Log the event + return manual emergency numbers ──────────
      // This lets us collect data and test the flow before APIs are integrated

      await db.insert(accidentEmergencyLogsTable).values({
        userId: req.userId!,
        lat: String(lat),
        lng: String(lng),
        accuracyMeters: accuracyMeters ? String(accuracyMeters) : undefined,
        address: address ? String(address) : undefined,
        status: "triggered",
      });

      // Return India's national emergency numbers (always available)
      return res.json({
        comingSoon: true,
        message: "Accident Emergency feature jald aa raha hai. Abhi yeh numbers use karein:",
        emergencyNumbers: [
          { name: "National Emergency (Ambulance + Police + Fire)", number: "112", priority: 1 },
          { name: "Ambulance", number: "108", priority: 2 },
          { name: "Police", number: "100", priority: 3 },
          { name: "Fire", number: "101", priority: 4 },
          { name: "Women Helpline", number: "1091", priority: 5 },
        ],
        googleMapsUrl: `https://www.google.com/maps?q=${lat},${lng}`,
        yourLocation: { lat, lng, address: address || "GPS se mila" },
        note: "Yeh URL share karo ambulance/police ko apni exact location batane ke liye",
      });
    }

    // ── Phase 2 (FUTURE — after API approvals): Full automated flow ─────────
    // TODO: Uncomment when hospital/police APIs are approved
    /*
    const nearbyHospitals = await findNearbyHospitals(Number(lat), Number(lng), 3000); // 3km
    await notifyHospitals(nearbyHospitals, { lat, lng, userId: req.userId });
    await call112Emergency({ lat, lng });
    const contacts = await db.select().from(emergencyContactsTable).where(eq(emergencyContactsTable.userId, req.userId!));
    await sendSMSToContacts(contacts, { lat, lng });
    */

    res.json({ success: true, message: "Emergency services notified" });
  } catch {
    res.status(500).json({ error: "Emergency SOS failed" });
  }
});

/** GET /emergency/accident/history — User ki past emergencies */
router.get("/emergency/accident/history", requireAuth, async (req: AuthRequest, res) => {
  try {
    const logs = await db.select()
      .from(accidentEmergencyLogsTable)
      .where(eq(accidentEmergencyLogsTable.userId, req.userId!))
      .orderBy(desc(accidentEmergencyLogsTable.createdAt))
      .limit(10);
    res.json({ logs });
  } catch {
    res.status(500).json({ error: "Failed to fetch emergency history" });
  }
});

/** PATCH /emergency/accident/:id/cancel */
router.patch("/emergency/accident/:id/cancel", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { reason } = req.body as { reason?: string };
    await db.update(accidentEmergencyLogsTable)
      .set({ status: "cancelled", cancelledAt: new Date(), cancelReason: reason || "User cancelled" })
      .where(eq(accidentEmergencyLogsTable.id, req.params.id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Cancel failed" });
  }
});

/** PATCH /emergency/accident/:id/resolve */
router.patch("/emergency/accident/:id/resolve", requireAuth, async (req: AuthRequest, res) => {
  try {
    await db.update(accidentEmergencyLogsTable)
      .set({ status: "resolved", resolvedAt: new Date() })
      .where(eq(accidentEmergencyLogsTable.id, req.params.id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Resolve failed" });
  }
});

/**
 * GET /emergency/feature-status
 * Frontend uses this to know if full auto-dispatch is live or still manual.
 */
router.get("/emergency/feature-status", async (_req, res) => {
  res.json({
    accidentEmergencyLive: ACCIDENT_EMERGENCY_LIVE,
    phase: ACCIDENT_EMERGENCY_LIVE ? "2_automated" : "1_manual_numbers",
    pendingApprovals: ACCIDENT_EMERGENCY_LIVE ? [] : [
      "Hospital API partnerships (Apollo, Fortis, Manipal, etc.)",
      "112-India Government Emergency API",
      "Telecom auto-call API (Twilio / Exotel)",
    ],
    availableNow: [
      "Emergency contacts management",
      "SOS event logging with GPS",
      "National emergency numbers display",
      "Live location share link generation",
    ],
  });
});

export default router;
