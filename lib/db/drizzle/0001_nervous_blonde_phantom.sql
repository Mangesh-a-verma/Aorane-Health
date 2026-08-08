-- NOTE: `IF NOT EXISTS` added by hand for this one statement only.
-- artifacts/api-server/src/lib/migrate.ts (the legacy, backward-compat
-- migration script kept alongside this new Drizzle-based system) already
-- creates this exact table with an inline `UNIQUE(user_id, score_date)`
-- column constraint, which Postgres auto-names
-- "daily_health_scores_user_id_score_date_key" — identical to the name
-- drizzle-kit generated here. On every database that was bootstrapped via
-- that legacy script (i.e. real current production), this constraint
-- already exists, so the plain `CREATE UNIQUE INDEX` drizzle-kit generates
-- would fail with "relation already exists". Verified directly: running
-- this migration against a database built by migrate.ts alone reproduces
-- that exact error without this guard. `IF NOT EXISTS` makes this
-- idempotent both there and on a genuinely fresh database (where this
-- migration creates the constraint for the first time).
CREATE UNIQUE INDEX IF NOT EXISTS "daily_health_scores_user_id_score_date_key" ON "daily_health_scores" USING btree ("user_id","score_date");--> statement-breakpoint
CREATE INDEX "idx_user_medical_conditions_user_active" ON "user_medical_conditions" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_food_logs_user_logged_at" ON "food_logs" USING btree ("user_id","logged_at");--> statement-breakpoint
CREATE INDEX "idx_exercise_logs_user_logged_at" ON "exercise_logs" USING btree ("user_id","logged_at");--> statement-breakpoint
CREATE INDEX "idx_medicine_logs_user_scheduled_at" ON "medicine_logs" USING btree ("user_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_medicine_schedules_user_active" ON "medicine_schedules" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_period_logs_user_start_date" ON "period_logs" USING btree ("user_id","start_date");--> statement-breakpoint
CREATE INDEX "idx_sleep_logs_user_sleep_date" ON "sleep_logs" USING btree ("user_id","sleep_date");--> statement-breakpoint
CREATE INDEX "idx_stress_logs_user_logged_at" ON "stress_logs" USING btree ("user_id","logged_at");--> statement-breakpoint
CREATE INDEX "idx_water_logs_user_logged_at" ON "water_logs" USING btree ("user_id","logged_at");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_razorpay_subscription_id" ON "subscriptions" USING btree ("razorpay_subscription_id");--> statement-breakpoint
CREATE INDEX "idx_wearable_data_user_recorded_at" ON "wearable_data" USING btree ("user_id","recorded_at");