-- Hand-adjusted after generation. `drizzle-kit generate` diffs the schema
-- files against the migrations on disk, NOT against a live database, and it
-- emits plain `ADD COLUMN` with no existence guard. Every column added below
-- ALREADY EXISTS in production: it was created months ago by
-- artifacts/api-server/src/lib/migrate.ts (the legacy hardening script) via
-- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, while the Drizzle schema and
-- these migration files never caught up. Run as generated, every statement
-- here would abort with "column already exists", and because
-- `pnpm --filter @workspace/db run migrate` sits in Render's buildCommand,
-- that aborts the whole deploy.
--
-- So: additions are guarded with IF NOT EXISTS, and the type/nullability
-- changes are written so they are no-ops on a database that already matches.
-- On a genuinely fresh database (0000..0011 applied in full) every statement
-- still does real work, so both paths converge on the same schema.

--> statement-breakpoint
-- daily_health_scores: sub-scores are nullable-with-no-default in the schema.
-- "null" means the pillar was never logged that day, which the health report
-- renders as "Not tracked" rather than as a genuine zero. Production is
-- already nullable but still carries the old DEFAULT 0, which would keep
-- re-introducing indistinguishable zeroes on insert.
ALTER TABLE "daily_health_scores" ALTER COLUMN "food_score" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "daily_health_scores" ALTER COLUMN "food_score" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_health_scores" ALTER COLUMN "exercise_score" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "daily_health_scores" ALTER COLUMN "exercise_score" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_health_scores" ALTER COLUMN "water_score" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "daily_health_scores" ALTER COLUMN "water_score" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_health_scores" ALTER COLUMN "medicine_score" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "daily_health_scores" ALTER COLUMN "medicine_score" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_health_scores" ALTER COLUMN "sleep_score" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "daily_health_scores" ALTER COLUMN "sleep_score" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_health_scores" ADD COLUMN IF NOT EXISTS "sleep_hours" numeric(4, 2);--> statement-breakpoint
ALTER TABLE "daily_health_scores" ADD COLUMN IF NOT EXISTS "medicines_taken" integer;--> statement-breakpoint
ALTER TABLE "daily_health_scores" ADD COLUMN IF NOT EXISTS "medicines_scheduled" integer;--> statement-breakpoint
ALTER TABLE "daily_health_scores" ADD COLUMN IF NOT EXISTS "score_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
-- Production created score_version as smallint; the schema declares integer.
-- Widening is implicit and lossless, and makes both paths agree.
ALTER TABLE "daily_health_scores" ALTER COLUMN "score_version" SET DATA TYPE integer;--> statement-breakpoint

-- org_payments: money columns are INTEGER in every real database (created
-- that way by migrate.ts) but were declared text here. The USING clause is
-- required, not optional: text -> integer has no assignment cast, so on a
-- fresh database built from 0000 this would fail without it, and on
-- production (already integer) it is a no-op cast.
ALTER TABLE "org_payments" ALTER COLUMN "billing_cycle" SET DEFAULT 'monthly';--> statement-breakpoint
ALTER TABLE "org_payments" ALTER COLUMN "billing_cycle" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "org_payments" ALTER COLUMN "seat_price" SET DATA TYPE integer USING "seat_price"::integer;--> statement-breakpoint
ALTER TABLE "org_payments" ALTER COLUMN "base_amount" SET DATA TYPE integer USING "base_amount"::integer;--> statement-breakpoint
ALTER TABLE "org_payments" ALTER COLUMN "gst_amount" SET DATA TYPE integer USING "gst_amount"::integer;--> statement-breakpoint
ALTER TABLE "org_payments" ALTER COLUMN "cgst_amount" SET DATA TYPE integer USING "cgst_amount"::integer;--> statement-breakpoint
ALTER TABLE "org_payments" ALTER COLUMN "sgst_amount" SET DATA TYPE integer USING "sgst_amount"::integer;--> statement-breakpoint
ALTER TABLE "org_payments" ALTER COLUMN "igst_amount" SET DATA TYPE integer USING "igst_amount"::integer;--> statement-breakpoint

ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "sleep_reminders" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "stress_reminders" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "stress_reminder_times" text DEFAULT '12:00,20:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "quiet_hours_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint

-- users: token-revocation watermark and the soft-delete marker.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_logout_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;--> statement-breakpoint

-- organizations: b2b_plan / crm_enabled gate the Business CRM (see
-- b2b_plan_config), plan_status is the org lifecycle flag the admin panel
-- already writes.
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "b2b_plan" text DEFAULT 'starter';--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "crm_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "plan_status" text DEFAULT 'active';--> statement-breakpoint

ALTER TABLE "wearable_data" ADD COLUMN IF NOT EXISTS "source_package" text;--> statement-breakpoint
ALTER TABLE "wearable_data" ADD COLUMN IF NOT EXISTS "source_device" text;
--> statement-breakpoint

-- ─────────────────────────────────────────────────────────────────────────
-- Security hardening for objects created outside this migration system
-- ─────────────────────────────────────────────────────────────────────────
-- Flagged by Supabase's database linter. All three were created by hand
-- (Supabase SQL editor), not by migrate.ts and not by any migration, so this
-- is the first place they are version-controlled. Every statement is guarded
-- for existence: on a fresh database built only from 0000..0012 these objects
-- do not exist yet, and an unguarded REVOKE/ALTER would abort the migration.
--
-- NOTE for whoever recreates these objects later: re-running a bare
-- CREATE OR REPLACE will NOT restore these grants/settings by itself, but it
-- will not undo them either (REPLACE keeps existing privileges). If you ever
-- DROP and recreate, re-apply this block.

-- 1. purge_old_deleted_accounts() is SECURITY DEFINER and runs
--    `DELETE FROM users WHERE deleted_at < now() - 30 days`. It was
--    EXECUTE-able by `anon`, i.e. reachable unauthenticated through
--    PostgREST at /rest/v1/rpc/purge_old_deleted_accounts. Nothing in the
--    application calls it - it is an operator tool - so no caller loses
--    anything by locking it down to the service/owner roles.
DO $$
BEGIN
  IF to_regprocedure('public.purge_old_deleted_accounts()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.purge_old_deleted_accounts() FROM PUBLIC, anon, authenticated;
    ALTER FUNCTION public.purge_old_deleted_accounts() SET search_path = public, pg_catalog;
  END IF;
END $$;--> statement-breakpoint

-- 2. rls_auto_enable() is an event-trigger function. It is only ever invoked
--    by Postgres itself on DDL, never called directly, so exposing it over
--    RPC serves no purpose.
DO $$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
  END IF;
END $$;--> statement-breakpoint

-- 3. deleted_users is a SECURITY DEFINER view exposing the email, phone and
--    name of every soft-deleted account, and anon held SELECT on it. Two
--    independent fixes, because either alone would be enough and both are
--    cheap: security_invoker makes the view run with the caller's own rights
--    (so `users` RLS applies to it instead of the view owner's rights), and
--    the grants are dropped so the anon/authenticated roles cannot read it
--    at all. The API server connects as the table owner and is unaffected.
DO $$
BEGIN
  IF to_regclass('public.deleted_users') IS NOT NULL THEN
    EXECUTE 'ALTER VIEW public.deleted_users SET (security_invoker = on)';
    EXECUTE 'REVOKE ALL ON public.deleted_users FROM PUBLIC, anon, authenticated';
  END IF;
END $$;
