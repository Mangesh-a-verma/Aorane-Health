const fs = require('fs');
let file = fs.readFileSync('artifacts/api-server/src/lib/health-trends.ts', 'utf8');

// Replace the SELECT query to safely check if columns exist by selecting the whole row and checking properties, or catching the error.
const brokenSelect = `      pool.query(
        \`SELECT current_health_streak, longest_health_streak FROM user_profiles WHERE user_id=$1\`,
        [userId]
      ),`;

const safeSelect = `      pool.query(
        \`SELECT * FROM user_profiles WHERE user_id=$1\`,
        [userId]
      ).catch(() => ({ rows: [] })),`;

file = file.replace(brokenSelect, safeSelect);

const brokenUpdate = `    // Update user profile
    await pool.query(
      \`UPDATE user_profiles SET
        current_health_streak = $1,
        longest_health_streak = $2,
        rolling_7_day_score = $3,
        rolling_30_day_score = $4
       WHERE user_id = $5\`,
      [currentStreak, longestStreak, rolling7, rolling30, userId]
    );`;

const safeUpdate = `    // Update user profile (safe fallback if columns do not exist in DB)
    try {
      await pool.query(
        \`UPDATE user_profiles SET
          current_health_streak = $1,
          longest_health_streak = $2,
          rolling_7_day_score = $3,
          rolling_30_day_score = $4
         WHERE user_id = $5\`,
        [currentStreak, longestStreak, rolling7, rolling30, userId]
      );
    } catch (e: any) {
      if (e.code === '42703') { // undefined_column
        logger.warn({ err: e.message }, "Skipping health trends update: columns missing in user_profiles");
      } else {
        throw e;
      }
    }`;

file = file.replace(brokenUpdate, safeUpdate);

fs.writeFileSync('artifacts/api-server/src/lib/health-trends.ts', file);
