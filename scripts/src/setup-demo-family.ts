import { pool } from "@workspace/db";

const OWNER_ID   = "c35bdbdb-26d7-4e65-98c0-2ba8249bf9fa"; // Demo Owner  (9800000001)
const M1_ID      = "2139e5f5-65ac-4615-b093-28828200c7ee"; // Demo Spouse (9800000002)
const M2_ID      = "7a3eb621-31c8-4ac8-a8e0-f36e4deb263c"; // Demo Child  (9800000003)
const M3_ID      = "629d0a19-70dd-4663-9d4e-188fcded55f5"; // Demo Parent (9800000004)
const INVITE     = "DEMO1234";

async function main() {
  console.log("=== Demo Family Setup ===\n");

  // 1. Set owner plan to family
  await pool.query(`UPDATE users SET plan='family' WHERE id=$1`, [OWNER_ID]);
  console.log("✅ Owner plan → family");

  // 2. Insert subscription for owner
  await pool.query(`
    INSERT INTO subscriptions (user_id, plan, status, source, amount_paid, starts_at, expires_at, auto_renew)
    VALUES ($1, 'family', 'active', 'test', 499.00, NOW(), NOW() + INTERVAL '30 days', false)
    ON CONFLICT DO NOTHING
  `, [OWNER_ID]);
  console.log("✅ Subscription created");

  // 3. Remove old family groups for this owner (if any)
  await pool.query(`DELETE FROM family_groups WHERE owner_id=$1`, [OWNER_ID]);
  console.log("✅ Old family groups cleaned");

  // 4. Create family group with fixed invite code
  const groupRes = await pool.query(`
    INSERT INTO family_groups (owner_id, invite_code, max_members, is_active)
    VALUES ($1, $2, 4, true)
    RETURNING id
  `, [OWNER_ID, INVITE]);
  const groupId = groupRes.rows[0].id;
  console.log(`✅ Family group created — ID: ${groupId}  Invite: ${INVITE}`);

  // 5. Add owner as first member (owner)
  await pool.query(`
    INSERT INTO family_members (group_id, user_id, role, relation, is_minor, health_share_permission)
    VALUES ($1, $2, 'owner', 'self', false, 'full')
    ON CONFLICT DO NOTHING
  `, [groupId, OWNER_ID]);
  console.log("✅ Owner added as family member");

  // 6. Add 3 family members + set their plan to family
  const members = [
    { id: M1_ID, relation: "spouse", isMinor: false },
    { id: M2_ID, relation: "child",  isMinor: true  },
    { id: M3_ID, relation: "parent", isMinor: false },
  ];

  for (const m of members) {
    await pool.query(`
      INSERT INTO family_members (group_id, user_id, role, relation, is_minor, health_share_permission)
      VALUES ($1, $2, 'member', $3, $4, 'basic')
      ON CONFLICT DO NOTHING
    `, [groupId, m.id, m.relation, m.isMinor]);
    await pool.query(`UPDATE users SET plan='family' WHERE id=$1`, [m.id]);
    console.log(`✅ ${m.relation} joined & plan set to family`);
  }

  // 7. Insert some sample health data for owner (delete + insert to avoid constraint issues)
  const today = new Date().toISOString().split("T")[0];
  await pool.query(`DELETE FROM daily_health_scores WHERE user_id=$1 AND score_date=$2`, [OWNER_ID, today]);
  await pool.query(`
    INSERT INTO daily_health_scores
      (user_id, score_date, health_score, food_score, exercise_score, water_score, medicine_score, water_glasses, exercise_minutes, fields_logged, total_possible_fields)
    VALUES ($1, $2, 78, 80, 72, 90, 70, 7, 30, 3, 3)
  `, [OWNER_ID, today]);
  console.log("✅ Sample health score for owner");

  // 8. Insert sample health score for spouse
  await pool.query(`DELETE FROM daily_health_scores WHERE user_id=$1 AND score_date=$2`, [M1_ID, today]);
  await pool.query(`
    INSERT INTO daily_health_scores
      (user_id, score_date, health_score, food_score, exercise_score, water_score, medicine_score, water_glasses, exercise_minutes, fields_logged, total_possible_fields)
    VALUES ($1, $2, 65, 70, 55, 75, 60, 5, 20, 3, 3)
  `, [M1_ID, today]);
  console.log("✅ Sample health score for spouse");

  // 9. Update member permission for full share
  await pool.query(`
    UPDATE family_members SET health_share_permission='full'
    WHERE group_id=$1 AND user_id=$2
  `, [groupId, M1_ID]);
  console.log("✅ Spouse permission → full");

  // 10. Verify
  const verify = await pool.query(`
    SELECT u.plan, up.full_name, fm.relation, fm.role
    FROM family_members fm
    JOIN users u ON u.id = fm.user_id
    LEFT JOIN user_profiles up ON up.user_id = fm.user_id
    WHERE fm.group_id=$1
    ORDER BY fm.role
  `, [groupId]);

  console.log("\n=== Family Group Members ===");
  for (const row of verify.rows) {
    console.log(`  [${row.role.toUpperCase()}] ${row.full_name || "(no name)"} — relation: ${row.relation} — plan: ${row.plan}`);
  }
  console.log(`\nInvite Code: ${INVITE}`);
  console.log("=== Setup Complete ===");

  await pool.end();
}

main().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
