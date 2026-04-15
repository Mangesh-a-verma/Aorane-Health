import { Router } from "express";
import { db, familyGroupsTable, familyMembersTable, usersTable, userProfilesTable, dailyHealthScoresTable, subscriptionsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../../middlewares/user-auth";
import type { AuthRequest } from "../../middlewares/user-auth";

const router = Router();

function generateInviteCode() {
  return "FAM" + Math.random().toString(36).substring(2, 8).toUpperCase();
}

router.get("/family/group", requireAuth, async (req: AuthRequest, res) => {
  try {
    const membership = await db.select().from(familyMembersTable).where(eq(familyMembersTable.userId, req.userId!));
    if (!membership.length) {
      res.json({ group: null, members: [] });
      return;
    }
    const [group] = await db.select().from(familyGroupsTable).where(eq(familyGroupsTable.id, membership[0].groupId));
    const allMembers = await db.select().from(familyMembersTable).where(eq(familyMembersTable.groupId, group.id));
    const memberDetails = await Promise.all(allMembers.map(async (m) => {
      const [u] = await db.select().from(usersTable).where(eq(usersTable.id, m.userId));
      const [p] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, m.userId));
      const today = new Date().toISOString().split("T")[0];
      const scores = await db.select().from(dailyHealthScoresTable).where(eq(dailyHealthScoresTable.userId, m.userId)).orderBy(desc(dailyHealthScoresTable.scoreDate)).limit(1);
      return { userId: m.userId, role: m.role, phone: u?.phone, name: p?.fullName || "User", healthScore: scores[0]?.healthScore || 0, joinedAt: m.joinedAt };
    }));
    res.json({ group, members: memberDetails, isOwner: group.ownerId === req.userId });
  } catch {
    res.status(500).json({ error: "Failed to get family group" });
  }
});

router.post("/family/create", requireAuth, async (req: AuthRequest, res) => {
  try {
    const existing = await db.select().from(familyMembersTable).where(eq(familyMembersTable.userId, req.userId!));
    if (existing.length) {
      res.status(400).json({ error: "Pehle se kisi family group mein ho. Pehle leave karo." });
      return;
    }
    const inviteCode = generateInviteCode();
    const [group] = await db.insert(familyGroupsTable).values({ ownerId: req.userId!, inviteCode, maxMembers: 6 }).returning();
    await db.insert(familyMembersTable).values({ groupId: group.id, userId: req.userId!, role: "owner" });
    res.status(201).json({ success: true, group, inviteCode });
  } catch {
    res.status(500).json({ error: "Failed to create family group" });
  }
});

router.post("/family/join", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { inviteCode } = req.body as { inviteCode: string };
    if (!inviteCode) { res.status(400).json({ error: "Invite code required" }); return; }
    const [group] = await db.select().from(familyGroupsTable).where(eq(familyGroupsTable.inviteCode, inviteCode.toUpperCase().trim()));
    if (!group) { res.status(404).json({ error: "Invalid invite code" }); return; }
    if (!group.isActive) { res.status(400).json({ error: "Yeh group active nahi hai" }); return; }
    const existing = await db.select().from(familyMembersTable).where(eq(familyMembersTable.userId, req.userId!));
    if (existing.length) { res.status(400).json({ error: "Pehle se ek group mein ho" }); return; }
    const members = await db.select().from(familyMembersTable).where(eq(familyMembersTable.groupId, group.id));
    if (members.length >= (group.maxMembers || 6)) { res.status(400).json({ error: "Group full ho gaya hai" }); return; }
    await db.insert(familyMembersTable).values({ groupId: group.id, userId: req.userId!, role: "member" });

    // Sync member's plan to "family" with owner's subscription expiry
    const [ownerSub] = await db.select().from(subscriptionsTable)
      .where(and(eq(subscriptionsTable.userId, group.ownerId), eq(subscriptionsTable.status, "active")))
      .orderBy(desc(subscriptionsTable.createdAt)).limit(1);
    const expiresAt = ownerSub?.expiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.insert(subscriptionsTable).values({
      userId: req.userId!, plan: "family", status: "active", source: "family_invite",
      expiresAt, paymentType: "one_time", autoRenew: false, nextRenewalAt: expiresAt,
    });
    await db.update(usersTable).set({ plan: "family" }).where(eq(usersTable.id, req.userId!));

    res.json({ success: true, group, message: "Family group mein join ho gaye! Family plan active hai." });
  } catch {
    res.status(500).json({ error: "Failed to join family group" });
  }
});

router.delete("/family/leave", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [membership] = await db.select().from(familyMembersTable).where(eq(familyMembersTable.userId, req.userId!));
    if (!membership) { res.status(404).json({ error: "Kisi group mein nahi ho" }); return; }
    const [group] = await db.select().from(familyGroupsTable).where(eq(familyGroupsTable.id, membership.groupId));
    if (group.ownerId === req.userId) {
      const allMembers = await db.select().from(familyMembersTable).where(eq(familyMembersTable.groupId, group.id));
      if (allMembers.length > 1) {
        res.status(400).json({ error: "Owner hote hue group nahi chod sakte jab tak members hain. Pehle group dissolve karo." });
        return;
      }
      await db.delete(familyGroupsTable).where(eq(familyGroupsTable.id, group.id));
    } else {
      await db.delete(familyMembersTable).where(and(eq(familyMembersTable.userId, req.userId!), eq(familyMembersTable.groupId, group.id)));
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to leave group" });
  }
});

export default router;
