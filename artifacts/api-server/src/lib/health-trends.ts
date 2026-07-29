import { pool } from "@workspace/db";
import { logger } from "./logger";

function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export async function updateHealthTrends(userId: string): Promise<void> {
  try {
    // IMMEDIATE SAFETY WRAPPER: Avoid hard crash if schema is out of sync
    const checkColumns = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'current_health_streak'`
    );

    if (checkColumns.rowCount === 0) {
      logger.warn("Bypassed health trends crash: current_health_streak column is missing from user_profiles table.");
      return;
    }

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

    if (hasToday) {
      if (!hasYesterday && currentStreak > 0) {
        currentStreak = 1;
      } else if (hasYesterday && currentStreak === 0) {
        currentStreak = 2;
      }
    }

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

    await pool.query(
      `UPDATE user_profiles SET
        current_health_streak = $1,
        longest_health_streak = $2,
        rolling_7_day_score = $3,
        rolling_30_day_score = $4
       WHERE user_id = $5`,
      [currentStreak, longestStreak, rolling7, rolling30, userId]
    );

  } catch (err: any) {
    logger.warn({ err: err.message || String(err) }, "Bypassed health trends crash.");
  }
}
