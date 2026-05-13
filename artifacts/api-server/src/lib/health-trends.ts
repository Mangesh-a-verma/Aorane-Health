import { pool } from "@workspace/db";
import { logger } from "./logger";

function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export async function updateHealthTrends(userId: string): Promise<void> {
  try {
    const today = todayIST();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

    // 1. Fetch Rolling Averages from daily_health_scores
    const [weekR, monthR, profileR, todayScoreR, yesterdayScoreR] = await Promise.all([
      pool.query(
        `SELECT ROUND(AVG(health_score)) as avg_score FROM daily_health_scores WHERE user_id=$1 AND score_date > $2 AND score_date <= $3`,
        [userId, weekAgo, today]
      ),
      pool.query(
        `SELECT ROUND(AVG(health_score)) as avg_score FROM daily_health_scores WHERE user_id=$1 AND score_date > $2 AND score_date <= $3`,
        [userId, monthAgo, today]
      ),
      pool.query(
        `SELECT current_health_streak, longest_health_streak FROM user_profiles WHERE user_id=$1`,
        [userId]
      ),
      pool.query(
        `SELECT health_score FROM daily_health_scores WHERE user_id=$1 AND score_date=$2`,
        [userId, today]
      ),
      pool.query(
        `SELECT health_score FROM daily_health_scores WHERE user_id=$1 AND score_date=$2`,
        [userId, yesterday]
      )
    ]);

    const rolling7 = weekR.rows[0]?.avg_score ? parseInt(weekR.rows[0].avg_score) : null;
    const rolling30 = monthR.rows[0]?.avg_score ? parseInt(monthR.rows[0].avg_score) : null;

    let currentStreak = parseInt(profileR.rows[0]?.current_health_streak || "0");
    let longestStreak = parseInt(profileR.rows[0]?.longest_health_streak || "0");

    const hasToday = !!todayScoreR.rows[0];
    const hasYesterday = !!yesterdayScoreR.rows[0];

    // Basic Streak Logic:
    // If they logged today, and logged yesterday, streak continues/increments.
    // If they didn't log yesterday, streak breaks unless it's a completely fresh start today.
    // (Actual logic depends on when this runs. Assuming it runs after a score is upserted).
    if (hasToday) {
      if (!hasYesterday && currentStreak > 0) {
        // Streak broke yesterday, resetting to 1 for today
        currentStreak = 1;
      } else if (hasYesterday && currentStreak === 0) {
        // Edge case correction
        currentStreak = 2;
      } else if (hasYesterday && currentStreak > 0) {
        // Increment handled safely by not over-counting if run multiple times a day
        // We actually need a "last_streak_update" date to do this perfectly,
        // but for now, we'll estimate or just ensure we don't blindly add +1 every API call.
        // For a safe idempotent approach without schema changes: we calculate exact consecutive days from DB.
      }
    }

    // Idempotent Streak Calculation: Count consecutive days backwards from today
    const historyR = await pool.query(
      `SELECT score_date FROM daily_health_scores WHERE user_id=$1 AND score_date <= $2 ORDER BY score_date DESC LIMIT 365`,
      [userId, today]
    );
    
    let calculatedStreak = 0;
    let expectedDate = new Date(today);
    
    for (const row of historyR.rows) {
      const rowDate = row.score_date;
      const expDateStr = expectedDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      if (rowDate === expDateStr) {
        calculatedStreak++;
        expectedDate.setDate(expectedDate.getDate() - 1);
      } else {
        break;
      }
    }

    currentStreak = calculatedStreak;
    longestStreak = Math.max(currentStreak, longestStreak);

    // Update user profile
    await pool.query(
      `UPDATE user_profiles SET 
        current_health_streak = $1, 
        longest_health_streak = $2, 
        rolling_7_day_score = $3, 
        rolling_30_day_score = $4 
       WHERE user_id = $5`,
      [currentStreak, longestStreak, rolling7, rolling30, userId]
    );

  } catch (err) {
    logger.error({ err }, "Failed to update health trends");
  }
}
