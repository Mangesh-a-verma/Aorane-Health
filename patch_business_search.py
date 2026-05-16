import re

with open('artifacts/api-server/src/routes/modules/business.ts', 'r') as f:
    content = f.read()

search_code_start = 'router.get("/business/members/search", requireBusinessAuth, async (req: BusinessRequest, res) => {'
search_code_end_index = content.find('});', content.find(search_code_start)) + 3
search_code_block = content[content.find(search_code_start):search_code_end_index]

new_search_code = """router.get("/business/members/search", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    const q = ((req.query.q as string) || "").trim();
    if (!q || q.length < 4) { res.status(400).json({ error: "Minimum 4 characters required" }); return; }
    const isAoraneId = /^\\d{8,12}$/.test(q);

    let queryCondition = isAoraneId
      ? eq(userProfilesTable.aoraneId, q)
      : ilike(userProfilesTable.fullName, `%${q}%`);

    const resultsRaw = await db.select({
      userId: userProfilesTable.userId,
      aoraneId: userProfilesTable.aoraneId,
      name: userProfilesTable.fullName,
      bloodGroup: userProfilesTable.bloodGroup,
      gender: userProfilesTable.gender,
      dateOfBirth: userProfilesTable.dateOfBirth,
      city: userProfilesTable.city,
      bmi: userProfilesTable.bmi,
      plan: usersTable.plan,
    })
    .from(userProfilesTable)
    .innerJoin(orgMembersTable, eq(orgMembersTable.userId, userProfilesTable.userId))
    .leftJoin(usersTable, eq(usersTable.id, userProfilesTable.userId))
    .where(
      and(
        eq(orgMembersTable.orgId, req.orgId!),
        eq(orgMembersTable.isActive, true),
        queryCondition
      )
    )
    .limit(10);

    const results = resultsRaw.map((p) => ({
      userId: p.userId,
      aoraneId: p.aoraneId,
      name: p.name,
      bloodGroup: p.bloodGroup,
      gender: p.gender,
      age: p.dateOfBirth ? Math.floor((Date.now() - new Date(p.dateOfBirth).getTime()) / (86400000 * 365.25)) : null,
      city: p.city,
      bmi: p.bmi,
      plan: p.plan,
    }));

    res.json({ results, count: results.length });
  } catch (err) {
    req.log.error({ err }, "Business search error");
    res.status(500).json({ error: "Search failed" });
  }
});"""

content = content.replace(search_code_block, new_search_code)

with open('artifacts/api-server/src/routes/modules/business.ts', 'w') as f:
    f.write(content)
