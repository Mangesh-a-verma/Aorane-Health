import re

with open('artifacts/api-server/src/routes/modules/business.ts', 'r') as f:
    content = f.read()

# We need to remove the duplicated old logic that was left behind
# Specifically, from `}); return; }` to the end of the old block's catch statement.

old_bad_code = """}); return; }
    const isAoraneId = /^\\d{8,12}$/.test(q);

    // Get all member userIds in this org
    const memberRows = await db.select({ userId: orgMembersTable.userId })
      .from(orgMembersTable)
      .where(and(eq(orgMembersTable.orgId, req.orgId!), eq(orgMembersTable.isActive, true)));
    const memberIds = memberRows.map((m: any) => m.userId);
    if (!memberIds.length) { res.json({ results: [], count: 0 }); return; }

    let profiles: typeof userProfilesTable.$inferSelect[] = [];
    if (isAoraneId) {
      profiles = await db.select().from(userProfilesTable).where(eq(userProfilesTable.aoraneId, q)).limit(10);
    } else {
      profiles = await db.select().from(userProfilesTable).where(ilike(userProfilesTable.fullName, `%${q}%`)).limit(10);
    }
    // Filter to only org members
    const filteredProfiles = profiles.filter((p: any) => memberIds.includes(p.userId));

    const results = await Promise.all(filteredProfiles.map(async (p: any) => {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, p.userId)).limit(1);
      return {
        userId: p.userId,
        aoraneId: p.aoraneId,
        name: p.fullName,
        bloodGroup: p.bloodGroup,
        gender: p.gender,
        age: p.dateOfBirth ? Math.floor((Date.now() - new Date(p.dateOfBirth).getTime()) / (86400000 * 365.25)) : null,
        city: (p as Record<string, unknown>).city,
        bmi: p.bmi,
        plan: user?.plan,
      };
    }));
    res.json({ results, count: results.length });
  } catch (err) {
    req.log.error({ err }, "Business search error");
    res.status(500).json({ error: "Search failed" });
  }"""

content = content.replace(old_bad_code, "});")

with open('artifacts/api-server/src/routes/modules/business.ts', 'w') as f:
    f.write(content)
