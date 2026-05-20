import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

async function fixDatabase() {
  logger.info("Starting global Drizzle/Postgres alignment fix...");

  const query = `
    ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS current_health_streak INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS longest_health_streak INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS rolling_7_day_score INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS rolling_30_day_score INTEGER DEFAULT 0;
  `;

  try {
    await pool.query(query);
    logger.info("Successfully executed user_profiles table modifications.");
  } catch (error: any) {
    logger.error({ err: error.message || String(error) }, "Failed to execute global database fix");
    process.exit(1);
  }

  process.exit(0);
}

fixDatabase();
