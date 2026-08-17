-- Pre-existing duplicate (user_id, sleep_date) rows (from the old
-- ON CONFLICT (id) DO NOTHING bug, which never actually deduped) would
-- make the unique index below fail to create. Collapse duplicates first,
-- keeping only the most recently logged row per date.
DELETE FROM "sleep_logs" a
USING "sleep_logs" b
WHERE a.user_id = b.user_id
  AND a.sleep_date = b.sleep_date
  AND (a.logged_at, a.id) < (b.logged_at, b.id);
--> statement-breakpoint
DROP INDEX "idx_sleep_logs_user_sleep_date";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sleep_logs_user_sleep_date" ON "sleep_logs" USING btree ("user_id","sleep_date");