const fs = require('fs');

let file = fs.readFileSync('artifacts/api-server/src/routes/modules/ai.ts', 'utf8');

const routeCode = `
// TEMPORARY DB FIX ROUTE
router.get("/fix-db", async (req, res) => {
  try {
    const { pool } = await import("@workspace/db");
    const query = \`
      ALTER TABLE user_profiles
      ADD COLUMN IF NOT EXISTS current_health_streak INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS longest_health_streak INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS rolling_7_day_score INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS rolling_30_day_score INTEGER DEFAULT 0;
    \`;
    await pool.query(query);
    res.json({ success: true, message: "Database columns added successfully!" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || String(error) });
  }
});

export default router;`;

file = file.replace('export default router;', routeCode);

fs.writeFileSync('artifacts/api-server/src/routes/modules/ai.ts', file);
