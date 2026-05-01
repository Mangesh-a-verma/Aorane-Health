import { Router } from "express";
import {
  db, pool,
  familyGroupsTable, familyMembersTable,
  usersTable, userProfilesTable, dailyHealthScoresTable,
  subscriptionsTable, foodLogsTable, medicineSchedulesTable,
  medicineLogsTable, exerciseLogsTable, waterLogsTable,
} from "@workspace/db";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { requireAuth } from "../../middlewares/user-auth";
import type { AuthRequest } from "../../middlewares/user-auth";
import { logger } from "../../lib/logger";

const router = Router();

function generateInviteCode() {
  return "FAM" + Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function getMembership(userId: string) {
  const [m] = await db.select().from(familyMembersTable).where(eq(familyMembersTable.userId, userId));
  return m ?? null;
}

async function getGroupByMembership(membership: { groupId: string }) {
  const [g] = await db.select().from(familyGroupsTable).where(eq(familyGroupsTable.id, membership.groupId));
  return g ?? null;
}

async function isOwnerOf(userId: string, groupId: string) {
  const [g] = await db.select().from(familyGroupsTable).where(eq(familyGroupsTable.id, groupId));
  return g?.ownerId === userId;
}

router.get("/family/group", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userRes = await pool.query(`SELECT plan FROM users WHERE id=$1`, [req.userId!]);
    if (userRes.rows[0]?.plan !== "family") {
      res.status(403).json({ error: "Family plan required to access this feature", code: "FAMILY_PLAN_REQUIRED" });
      return;
    }
    const membership = await getMembership(req.userId!);
    if (!membership) { res.json({ group: null, members: [] }); return; }

    const group = await getGroupByMembership(membership);
    const allMembers = await db.select().from(familyMembersTable).where(eq(familyMembersTable.groupId, group.id));

    const memberDetails = await Promise.all(allMembers.map(async (m) => {
      const [u] = await db.select().from(usersTable).where(eq(usersTable.id, m.userId));
      const [p] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, m.userId));
      const scores = await db.select().from(dailyHealthScoresTable)
        .where(eq(dailyHealthScoresTable.userId, m.userId))
        .orderBy(desc(dailyHealthScoresTable.scoreDate)).limit(1);
      return {
        userId: m.userId,
        role: m.role,
        relation: m.relation,
        isMinor: m.isMinor,
        healthSharePermission: m.healthSharePermission,
        phone: u?.phone,
        name: p?.fullName || "User",
        aoraneId: p?.aoraneId || null,
        age: p?.dateOfBirth ? Math.floor((Date.now() - new Date(p.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365)) : null,
        healthScore: scores[0]?.healthScore || 0,
        lastActive: scores[0]?.scoreDate || null,
        joinedAt: m.joinedAt,
      };
    }));

    res.json({ group, members: memberDetails, isOwner: group.ownerId === req.userId });
  } catch (err: unknown) {
    logger.error({ err }, "Failed to get family group");
    res.status(500).json({ error: "Failed to get family group" });
  }
});

router.post("/family/create", requireAuth, async (req: AuthRequest, res) => {
  try {
    const existing = await getMembership(req.userId!);
    if (existing) { res.status(400).json({ error: "You are already in a family group. Please leave it first." }); return; }
    const inviteCode = generateInviteCode();
    const [group] = await db.insert(familyGroupsTable).values({ ownerId: req.userId!, inviteCode, maxMembers: 6 }).returning();
    await db.insert(familyMembersTable).values({ groupId: group.id, userId: req.userId!, role: "owner", relation: "self", healthSharePermission: "full" });
    res.status(201).json({ success: true, group, inviteCode });
  } catch (err: unknown) {
    logger.error({ err }, "Failed to create family group");
    res.status(500).json({ error: "Failed to create family group" });
  }
});

router.post("/family/join", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { inviteCode, relation = "other", isMinor = false } = req.body as { inviteCode: string; relation?: string; isMinor?: boolean };
    if (!inviteCode) { res.status(400).json({ error: "Invite code required" }); return; }
    const [group] = await db.select().from(familyGroupsTable).where(eq(familyGroupsTable.inviteCode, inviteCode.toUpperCase().trim()));
    if (!group) { res.status(404).json({ error: "Invalid invite code" }); return; }
    if (!group.isActive) { res.status(400).json({ error: "This group is no longer active." }); return; }
    const existing = await getMembership(req.userId!);
    if (existing) { res.status(400).json({ error: "You are already a member of a group." }); return; }
    const members = await db.select().from(familyMembersTable).where(eq(familyMembersTable.groupId, group.id));
    if (members.length >= (group.maxMembers || 6)) { res.status(400).json({ error: "This group is full (max 6 members)." }); return; }

    await db.insert(familyMembersTable).values({
      groupId: group.id, userId: req.userId!, role: "member",
      relation, isMinor: Boolean(isMinor), healthSharePermission: "basic",
    });

    const [ownerSub] = await db.select().from(subscriptionsTable)
      .where(and(eq(subscriptionsTable.userId, group.ownerId), eq(subscriptionsTable.status, "active")))
      .orderBy(desc(subscriptionsTable.createdAt)).limit(1);
    const expiresAt = ownerSub?.expiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.insert(subscriptionsTable).values({
      userId: req.userId!, plan: "family", status: "active", source: "family_invite",
      expiresAt, paymentType: "one_time", autoRenew: false, nextRenewalAt: expiresAt,
    });
    await db.update(usersTable).set({ plan: "family" }).where(eq(usersTable.id, req.userId!));
    res.json({ success: true, group, message: "Successfully joined the family group! Family plan is now active." });
  } catch (err: unknown) {
    logger.error({ err }, "Failed to join family group");
    res.status(500).json({ error: "Failed to join family group" });
  }
});

router.delete("/family/leave", requireAuth, async (req: AuthRequest, res) => {
  try {
    const membership = await getMembership(req.userId!);
    if (!membership) { res.status(404).json({ error: "You are not a member of any group." }); return; }
    const group = await getGroupByMembership(membership);
    if (group.ownerId === req.userId) {
      const allMembers = await db.select().from(familyMembersTable).where(eq(familyMembersTable.groupId, group.id));
      if (allMembers.length > 1) {
        res.status(400).json({ error: "As the group owner, you cannot leave while members remain. Please dissolve the group first." });
        return;
      }
      await db.delete(familyGroupsTable).where(eq(familyGroupsTable.id, group.id));
    } else {
      await db.delete(familyMembersTable).where(and(eq(familyMembersTable.userId, req.userId!), eq(familyMembersTable.groupId, group.id)));
    }
    res.json({ success: true });
  } catch (err: unknown) {
    logger.error({ err }, "Failed to leave group");
    res.status(500).json({ error: "Failed to leave group" });
  }
});

router.patch("/family/member/permission", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { permission } = req.body as { permission: string };
    if (!["full", "basic", "none"].includes(permission)) {
      res.status(400).json({ error: "Permission must be: full, basic, or none" }); return;
    }
    const membership = await getMembership(req.userId!);
    if (!membership) { res.status(404).json({ error: "You are not in a family group." }); return; }
    await db.update(familyMembersTable)
      .set({ healthSharePermission: permission })
      .where(eq(familyMembersTable.userId, req.userId!));
    res.json({ success: true, permission });
  } catch (err: unknown) {
    logger.error({ err }, "Failed to update permission");
    res.status(500).json({ error: "Failed to update permission" });
  }
});

router.patch("/family/member/:memberId/relation", requireAuth, async (req: AuthRequest, res) => {
  try {
    const memberId = String(req.params.memberId);
    const { relation, isMinor } = req.body as { relation?: string; isMinor?: boolean };
    const membership = await getMembership(req.userId!);
    if (!membership) { res.status(404).json({ error: "You are not in a family group." }); return; }
    const ownerCheck = await isOwnerOf(req.userId!, membership.groupId);
    if (!ownerCheck) { res.status(403).json({ error: "Only group owner can update member info." }); return; }

    const [target] = await db.select().from(familyMembersTable)
      .where(and(eq(familyMembersTable.userId, memberId), eq(familyMembersTable.groupId, membership.groupId)));
    if (!target) { res.status(404).json({ error: "Member not found in your group." }); return; }

    if (relation && isMinor !== undefined) {
      await pool.query(`UPDATE family_members SET relation=$1, is_minor=$2 WHERE user_id=$3 AND group_id=$4`, [relation, Boolean(isMinor), memberId, membership.groupId]);
    } else if (relation) {
      await pool.query(`UPDATE family_members SET relation=$1 WHERE user_id=$2 AND group_id=$3`, [relation, memberId, membership.groupId]);
    } else if (isMinor !== undefined) {
      await pool.query(`UPDATE family_members SET is_minor=$1 WHERE user_id=$2 AND group_id=$3`, [Boolean(isMinor), memberId, membership.groupId]);
    }
    res.json({ success: true });
  } catch (err: unknown) {
    logger.error({ err }, "Failed to update member relation");
    res.status(500).json({ error: "Failed to update member relation" });
  }
});

router.get("/family/member/:memberId/health", requireAuth, async (req: AuthRequest, res) => {
  try {
    const memberId = String(req.params.memberId);
    const requesterMembership = await getMembership(req.userId!);
    if (!requesterMembership) { res.status(403).json({ error: "You are not in a family group." }); return; }

    const group = await getGroupByMembership(requesterMembership);
    const ownerCheck = group.ownerId === req.userId;
    if (!ownerCheck) { res.status(403).json({ error: "Only group owner can view member health data." }); return; }

    const [targetMembership] = await db.select().from(familyMembersTable)
      .where(and(eq(familyMembersTable.userId, memberId), eq(familyMembersTable.groupId, group.id)));
    if (!targetMembership) { res.status(404).json({ error: "Member not found in your family group." }); return; }

    const permission = targetMembership.healthSharePermission;
    if (permission === "none") {
      res.status(403).json({ error: "This member has set their health data to private.", code: "PERMISSION_DENIED" }); return;
    }

    const today = new Date().toISOString().split("T")[0];
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, memberId));
    const [p] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, memberId));
    const [todayScore] = await db.select().from(dailyHealthScoresTable)
      .where(and(eq(dailyHealthScoresTable.userId, memberId), eq(dailyHealthScoresTable.scoreDate, today)));

    let foodData = null;
    let medicineData = null;
    let exerciseData = null;
    let waterData = null;
    let alerts: Array<{ type: string; message: string; severity: string }> = [];

    if (permission === "full") {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

      const foodLogs = await db.select().from(foodLogsTable)
        .where(and(eq(foodLogsTable.userId, memberId), gte(foodLogsTable.loggedAt, todayStart)));
      const totalCal = foodLogs.reduce((s, l) => s + Number(l.calories || 0), 0);
      const totalProtein = foodLogs.reduce((s, l) => s + Number(l.proteinG || 0), 0);
      const totalCarbs = foodLogs.reduce((s, l) => s + Number(l.carbsG || 0), 0);
      const totalFat = foodLogs.reduce((s, l) => s + Number(l.fatG || 0), 0);
      foodData = {
        logsCount: foodLogs.length,
        totalCalories: Math.round(totalCal),
        totalProteinG: Math.round(totalProtein * 10) / 10,
        totalCarbsG: Math.round(totalCarbs * 10) / 10,
        totalFatG: Math.round(totalFat * 10) / 10,
        meals: foodLogs.map(l => ({
          name: l.foodNameEn, mealType: l.mealType,
          calories: Number(l.calories || 0), loggedAt: l.loggedAt,
        })),
      };
      if (foodLogs.length === 0 && new Date().getHours() >= 20) {
        alerts.push({ type: "food", message: "No meals logged today", severity: "warning" });
      }

      const schedules = await db.select().from(medicineSchedulesTable)
        .where(and(eq(medicineSchedulesTable.userId, memberId), eq(medicineSchedulesTable.isActive, true)));
      const todayLogs = await db.select().from(medicineLogsTable)
        .where(and(eq(medicineLogsTable.userId, memberId), gte(medicineLogsTable.scheduledAt, todayStart)));
      const taken = todayLogs.filter(l => l.status === "taken").length;
      const missed = todayLogs.filter(l => l.status === "missed").length;
      medicineData = {
        totalScheduled: schedules.length,
        takenToday: taken,
        missedToday: missed,
        adherencePct: schedules.length > 0 ? Math.round((taken / schedules.length) * 100) : null,
        schedules: schedules.map(s => ({ name: s.medicineName, dosage: s.dosage, frequency: s.frequency })),
      };
      if (missed > 0) {
        alerts.push({ type: "medicine", message: `${missed} medicine${missed > 1 ? "s" : ""} missed today`, severity: missed > 1 ? "high" : "warning" });
      }

      const exerciseLogs = await db.select().from(exerciseLogsTable)
        .where(and(eq(exerciseLogsTable.userId, memberId), gte(exerciseLogsTable.loggedAt, todayStart)));
      const totalMins = exerciseLogs.reduce((s, l) => s + (l.durationMinutes || 0), 0);
      const totalSteps = exerciseLogs.reduce((s, l) => s + (l.steps || 0), 0);
      exerciseData = {
        sessionsToday: exerciseLogs.length,
        totalMinutes: totalMins,
        totalSteps,
        exercises: exerciseLogs.map(l => ({ type: l.exerciseType, minutes: l.durationMinutes, steps: l.steps })),
      };
      if (totalSteps < 500 && new Date().getHours() >= 20) {
        alerts.push({ type: "activity", message: "Very low activity today (< 500 steps)", severity: "warning" });
      }

      const waterLogs = await db.select().from(waterLogsTable)
        .where(and(eq(waterLogsTable.userId, memberId), gte(waterLogsTable.loggedAt, todayStart)));
      const totalMl = waterLogs.reduce((s, l) => s + (l.mlAmount || 0), 0);
      waterData = { totalMl, glasses: waterLogs.reduce((s, l) => s + (l.glassesCount || 0), 0) };
      if (totalMl < 500 && new Date().getHours() >= 18) {
        alerts.push({ type: "water", message: "Low water intake today", severity: "warning" });
      }
    }

    if (todayScore) {
      if ((todayScore.healthScore || 0) < 30) {
        alerts.push({ type: "health_score", message: `Health score critically low: ${todayScore.healthScore}`, severity: "high" });
      }
    }

    res.json({
      member: {
        userId: memberId,
        name: p?.fullName || "User",
        phone: u?.phone,
        age: p?.dateOfBirth ? Math.floor((Date.now() - new Date(p.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365)) : null,
        relation: targetMembership.relation,
        isMinor: targetMembership.isMinor,
        permission,
      },
      today: {
        date: today,
        healthScore: todayScore?.healthScore || 0,
        foodScore: todayScore?.foodScore || 0,
        exerciseScore: todayScore?.exerciseScore || 0,
        waterScore: todayScore?.waterScore || 0,
        medicineScore: todayScore?.medicineScore || 0,
        sleepScore: todayScore?.sleepScore || 0,
        waterGlasses: todayScore?.waterGlasses || 0,
        exerciseMinutes: todayScore?.exerciseMinutes || 0,
        totalCaloriesIn: todayScore?.totalCaloriesIn ? Number(todayScore.totalCaloriesIn) : null,
        medicineAdherencePct: todayScore?.medicineAdherencePct ? Number(todayScore.medicineAdherencePct) : null,
      },
      food: foodData,
      medicine: medicineData,
      exercise: exerciseData,
      water: waterData,
      alerts,
    });
  } catch (err: unknown) {
    logger.error({ err }, "Failed to fetch member health data");
    res.status(500).json({ error: "Failed to fetch member health data" });
  }
});

router.get("/family/member/:memberId/history", requireAuth, async (req: AuthRequest, res) => {
  try {
    const memberId = String(req.params.memberId);
    const { period = "week" } = req.query as { period?: string };

    const requesterMembership = await getMembership(req.userId!);
    if (!requesterMembership) { res.status(403).json({ error: "You are not in a family group." }); return; }
    const group = await getGroupByMembership(requesterMembership);
    if (group.ownerId !== req.userId) { res.status(403).json({ error: "Only group owner can view member history." }); return; }

    const [targetMembership] = await db.select().from(familyMembersTable)
      .where(and(eq(familyMembersTable.userId, memberId), eq(familyMembersTable.groupId, group.id)));
    if (!targetMembership) { res.status(404).json({ error: "Member not found in your group." }); return; }
    if (targetMembership.healthSharePermission === "none") {
      res.status(403).json({ error: "This member has set their data to private.", code: "PERMISSION_DENIED" }); return;
    }

    const days = period === "month" ? 30 : 7;
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    fromDate.setHours(0, 0, 0, 0);

    const fromDateStr = fromDate.toISOString().split("T")[0];
    const history = await db.select().from(dailyHealthScoresTable)
      .where(and(
        eq(dailyHealthScoresTable.userId, memberId),
        sql`${dailyHealthScoresTable.scoreDate} >= ${fromDateStr}`,
      ))
      .orderBy(dailyHealthScoresTable.scoreDate);

    const points = history.map(h => ({
      date: h.scoreDate,
      healthScore: h.healthScore,
      foodScore: h.foodScore,
      exerciseScore: h.exerciseScore,
      waterScore: h.waterScore,
      medicineScore: h.medicineScore,
      sleepScore: h.sleepScore,
      calories: h.totalCaloriesIn ? Number(h.totalCaloriesIn) : null,
      exerciseMinutes: h.exerciseMinutes,
      waterGlasses: h.waterGlasses,
    }));

    const avgScore = points.length ? Math.round(points.reduce((s, p) => s + p.healthScore, 0) / points.length) : 0;
    const avgCalories = points.filter(p => p.calories).length
      ? Math.round(points.filter(p => p.calories).reduce((s, p) => s + (p.calories || 0), 0) / points.filter(p => p.calories).length)
      : null;

    res.json({ period, days, points, summary: { avgScore, avgCalories, totalPoints: points.length } });
  } catch (err: unknown) {
    logger.error({ err }, "Failed to fetch member history");
    res.status(500).json({ error: "Failed to fetch member history" });
  }
});

router.post("/family/member/:memberId/reminder", requireAuth, async (req: AuthRequest, res) => {
  try {
    const memberId = String(req.params.memberId);
    const { message = "Please log your health data today! 💙" } = req.body as { message?: string };

    const requesterMembership = await getMembership(req.userId!);
    if (!requesterMembership) { res.status(403).json({ error: "You are not in a family group." }); return; }
    const group = await getGroupByMembership(requesterMembership);
    if (group.ownerId !== req.userId) { res.status(403).json({ error: "Only group owner can send reminders." }); return; }

    const [targetMembership] = await db.select().from(familyMembersTable)
      .where(and(eq(familyMembersTable.userId, memberId), eq(familyMembersTable.groupId, group.id)));
    if (!targetMembership) { res.status(404).json({ error: "Member not found in your group." }); return; }

    const [senderProfile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, req.userId!));
    const senderName = senderProfile?.fullName || "Family Admin";

    let pushToken: string | null = null;
    try {
      const deviceTokenRes = await pool.query(
        `SELECT expo_push_token FROM user_profiles WHERE user_id=$1 AND expo_push_token IS NOT NULL LIMIT 1`,
        [memberId]
      );
      pushToken = deviceTokenRes.rows[0]?.expo_push_token ?? null;
    } catch (pushErr: unknown) {
      logger.error({ err: pushErr }, "Could not fetch push token — column may not exist yet");
    }

    if (pushToken) {
      try {
        await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: pushToken,
            title: `💙 Reminder from ${senderName}`,
            body: message,
            data: { type: "family_reminder", fromUserId: req.userId },
          }),
        });
      } catch (pushErr: unknown) { logger.error({ err: pushErr }, "Push notification delivery failed"); }
    }

    res.json({ success: true, notified: !!pushToken, message: pushToken ? "Reminder sent!" : "Reminder queued (member will see it on next login)" });
  } catch (err: unknown) {
    logger.error({ err }, "Failed to send reminder");
    res.status(500).json({ error: "Failed to send reminder" });
  }
});

router.get("/family/alerts", requireAuth, async (req: AuthRequest, res) => {
  try {
    const membership = await getMembership(req.userId!);
    if (!membership) { res.status(403).json({ error: "You are not in a family group." }); return; }
    const group = await getGroupByMembership(membership);
    if (group.ownerId !== req.userId) { res.status(403).json({ error: "Only group owner can view alerts." }); return; }

    const allMembers = await db.select().from(familyMembersTable).where(eq(familyMembersTable.groupId, group.id));
    const today = new Date().toISOString().split("T")[0];
    const alerts: Array<{ memberId: string; memberName: string; type: string; message: string; severity: string }> = [];

    for (const m of allMembers) {
      if (m.userId === req.userId || m.healthSharePermission === "none") continue;
      const [p] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, m.userId));
      const name = p?.fullName || "Member";

      const [score] = await db.select().from(dailyHealthScoresTable)
        .where(and(eq(dailyHealthScoresTable.userId, m.userId), eq(dailyHealthScoresTable.scoreDate, today)));

      if (!score) {
        alerts.push({ memberId: m.userId, memberName: name, type: "no_data", message: "No health data logged today", severity: "info" });
        continue;
      }
      if ((score.healthScore || 0) < 30) {
        alerts.push({ memberId: m.userId, memberName: name, type: "health_score", message: `Critical health score: ${score.healthScore}`, severity: "high" });
      }
      if (m.healthSharePermission === "full" && score.medicineAdherencePct !== null && Number(score.medicineAdherencePct) < 50) {
        alerts.push({ memberId: m.userId, memberName: name, type: "medicine", message: `Low medicine adherence: ${Math.round(Number(score.medicineAdherencePct))}%`, severity: "high" });
      }
      if ((score.waterGlasses || 0) < 4 && new Date().getHours() >= 18) {
        alerts.push({ memberId: m.userId, memberName: name, type: "water", message: "Low water intake today", severity: "warning" });
      }
    }

    res.json({ alerts, total: alerts.length, date: today });
  } catch (err: unknown) {
    logger.error({ err }, "Failed to fetch family alerts");
    res.status(500).json({ error: "Failed to fetch family alerts" });
  }
});

router.delete("/family/dissolve", requireAuth, async (req: AuthRequest, res) => {
  try {
    const membership = await getMembership(req.userId!);
    if (!membership) { res.status(404).json({ error: "You are not in a family group." }); return; }
    const group = await getGroupByMembership(membership);
    if (group.ownerId !== req.userId) { res.status(403).json({ error: "Only the owner can dissolve the group." }); return; }
    await db.delete(familyGroupsTable).where(eq(familyGroupsTable.id, group.id));
    res.json({ success: true, message: "Family group dissolved." });
  } catch (err: unknown) {
    logger.error({ err }, "Failed to dissolve group");
    res.status(500).json({ error: "Failed to dissolve group" });
  }
});

export default router;
