import { pool } from "@workspace/db";
import { logger } from "./logger";
import { buildNewFoodSeedSQL } from "./seed-new-foods";

// Safe startup migration — adds any missing columns using IF NOT EXISTS
// Run once at server startup; safe to re-run multiple times
export async function runStartupMigrations(): Promise<void> {
  const migrations: string[] = [
    // ══════════════════════════════════════════════════════════════════════════
    // BASE SCHEMA (foundational tables) — LEGACY / BACKWARD-COMPAT SAFETY NET
    // ──────────────────────────────────────────────────────────────────────────
    // ORIGINAL BUG (production deploy audit): render.yaml's buildCommand only
    // ran `db:migrate` (this file) — it never ran `drizzle-kit push`, which was
    // the only place these foundational tables (users, auth, profile, and core
    // health-logging tables) were ever defined. Every existing production
    // database got them because someone ran `pnpm --filter @workspace/db push`
    // by hand at some point in the past. On a brand-new, empty Postgres
    // database, this file would hit these tables via ALTER TABLE / FK
    // REFERENCES before they ever existed, fail every one of those statements
    // (caught and only logged as "Migration skipped"), and leave the app with
    // no usable schema at all — auth, profiles, and every health-log table
    // would be missing.
    //
    // CURRENT ARCHITECTURE: table structure is now owned by
    // `lib/db/src/schema/*.ts` (Drizzle) and applied via versioned SQL files
    // under `lib/db/drizzle/`, generated with `pnpm --filter @workspace/db
    // generate` and run by `lib/db/src/run-migrations.ts`
    // (`pnpm --filter @workspace/db run migrate`) — see that file for details.
    // render.yaml runs that step BEFORE this one, so on every current deploy
    // path these tables already exist by the time this file runs.
    //
    // The CREATE TABLE IF NOT EXISTS statements below are kept, unchanged, as
    // a backward-compatible safety net: they make this file (`db:migrate`)
    // fully self-sufficient on its own — for any deploy path, script, or
    // manual invocation that runs only this file without the schema-migration
    // step. They are pure additive, safe-to-rerun, no-ops on every database
    // that already has these tables (i.e. every current production DB, and
    // every fresh DB that already went through the schema-migration step).
    // ══════════════════════════════════════════════════════════════════════════

    `CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      phone TEXT UNIQUE,
      email TEXT UNIQUE,
      plan TEXT NOT NULL DEFAULT 'free',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      is_banned BOOLEAN NOT NULL DEFAULT FALSE,
      country_code TEXT NOT NULL DEFAULT 'IN',
      language_code TEXT NOT NULL DEFAULT 'hi',
      timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
      currency_code TEXT NOT NULL DEFAULT 'INR',
      referral_code TEXT UNIQUE,
      referred_by UUID,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS otp_store (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      phone TEXT NOT NULL,
      hashed_otp TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS user_auth_providers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      provider_user_id TEXT NOT NULL,
      email TEXT,
      is_primary BOOLEAN NOT NULL DEFAULT FALSE,
      linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS user_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      full_name TEXT,
      gender TEXT,
      profile_photo_url TEXT,
      weight_kg NUMERIC(5,2),
      bmi NUMERIC(5,2),
      blood_group TEXT,
      food_preference TEXT,
      current_health_streak INTEGER NOT NULL DEFAULT 0,
      longest_health_streak INTEGER NOT NULL DEFAULT 0,
      rolling_7_day_score INTEGER,
      rolling_30_day_score INTEGER,
      biological_age INTEGER,
      ai_health_predictions JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS user_medical_conditions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      condition TEXT NOT NULL,
      condition_type TEXT,
      diagnosed_at TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS user_health_goals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      primary_goal TEXT NOT NULL,
      current_weight_kg NUMERIC(5,2),
      target_weight_kg NUMERIC(5,2),
      target_date TEXT,
      secondary_goals TEXT[],
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS user_preferences (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      language_code TEXT NOT NULL DEFAULT 'hi',
      dark_mode BOOLEAN NOT NULL DEFAULT FALSE,
      notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      medicine_reminders BOOLEAN NOT NULL DEFAULT TRUE,
      water_reminders BOOLEAN NOT NULL DEFAULT TRUE,
      weekly_report_email BOOLEAN NOT NULL DEFAULT FALSE,
      app_lock_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      app_lock_method TEXT,
      pin_hash TEXT,
      session_timeout_minutes INTEGER NOT NULL DEFAULT 5,
      ads_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS user_privacy_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      share_basic_profile BOOLEAN NOT NULL DEFAULT TRUE,
      share_bmi BOOLEAN NOT NULL DEFAULT TRUE,
      share_exercise_data BOOLEAN NOT NULL DEFAULT TRUE,
      share_water_intake BOOLEAN NOT NULL DEFAULT TRUE,
      share_sleep_data BOOLEAN NOT NULL DEFAULT FALSE,
      share_stress_level BOOLEAN NOT NULL DEFAULT FALSE,
      share_medicine_details BOOLEAN NOT NULL DEFAULT FALSE,
      share_medical_conditions BOOLEAN NOT NULL DEFAULT FALSE,
      share_food_data BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // ── core health-logging tables ──────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS exercise_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      exercise_type TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      intensity TEXT NOT NULL DEFAULT 'moderate',
      calories_burned NUMERIC(7,2),
      source TEXT NOT NULL DEFAULT 'manual',
      photo_url TEXT,
      is_offline_entry BOOLEAN NOT NULL DEFAULT FALSE,
      synced_at TIMESTAMPTZ,
      logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS water_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      glasses_count INTEGER NOT NULL DEFAULT 1,
      ml_amount INTEGER NOT NULL DEFAULT 250,
      drink_type TEXT NOT NULL DEFAULT 'water',
      is_offline_entry BOOLEAN NOT NULL DEFAULT FALSE,
      synced_at TIMESTAMPTZ,
      logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS medicine_schedules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      medicine_name TEXT NOT NULL,
      dosage TEXT,
      dose_count INTEGER NOT NULL DEFAULT 1,
      meal_timing TEXT NOT NULL DEFAULT 'anytime',
      frequency TEXT NOT NULL DEFAULT 'daily',
      custom_days TEXT[],
      reminder_times TEXT[] NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      refill_alert_days INTEGER NOT NULL DEFAULT 7,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS medicine_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      schedule_id UUID NOT NULL REFERENCES medicine_schedules(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      scheduled_at TIMESTAMPTZ NOT NULL,
      taken_at TIMESTAMPTZ,
      is_offline_entry BOOLEAN NOT NULL DEFAULT FALSE,
      synced_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS food_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      food_name_en TEXT NOT NULL,
      meal_type TEXT NOT NULL,
      input_method TEXT NOT NULL DEFAULT 'text',
      quantity_g NUMERIC(7,2),
      calories NUMERIC(7,2) NOT NULL,
      protein_g NUMERIC(6,2),
      carbs_g NUMERIC(6,2),
      fat_g NUMERIC(6,2),
      fiber_g NUMERIC(6,2),
      logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // ── referrals / emergency / wearable tables (actively queried by routes) ─
    `CREATE TABLE IF NOT EXISTS referrals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      referred_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reward_status TEXT NOT NULL DEFAULT 'pending',
      reward_amount NUMERIC(8,2),
      rewarded_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS emergency_contacts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      relation TEXT,
      is_primary BOOLEAN NOT NULL DEFAULT FALSE,
      notify_on_accident BOOLEAN NOT NULL DEFAULT TRUE,
      notify_on_blood_emergency BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS accident_emergency_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      lat TEXT NOT NULL,
      lng TEXT NOT NULL,
      accuracy_meters TEXT,
      address TEXT,
      status TEXT NOT NULL DEFAULT 'triggered',
      hospitals_notified INTEGER NOT NULL DEFAULT 0,
      police_notified BOOLEAN NOT NULL DEFAULT FALSE,
      nearby_hospitals_json TEXT,
      responded_at TIMESTAMPTZ,
      resolved_at TIMESTAMPTZ,
      cancelled_at TIMESTAMPTZ,
      cancel_reason TEXT,
      emergency_contacts_notified INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS wearable_connections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      token_expires_at TIMESTAMPTZ,
      scopes TEXT[],
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      last_synced_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS wearable_data (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      recorded_at TIMESTAMPTZ NOT NULL,
      synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      steps INTEGER,
      heart_rate_avg INTEGER,
      heart_rate_min INTEGER,
      heart_rate_max INTEGER,
      calories_burned NUMERIC(7,2),
      sleep_hours NUMERIC(3,1),
      blood_oxygen NUMERIC(5,2),
      active_minutes INTEGER,
      distance_km NUMERIC(6,2),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // wearable_data: attribution for who really recorded a reading. Samsung
    // Health / Fitbit / Garmin write INTO Health Connect instead of exposing
    // their own sync API, so `provider` is always "health_connect" and the
    // originating app was being thrown away. Additive and nullable — existing
    // rows keep working with no attribution.
    `ALTER TABLE wearable_data ADD COLUMN IF NOT EXISTS source_package TEXT`,
    `ALTER TABLE wearable_data ADD COLUMN IF NOT EXISTS source_device TEXT`,

    // user_profiles missing columns
    `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS city TEXT`,
    `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS state TEXT`,
    `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS aorane_id TEXT UNIQUE`,
    `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS food_allergies TEXT`,
    `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS exercise_types TEXT`,
    `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarding_step INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMPTZ`,
    `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS work_profile TEXT`,
    `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS sleep_hours_avg NUMERIC(3,1)`,
    `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS wake_time TEXT`,
    `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS sleep_time TEXT`,
    `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS stress_level_self TEXT`,
    `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS exercise_frequency TEXT`,
    `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS height_cm NUMERIC(5,2)`,
    `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS date_of_birth TEXT`,
    `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS activity_level TEXT`,

    // user_preferences missing columns
    `ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS calorie_goal INTEGER`,
    `ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS period_reminders BOOLEAN NOT NULL DEFAULT TRUE`,
    `ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS suggestion_notifications BOOLEAN NOT NULL DEFAULT TRUE`,
    `ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS water_reminder_times TEXT DEFAULT '09:00,13:00,18:00,21:00'`,
    `ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS food_reminder_time TEXT DEFAULT '07:30,12:30,19:30'`,
    `ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS medicine_reminder_time TEXT DEFAULT '08:00,14:00,21:00'`,
    `ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS wake_up_time TEXT DEFAULT '07:00'`,
    `ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS bed_time TEXT DEFAULT '22:30'`,
    `ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS food_reminders BOOLEAN NOT NULL DEFAULT TRUE`,
    `ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS water_goal_glasses INTEGER NOT NULL DEFAULT 8`,

    // ── Phase B notification settings ──
    `ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS sleep_reminders BOOLEAN NOT NULL DEFAULT TRUE`,
    `ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS stress_reminders BOOLEAN NOT NULL DEFAULT TRUE`,
    `ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS stress_reminder_times TEXT NOT NULL DEFAULT '12:00,20:00'`,
    `ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS quiet_hours_enabled BOOLEAN NOT NULL DEFAULT TRUE`,

    // user_health_goals unique constraint
    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname='user_health_goals_user_id_key'
        AND conrelid='user_health_goals'::regclass
      ) THEN
        ALTER TABLE user_health_goals ADD CONSTRAINT user_health_goals_user_id_key UNIQUE (user_id);
      END IF;
    END $$`,

    // exercise_logs missing columns (met_value, input_method, notes may not exist in older DBs)
    `ALTER TABLE exercise_logs ADD COLUMN IF NOT EXISTS met_value NUMERIC(5,2)`,
    `ALTER TABLE exercise_logs ADD COLUMN IF NOT EXISTS input_method TEXT DEFAULT 'manual'`,
    `ALTER TABLE exercise_logs ADD COLUMN IF NOT EXISTS notes TEXT`,
    `ALTER TABLE exercise_logs ADD COLUMN IF NOT EXISTS sets INTEGER`,
    `ALTER TABLE exercise_logs ADD COLUMN IF NOT EXISTS reps INTEGER`,
    `ALTER TABLE exercise_logs ADD COLUMN IF NOT EXISTS steps INTEGER`,

    // ── food_items table (needed for food scan + food logs) ──────────────────
    `CREATE TABLE IF NOT EXISTS food_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      food_name_en TEXT NOT NULL,
      food_name_local JSONB,
      category TEXT,
      subcategory TEXT,
      cuisine_type TEXT,
      country_code TEXT NOT NULL DEFAULT 'IN',
      region_code TEXT,
      is_global BOOLEAN NOT NULL DEFAULT FALSE,
      dietary_tags TEXT[],
      calories NUMERIC(7,2) NOT NULL,
      protein_g NUMERIC(6,2),
      carbs_g NUMERIC(6,2),
      fat_g NUMERIC(6,2),
      fiber_g NUMERIC(6,2),
      sugar_g NUMERIC(6,2),
      sodium_mg NUMERIC(7,2),
      potassium_mg NUMERIC(7,2),
      calcium_mg NUMERIC(7,2),
      iron_mg NUMERIC(6,2),
      vitamin_c_mg NUMERIC(6,2),
      vitamin_d_mcg NUMERIC(6,2),
      serving_size_g NUMERIC(6,2),
      serving_description TEXT,
      barcode TEXT,
      tags TEXT[],
      is_verified BOOLEAN NOT NULL DEFAULT FALSE,
      added_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // ── food_scan_cache table (AI scan cache to save tokens) ─────────────────
    `CREATE TABLE IF NOT EXISTS food_scan_cache (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      food_name_en TEXT NOT NULL UNIQUE,
      ai_result JSONB NOT NULL,
      food_item_id UUID REFERENCES food_items(id),
      hit_count INTEGER NOT NULL DEFAULT 1,
      last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // ── Add food_item_id FK to food_logs if missing ──────────────────────────
    `ALTER TABLE food_logs ADD COLUMN IF NOT EXISTS food_item_id UUID REFERENCES food_items(id)`,
    `ALTER TABLE food_logs ADD COLUMN IF NOT EXISTS photo_url TEXT`,
    `ALTER TABLE food_logs ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(5,2)`,
    `ALTER TABLE food_logs ADD COLUMN IF NOT EXISTS is_offline_entry BOOLEAN NOT NULL DEFAULT FALSE`,
    `ALTER TABLE food_logs ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ`,
    `ALTER TABLE food_logs ADD COLUMN IF NOT EXISTS quantity_description TEXT`,

    // ── Safe enum creation (DO $$ pattern prevents error if enum already exists) ──
    `DO $$ BEGIN CREATE TYPE stress_type AS ENUM ('ppg','mood','five_pillar'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE mood_type AS ENUM ('happy','neutral','stressed','sad'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE payment_status AS ENUM ('pending','success','failed','refunded'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE subscription_status AS ENUM ('active','expired','cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$`,

    // ── stress_logs table ────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS stress_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      stress_type TEXT NOT NULL,
      stress_score INTEGER NOT NULL,
      mood TEXT,
      heart_rate_avg INTEGER,
      hrv_score NUMERIC(5,2),
      sleep_hours NUMERIC(3,1),
      food_quality_score INTEGER,
      exercise_minutes INTEGER,
      water_glasses INTEGER,
      medicine_adherence NUMERIC(5,2),
      pillars JSONB,
      ai_insight TEXT,
      is_offline_entry BOOLEAN NOT NULL DEFAULT FALSE,
      synced_at TIMESTAMPTZ,
      logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // ── period_logs table ────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS period_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      start_date TEXT NOT NULL,
      end_date TEXT,
      cycle_length INTEGER,
      symptoms TEXT[],
      flow TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // ── medical_reports table ────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS medical_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      report_type TEXT NOT NULL,
      report_date TEXT,
      lab_name TEXT,
      findings JSONB NOT NULL DEFAULT '{}',
      critical_values JSONB,
      ai_advice TEXT,
      diet_recommendations TEXT[],
      analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    // (production-hardening pass): patientName/urgencyLevel/followUpRequired
    // were already being extracted from the AI's analysis in medical.ts but
    // were silently dropped instead of being saved — a real data-loss bug.
    // pageCount is new, for multi-page report scan tracking.
    `ALTER TABLE medical_reports ADD COLUMN IF NOT EXISTS patient_name TEXT`,
    `ALTER TABLE medical_reports ADD COLUMN IF NOT EXISTS urgency_level TEXT`,
    `ALTER TABLE medical_reports ADD COLUMN IF NOT EXISTS follow_up_required BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE medical_reports ADD COLUMN IF NOT EXISTS page_count INTEGER NOT NULL DEFAULT 1`,

    // ── family_groups table ──────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS family_groups (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      invite_code TEXT NOT NULL UNIQUE,
      max_members INTEGER NOT NULL DEFAULT 4,
      plan_id TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // ── family_members table ─────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS family_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id UUID NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      relation TEXT NOT NULL DEFAULT 'other',
      is_minor BOOLEAN NOT NULL DEFAULT false,
      health_share_permission TEXT NOT NULL DEFAULT 'basic',
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `ALTER TABLE family_members ADD COLUMN IF NOT EXISTS relation TEXT NOT NULL DEFAULT 'other'`,
    `ALTER TABLE family_members ADD COLUMN IF NOT EXISTS is_minor BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE family_members ADD COLUMN IF NOT EXISTS health_share_permission TEXT NOT NULL DEFAULT 'basic'`,

    // ── subscriptions table ──────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      plan TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      source TEXT NOT NULL DEFAULT 'razorpay',
      seats INTEGER NOT NULL DEFAULT 1,
      amount_paid NUMERIC(10,2),
      discount_pct INTEGER NOT NULL DEFAULT 0,
      promo_code_used TEXT,
      starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      cancelled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // ── payments table ───────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      subscription_id UUID REFERENCES subscriptions(id),
      razorpay_order_id TEXT,
      razorpay_payment_id TEXT,
      amount NUMERIC(10,2) NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      status TEXT NOT NULL DEFAULT 'pending',
      plan TEXT NOT NULL,
      seats INTEGER NOT NULL DEFAULT 1,
      gateway_fee NUMERIC(8,2),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // ── promo_codes table ────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS promo_codes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT NOT NULL UNIQUE,
      discount_pct INTEGER NOT NULL,
      discount_type TEXT NOT NULL DEFAULT 'percent',
      applicable_plans TEXT[],
      usage_limit INTEGER,
      used_count INTEGER NOT NULL DEFAULT 0,
      is_lifetime_upgrade BOOLEAN NOT NULL DEFAULT FALSE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // ── plan_pricing table ───────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS plan_pricing (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      plan_key TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'individual',
      monthly_price NUMERIC(10,2) NOT NULL DEFAULT 0,
      yearly_price NUMERIC(10,2),
      max_seats INTEGER,
      features JSONB NOT NULL DEFAULT '[]',
      badge_text TEXT,
      badge_color TEXT DEFAULT '#0077B6',
      gradient_colors JSONB,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // ── Seed plan_pricing with default plans ─────────────────────────────────
    `INSERT INTO plan_pricing (plan_key, display_name, type, monthly_price, yearly_price, max_seats, features, badge_text, badge_color, sort_order)
     VALUES
       ('free',   'Free',       'individual', 0,    null, 1, '["Basic health tracking","Food & water logs","Exercise logging"]', null, '#6B7280', 0),
       ('pro',    'Pro',        'individual', 199,  1999, 1, '["Everything in Free","AI food scan","Health score","Medicine tracker","Stress tracking","Period tracker"]', 'Most Popular', '#0077B6', 1),
       ('max',    'Max',        'individual', 399,  3999, 1, '["Everything in Pro","Family group (4 members)","Blood donation","Wearable sync","Priority support"]', 'Best Value', '#7C3AED', 2),
       ('family', 'Family',     'family',     599,  5999, 6, '["6 family members","All Max features","Family health dashboard","Shared insights"]', 'For Families', '#DC2626', 3)
     ON CONFLICT (plan_key) DO NOTHING`,

    // ── blood_donors table (community feature) ────────────────────────────────
    `CREATE TABLE IF NOT EXISTS blood_donors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      blood_group TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      country_code TEXT NOT NULL DEFAULT 'IN',
      lat TEXT,
      lng TEXT,
      is_available BOOLEAN NOT NULL DEFAULT TRUE,
      last_donated_at TEXT,
      next_eligible_at TEXT,
      donation_count INTEGER NOT NULL DEFAULT 0,
      badges TEXT[],
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // daily_health_scores table (if not exists)
    `CREATE TABLE IF NOT EXISTS daily_health_scores (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      score_date TEXT NOT NULL,
      health_score INTEGER NOT NULL DEFAULT 0,
      data_confidence_pct TEXT,
      food_score INTEGER NOT NULL DEFAULT 0,
      exercise_score INTEGER NOT NULL DEFAULT 0,
      water_score INTEGER NOT NULL DEFAULT 0,
      medicine_score INTEGER NOT NULL DEFAULT 0,
      total_calories_in TEXT,
      water_glasses INTEGER DEFAULT 0,
      exercise_minutes INTEGER DEFAULT 0,
      fields_logged INTEGER DEFAULT 0,
      total_possible_fields INTEGER DEFAULT 3,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, score_date)
    )`,

    // ══════════════════════════════════════════════════════
    // PLATFORM TABLES (Admin Panel + Push + Ads)
    // ══════════════════════════════════════════════════════

    // ── push_tokens (canonical definition — do not redefine this table
    //    elsewhere in this file; see the CREATE UNIQUE INDEX further down
    //    for the ON CONFLICT fix that pairs with this table) ─────────────
    `CREATE TABLE IF NOT EXISTS push_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL,
      platform TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // ── notifications ─────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      data JSONB,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // ── announcements ─────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS announcements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      image_url TEXT,
      link_url TEXT,
      target_plans TEXT[],
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      starts_at TIMESTAMPTZ,
      ends_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // ── feature_flags ─────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS feature_flags (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      description TEXT,
      is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      enabled_for_plans TEXT[],
      config JSONB,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // ── ad_campaigns ──────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS ad_campaigns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ad_type TEXT NOT NULL DEFAULT 'direct',
      title TEXT NOT NULL,
      advertiser_name TEXT,
      banner_url TEXT,
      link_url TEXT,
      target_plans TEXT[],
      target_cities TEXT[],
      target_age_min INTEGER,
      target_age_max INTEGER,
      status TEXT NOT NULL DEFAULT 'active',
      priority INTEGER NOT NULL DEFAULT 1,
      deal_amount NUMERIC(10,2),
      impression_count INTEGER NOT NULL DEFAULT 0,
      click_count INTEGER NOT NULL DEFAULT 0,
      starts_at TIMESTAMPTZ,
      ends_at TIMESTAMPTZ,
      slide_position INTEGER DEFAULT 1,
      target_screen TEXT DEFAULT 'dashboard',
      google_ad_code TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // ── ad_impressions + ad_clicks ────────────────────────
    `CREATE TABLE IF NOT EXISTS ad_impressions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id UUID NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      user_plan TEXT,
      platform TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ad_clicks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id UUID NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // ── enquiries (lead capture from landing / business portal) ──
    `CREATE TABLE IF NOT EXISTS enquiries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      mobile TEXT,
      city TEXT,
      account_type TEXT,
      company_name TEXT,
      message TEXT,
      source TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      notified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // ── admin_users ───────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS admin_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // ── admin_audit_logs ──────────────────────────────────
    `CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      admin_id UUID NOT NULL REFERENCES admin_users(id),
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      details JSONB,
      ip_address TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // ── ai_config ─────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS ai_config (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      feature TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'nvidia',
      model TEXT NOT NULL DEFAULT 'meta/llama-3.1-70b-instruct',
      api_key TEXT,
      system_prompt TEXT,
      is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // ── company_settings (singleton, id=1) ────────────────
    `CREATE TABLE IF NOT EXISTS company_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      company_name TEXT NOT NULL DEFAULT 'AORANE Health',
      company_logo_url TEXT,
      tagline TEXT DEFAULT 'Your Health, In Your Hands',
      website TEXT DEFAULT 'aorane.com',
      support_phone TEXT,
      support_email TEXT,
      address TEXT,
      primary_color TEXT DEFAULT '#0077B6',
      accent_color TEXT DEFAULT '#00B896',
      scorecard_show_qr BOOLEAN DEFAULT TRUE,
      scorecard_show_blood_group BOOLEAN DEFAULT TRUE,
      scorecard_show_bmi BOOLEAN DEFAULT TRUE,
      scorecard_show_active_percent BOOLEAN DEFAULT TRUE,
      scorecard_bg_gradient_from TEXT DEFAULT '#023E8A',
      scorecard_bg_gradient_to TEXT DEFAULT '#1B998B',
      report_header_text TEXT,
      report_footer_text TEXT,
      report_logo_url TEXT,
      weekly_report_enabled BOOLEAN DEFAULT TRUE,
      monthly_report_enabled BOOLEAN DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS gstin TEXT`,
    `ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS cin TEXT`,
    `ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS pan TEXT`,
    `ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS city TEXT`,
    `ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS state TEXT`,
    `ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS pincode TEXT`,
    `ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'India'`,
    `ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS registered_address TEXT`,
    `ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS social_twitter TEXT`,
    `ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS social_linkedin TEXT`,
    `ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS social_instagram TEXT`,
    `ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS social_youtube TEXT`,
    `ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS social_facebook TEXT`,
    `ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS investor_deck_url TEXT`,
    `ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS android_play_store_url TEXT DEFAULT 'https://play.google.com/store/apps/details?id=in.aorane.app'`,
    `ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS ios_app_store_url TEXT`,

    // ══════════════════════════════════════════════════════
    // BUSINESS / CORPORATE TABLES
    // ══════════════════════════════════════════════════════

    // ── organizations ─────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS organizations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      org_type TEXT NOT NULL DEFAULT 'corporate',
      plan TEXT NOT NULL DEFAULT 'basic',
      org_code TEXT NOT NULL UNIQUE,
      contact_email TEXT NOT NULL,
      contact_phone TEXT,
      city TEXT,
      state TEXT,
      country_code TEXT NOT NULL DEFAULT 'IN',
      gstin TEXT,
      industry TEXT,
      company_size TEXT,
      hospital_type TEXT,
      bed_count INTEGER,
      nabh_accredited BOOLEAN NOT NULL DEFAULT FALSE,
      gym_type TEXT,
      member_count INTEGER,
      irdai_license TEXT,
      customer_base_size TEXT,
      total_seats INTEGER NOT NULL DEFAULT 10,
      used_seats INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      is_verified BOOLEAN NOT NULL DEFAULT FALSE,
      discount_pct INTEGER NOT NULL DEFAULT 0,
      trial_ends_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // ── org_admins ────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS org_admins (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // ── org_members ───────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS org_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      enrolled_via_code TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // ── enrollment_codes ──────────────────────────────────
    `CREATE TABLE IF NOT EXISTS enrollment_codes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      code TEXT NOT NULL UNIQUE,
      plan_type TEXT NOT NULL DEFAULT 'basic',
      total_seats INTEGER NOT NULL DEFAULT 10,
      used_seats INTEGER NOT NULL DEFAULT 0,
      validity_days INTEGER NOT NULL DEFAULT 365,
      expires_at TIMESTAMPTZ,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // ── insurance_api_keys ────────────────────────────────
    `CREATE TABLE IF NOT EXISTS insurance_api_keys (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      key_hash TEXT NOT NULL UNIQUE,
      key_prefix TEXT NOT NULL,
      label TEXT,
      last_used_at TIMESTAMPTZ,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // ── org_payments ──────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS org_payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      plan TEXT NOT NULL,
      seats INTEGER NOT NULL DEFAULT 50,
      amount TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      razorpay_order_id TEXT,
      razorpay_payment_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // ── org_announcements ─────────────────────────────────
    `CREATE TABLE IF NOT EXISTS org_announcements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'announcement',
      sent_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // ── languages (for multi-language support) ────────────
    `CREATE TABLE IF NOT EXISTS languages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT NOT NULL UNIQUE,
      name_en TEXT NOT NULL,
      name_local TEXT NOT NULL,
      direction TEXT NOT NULL DEFAULT 'ltr',
      is_active BOOLEAN NOT NULL DEFAULT FALSE,
      completion_pct INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // ══════════════════════════════════════════════════════
    // SEEDING: Default data for admin panel + platform
    // ══════════════════════════════════════════════════════

    // Seed company settings singleton
    `INSERT INTO company_settings (id, company_name, tagline, website, support_email, support_phone)
     VALUES (1, 'AORANE Health', 'Your Health, In Your Hands', 'aorane.com', 'support@aorane.com', '+91-9999999999')
     ON CONFLICT (id) DO NOTHING`,

    // Seed default feature flags
    `INSERT INTO feature_flags (key, label, description, is_enabled) VALUES
      ('food_ai_scan',       'AI Food Scan',         'AI-powered food scanning', true),
      ('stress_tracking',    'Stress Tracking',      'PPG + mood stress analysis', true),
      ('period_tracker',     'Period Tracker',       'Menstrual cycle tracking', true),
      ('family_health',      'Family Health',        'Family group health dashboard', true),
      ('blood_donation',     'Blood Donation',       'Blood donor community', true),
      ('wearable_sync',      'Wearable Sync',        'Health Connect (Phase 4)', false),
      ('business_portal',    'Business Portal',      'Corporate wellness dashboard', true),
      ('ai_health_coach',    'AI Health Coach',      'Personalized AI recommendations', true),
      ('whatsapp_bot',       'WhatsApp Bot',         'WhatsApp health assistant', false),
      ('razorpay_payments',  'Razorpay Payments',    'Live payment processing', false),
      ('blood_emergency',    'Blood Emergency',      'Emergency blood request system', true),
      ('weather_suggestions','Weather Suggestions',  'Seasonal food suggestions by weather', true)
     ON CONFLICT (key) DO NOTHING`,

    // Seed default AI config
    // NOTE: keys here MUST match actual callAI(feature, ...) call sites —
    // previously this seeded 'food_scan', 'health_coach', 'report_scan',
    // none of which any route ever calls (real keys are 'food_ai',
    // 'health_suggestions', 'medical_ai' respectively) — those rows just
    // sat in the DB unused while the real features fell back to the
    // DEFAULT_AI_FEATURES runtime default in admin.ts. Fixed to seed the
    // keys that are actually read, with "google" (Gemini) as the provider
    // actually in use for this project.
    `INSERT INTO ai_config (feature, label, provider, model, is_enabled) VALUES
      ('food_ai',            'Food Scan AI',       'google', 'gemini-2.0-flash', true),
      ('health_suggestions', 'Health Suggestions AI', 'google', 'gemini-2.0-flash', true),
      ('medical_ai',         'Medical Report AI',  'google', 'gemini-2.0-flash', true),
      ('stress_ai',          'Stress Analysis AI', 'google', 'gemini-2.0-flash', true)
     ON CONFLICT (feature) DO NOTHING`,

    // Remove old orphaned ai_config rows from any existing database — these
    // exact keys ('food_scan', 'health_coach', 'report_scan') are never
    // read by any route; the correct keys were seeded just above.
    `DELETE FROM ai_config WHERE feature IN ('food_scan', 'health_coach', 'report_scan')`,

    // Seed supported Indian languages
    `INSERT INTO languages (code, name_en, name_local, direction, is_active, completion_pct) VALUES
      ('hi', 'Hindi',     'हिन्दी',   'ltr', true, 90),
      ('en', 'English',   'English',  'ltr', true, 100),
      ('ta', 'Tamil',     'தமிழ்',    'ltr', true, 60),
      ('te', 'Telugu',    'తెలుగు',   'ltr', false, 20),
      ('kn', 'Kannada',   'ಕನ್ನಡ',   'ltr', false, 20),
      ('ml', 'Malayalam', 'മലയാളം',  'ltr', false, 10),
      ('mr', 'Marathi',   'मराठी',    'ltr', false, 30),
      ('gu', 'Gujarati',  'ગુજરાતી',  'ltr', false, 20),
      ('bn', 'Bengali',   'বাংলা',    'ltr', false, 10),
      ('pa', 'Punjabi',   'ਪੰਜਾਬੀ',  'ltr', false, 10)
     ON CONFLICT (code) DO NOTHING`,

    // ══════════════════════════════════════════════════════
    // ALTER TABLE: Add auto-subscription columns
    // ══════════════════════════════════════════════════════
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS razorpay_subscription_id TEXT`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'one_time'`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT FALSE`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS next_renewal_at TIMESTAMPTZ`,

    `ALTER TABLE payments ADD COLUMN IF NOT EXISTS razorpay_subscription_id TEXT`,

    `ALTER TABLE org_payments ADD COLUMN IF NOT EXISTS razorpay_subscription_id TEXT`,
    `ALTER TABLE org_payments ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'one_time'`,
    `ALTER TABLE org_payments ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT FALSE`,
    `ALTER TABLE org_payments ADD COLUMN IF NOT EXISTS next_renewal_at TIMESTAMPTZ`,
    // ══════════════════════════════════════════════════════
    // ALTER TABLE: Billing invoice + verification fields
    // ══════════════════════════════════════════════════════
    `ALTER TABLE org_payments ADD COLUMN IF NOT EXISTS billing_cycle TEXT NOT NULL DEFAULT 'monthly'`,
    `ALTER TABLE org_payments ADD COLUMN IF NOT EXISTS seat_price INTEGER`,
    `ALTER TABLE org_payments ADD COLUMN IF NOT EXISTS base_amount INTEGER`,
    `ALTER TABLE org_payments ADD COLUMN IF NOT EXISTS gst_amount INTEGER`,
    `ALTER TABLE org_payments ADD COLUMN IF NOT EXISTS cgst_amount INTEGER`,
    `ALTER TABLE org_payments ADD COLUMN IF NOT EXISTS sgst_amount INTEGER`,
    `ALTER TABLE org_payments ADD COLUMN IF NOT EXISTS igst_amount INTEGER`,
    `ALTER TABLE org_payments ADD COLUMN IF NOT EXISTS org_gstin TEXT`,
    `ALTER TABLE org_payments ADD COLUMN IF NOT EXISTS org_state TEXT`,
    `ALTER TABLE org_payments ADD COLUMN IF NOT EXISTS invoice_number TEXT`,
    `ALTER TABLE org_admins ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN NOT NULL DEFAULT FALSE`,
    `ALTER TABLE org_admins ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ`,
    `ALTER TABLE org_admins ADD COLUMN IF NOT EXISTS phone_otp_verified BOOLEAN NOT NULL DEFAULT FALSE`,

    // ── app_sessions: DAU/MAU tracking ─────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS app_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_id TEXT NOT NULL UNIQUE,
      device_type TEXT DEFAULT 'mobile',
      device_model TEXT,
      app_version TEXT,
      platform TEXT,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ended_at TIMESTAMPTZ,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      duration_seconds INTEGER,
      screen_count INTEGER DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_app_sessions_user_id ON app_sessions(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_app_sessions_started_at ON app_sessions(started_at)`,

    // NOTE: the `blood_donations` table (90-day donor cooldown) used to be
    // created right here, but its `request_id` column has
    // `REFERENCES blood_emergency_requests(id)`, and `blood_emergency_requests`
    // was only created much further down in this file. On any database that
    // already had `blood_emergency_requests` (i.e. real production, created
    // manually at some point) this silently worked; on a brand-new empty
    // database this FK reference failed at CREATE TABLE time (relation does
    // not exist), so `blood_donations` and its index were never created and
    // the failure was swallowed by the try/catch below ("Migration skipped").
    // MOVED below, after `blood_emergency_requests` is created, so a fresh
    // database creates both tables in valid dependency order. This is a pure
    // reordering of idempotent, IF-NOT-EXISTS statements — a no-op on every
    // database where both tables already exist.

    // ── blood_donors: add donor_inactive_until for 90-day cooldown enforcement ──
    `ALTER TABLE blood_donors ADD COLUMN IF NOT EXISTS donor_inactive_until TIMESTAMPTZ`,

    // ── plan_pricing: update Free/Max/Pro prices to correct values ──
    `UPDATE plan_pricing SET monthly_price='0', yearly_price=NULL, sort_order=0 WHERE plan_key='free'`,
    // July 2026: Max/Pro price swap — Max is the intended premium tier
    // (it gets equal-or-higher AI limits than Pro everywhere), so its
    // price should be higher than Pro's. Only the numbers move; display
    // names/badges stay attached to their existing plan_key.
    `UPDATE plan_pricing SET monthly_price='249', yearly_price='2490', sort_order=2 WHERE plan_key='max'`,
    `UPDATE plan_pricing SET monthly_price='199', yearly_price='1990', sort_order=1 WHERE plan_key='pro'`,

    // ── subscriptions: add 'pending' status for in-flight Razorpay subscription creation ──
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='pending' AND enumtypid=(SELECT oid FROM pg_type WHERE typname='subscription_status')) THEN ALTER TYPE subscription_status ADD VALUE 'pending'; END IF; END$$`,

    // ── feature_flags: add smart_scan (AI Smart Scan — available to all plans) ──
    `INSERT INTO feature_flags (key, label, description, is_enabled, enabled_for_plans)
     VALUES ('smart_scan', 'AI Smart Scan', 'Gemini-powered food/report/medicine image scanning', true, ARRAY[]::text[])
     ON CONFLICT (key) DO NOTHING`,

    // ── feature_flags: clear plan restrictions for core features (available to all plans) ──
    `UPDATE feature_flags SET enabled_for_plans = ARRAY[]::text[] WHERE key = 'smart_scan'`,
    `UPDATE feature_flags SET enabled_for_plans = ARRAY[]::text[], is_enabled = true WHERE key = 'wearable_sync'`,

    // ── ai_config: add smart_scan config (uses gemini-2.5-flash for vision) ──
    `INSERT INTO ai_config (feature, label, provider, model, is_enabled)
     VALUES ('smart_scan', 'Smart Scan AI (Vision)', 'google', 'gemini-2.5-flash', true)
     ON CONFLICT (feature) DO NOTHING`,

    // ══════════════════════════════════════════════════════
    // CREATE: daily_suggestions table (AI Daily Coach cache)
    // ══════════════════════════════════════════════════════
    `CREATE TABLE IF NOT EXISTS daily_suggestions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      suggestions_json JSONB NOT NULL,
      calorie_goal_used INTEGER,
      is_ai_generated BOOLEAN NOT NULL DEFAULT TRUE,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, date)
    )`,

    // ══════════════════════════════════════════════════════
    // CREATE: health_predictions table (Monthly AI health risk)
    // ══════════════════════════════════════════════════════
    `CREATE TABLE IF NOT EXISTS health_predictions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      month TEXT NOT NULL,
      prediction_json JSONB NOT NULL,
      data_snapshot_json JSONB,
      weather_context TEXT,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT health_predictions_user_month_uniq UNIQUE(user_id, month)
    )`,

    // ══════════════════════════════════════════════════════
    // CREATE: weekly_diet_charts table (Weekly AI diet plan)
    // ══════════════════════════════════════════════════════
    `CREATE TABLE IF NOT EXISTS weekly_diet_charts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      week_start TEXT NOT NULL,
      diet_chart_json JSONB NOT NULL,
      target_calories INTEGER,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT weekly_diet_charts_user_week_uniq UNIQUE(user_id, week_start)
    )`,

    // ── ai_config: seed missing features (health intelligence + suggestions) ──
    `INSERT INTO ai_config (feature, label, provider, model, is_enabled) VALUES
      ('health_prediction',  'Health Prediction AI',  'nvidia', 'meta/llama-3.3-70b-instruct', true),
      ('weekly_diet_chart',  'Weekly Diet Chart AI',  'nvidia', 'meta/llama-3.3-70b-instruct', true),
      ('health_suggestions', 'Daily Health Coach AI', 'nvidia', 'meta/llama-3.3-70b-instruct', true)
     ON CONFLICT (feature) DO NOTHING`,

    // ── food_scan_cache: new columns for AI food discovery workflow ───────────
    `ALTER TABLE food_scan_cache ADD COLUMN IF NOT EXISTS is_promoted   BOOLEAN     NOT NULL DEFAULT false`,
    `ALTER TABLE food_scan_cache ADD COLUMN IF NOT EXISTS is_rejected   BOOLEAN     NOT NULL DEFAULT false`,
    `ALTER TABLE food_scan_cache ADD COLUMN IF NOT EXISTS source_ai     TEXT`,
    `ALTER TABLE food_scan_cache ADD COLUMN IF NOT EXISTS name_normalized TEXT`,
    `ALTER TABLE food_scan_cache ADD COLUMN IF NOT EXISTS reviewed_at   TIMESTAMPTZ`,
    `ALTER TABLE food_scan_cache ADD COLUMN IF NOT EXISTS promoted_food_item_id UUID REFERENCES food_items(id) ON DELETE SET NULL`,

    // ── food_items: ai_generated flag for tracking AI-promoted items ──────────
    `ALTER TABLE food_items ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE food_items ADD COLUMN IF NOT EXISTS ai_source_cache_id UUID`,

    // ── push_tokens ──────────────────────────────────────────────────────────
    // NOTE: This used to be a SECOND `CREATE TABLE IF NOT EXISTS push_tokens`
    // (duplicate of the one defined earlier in this file, near line ~317).
    // Because that earlier CREATE TABLE runs first and does NOT include a
    // UNIQUE(user_id, token) constraint, the table already exists by the
    // time this statement runs — so `IF NOT EXISTS` causes it to be skipped
    // entirely, and the UNIQUE constraint from this block was NEVER actually
    // applied on any real database that ran migrations in order.
    //
    // This matters because `POST /users/push-token` (routes/modules/support.ts)
    // does:
    //   INSERT INTO push_tokens (...) VALUES (...) 
    //   ON CONFLICT (user_id, token) DO UPDATE ...
    // `ON CONFLICT` requires a matching UNIQUE constraint OR unique index to
    // exist — without one, every push-token save throws a Postgres error
    // ("there is no unique or exclusion constraint matching the ON CONFLICT
    // specification"), meaning push tokens may never be getting saved at all.
    //
    // FIX: a `CREATE UNIQUE INDEX IF NOT EXISTS` is idempotent and works
    // regardless of which CREATE TABLE statement actually created the table
    // on a given environment — it will correctly add the missing unique
    // index on existing databases, and be a safe no-op if it already exists.
    `CREATE UNIQUE INDEX IF NOT EXISTS push_tokens_user_token_uniq ON push_tokens(user_id, token)`,
    `CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id)`,

    // ── support_tickets: user complaints / help requests → admin panel ────────
    `CREATE TABLE IF NOT EXISTS support_tickets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      priority TEXT NOT NULL DEFAULT 'normal',
      user_name TEXT,
      user_email TEXT,
      user_phone TEXT,
      aorane_id TEXT,
      admin_notes TEXT,
      resolved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status)`,
    `CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_support_tickets_created ON support_tickets(created_at DESC)`,

    // ── NEW FOODS: Separately curated additions (see seed-new-foods.ts) ────────
    // These are NOT AI-generated; they are manually verified additions.
    // Kept in seed-new-foods.ts so original migration data stays clean.
    ...buildNewFoodSeedSQL(),

    // ── feature_flags: medical_report — gated to Max / Pro / Family only ────────
    // Free plan does NOT get medical report analysis (AI cost is high)
    `INSERT INTO feature_flags (key, label, description, is_enabled, enabled_for_plans)
     VALUES ('medical_report', 'Medical Report Scan', 'Gemini AI analysis of medical/lab reports — Max & Pro only', true, ARRAY['max','pro','family']::text[])
     ON CONFLICT (key) DO UPDATE SET enabled_for_plans = ARRAY['max','pro','family']::text[], is_enabled = true`,

    // ── feature_flags: smart_scan — restrict to paid plans (Max / Pro / Family) ─
    // Free plan: cannot use Gemini image scanner (high cost). Only 5 text scans/day.
    `UPDATE feature_flags SET enabled_for_plans = ARRAY['max','pro','family']::text[] WHERE key = 'smart_scan'`,

    // ── feature_flags: meal_planner — restrict to paid plans ────────────────────
    `INSERT INTO feature_flags (key, label, description, is_enabled, enabled_for_plans)
     VALUES ('meal_planner', 'AI Meal Planner', 'Personalised AI diet plans — Max & Pro only', true, ARRAY['max','pro','family']::text[])
     ON CONFLICT (key) DO UPDATE SET enabled_for_plans = ARRAY['max','pro','family']::text[], is_enabled = true`,

    // ── feature_flags: health_suggestions — restrict to paid plans ───────────────
    `INSERT INTO feature_flags (key, label, description, is_enabled, enabled_for_plans)
     VALUES ('health_suggestions', 'AI Health Tips', 'Personalised AI health coaching — Max & Pro only', true, ARRAY['max','pro','family']::text[])
     ON CONFLICT (key) DO UPDATE SET enabled_for_plans = ARRAY['max','pro','family']::text[], is_enabled = true`,

    // ── plan_pricing: update features to accurate, detailed per-plan lists (jsonb) ─
    `UPDATE plan_pricing SET features = '["Food logging (manual) — unlimited","AI Food Scan (text) — 5 scans/day","Water tracker & reminders","Exercise logging (basic)","7-day health history","Basic daily health score","Community forum access"]'::jsonb WHERE plan_key = 'free'`,

    `UPDATE plan_pricing SET features = '["Everything in Free","AI Food Scanner (photo) — 10/day","Medical Report Scan — 5/day","AI Diet Plan — 5 plans/day","AI Health Coach & Tips — 10/day","AI Meal Swap — 20/day","Full unlimited health history","Blood sugar & BP tracking","Sleep stage analysis","Wearable Sync (Phase 4)","Priority email support"]'::jsonb WHERE plan_key = 'max'`,

    `UPDATE plan_pricing SET features = '["Everything in Max","Advanced AI health predictions","Period cycle tracker","Stress & burnout AI monitoring","Personalized health goals AI","Export data (PDF & CSV)","24/7 priority support"]'::jsonb WHERE plan_key = 'pro'`,

    `UPDATE plan_pricing SET features = '["4 individual member accounts","All Max features per member","Family health dashboard","Elderly health monitoring","Cross-family health comparisons","Family wellness challenges","Single billing for all members"]'::jsonb WHERE plan_key = 'family'`,

    // ── blood group enums (safe create — no-op if already exist) ─────────────────
    `DO $$ BEGIN CREATE TYPE blood_group AS ENUM ('A+','A-','B+','B-','O+','O-','AB+','AB-'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE blood_request_status AS ENUM ('active','fulfilled','cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE donor_response AS ENUM ('will_donate','cannot_donate','contacted','no_response'); EXCEPTION WHEN duplicate_object THEN null; END $$`,

    // ── blood_emergency_requests: core blood emergency table (was missing from migrations) ──
    `CREATE TABLE IF NOT EXISTS blood_emergency_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      patient_name TEXT NOT NULL,
      blood_group_needed TEXT NOT NULL,
      units_needed INTEGER NOT NULL DEFAULT 1,
      hospital_name TEXT NOT NULL,
      hospital_address TEXT,
      hospital_city TEXT NOT NULL,
      hospital_state TEXT NOT NULL,
      hospital_pincode TEXT,
      hospital_phone TEXT,
      doctor_name TEXT,
      doctor_phone TEXT,
      contact_phone TEXT NOT NULL,
      contact_name TEXT,
      urgency TEXT NOT NULL DEFAULT 'urgent',
      status TEXT NOT NULL DEFAULT 'active',
      donors_notified INTEGER NOT NULL DEFAULT 0,
      donors_responded INTEGER NOT NULL DEFAULT 0,
      otp_verified BOOLEAN NOT NULL DEFAULT FALSE,
      flag_count INTEGER NOT NULL DEFAULT 0,
      is_flagged BOOLEAN NOT NULL DEFAULT FALSE,
      notes TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      fulfilled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_blood_emergency_requests_requester ON blood_emergency_requests(requester_id)`,
    `CREATE INDEX IF NOT EXISTS idx_blood_emergency_requests_status ON blood_emergency_requests(status)`,
    `CREATE INDEX IF NOT EXISTS idx_blood_emergency_requests_city ON blood_emergency_requests(hospital_city)`,

    // ── blood_donations: 90-day donor cooldown (moved here — see NOTE above;
    //    must come after blood_emergency_requests, which its request_id FK
    //    references) ────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS blood_donations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      donor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      request_id UUID REFERENCES blood_emergency_requests(id) ON DELETE SET NULL,
      blood_group TEXT NOT NULL,
      units_donated INTEGER NOT NULL DEFAULT 1,
      hospital_name TEXT,
      hospital_city TEXT,
      donated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      donor_inactive_until TIMESTAMPTZ NOT NULL,
      confirmed_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_blood_donations_donor_id ON blood_donations(donor_id)`,

    // ── blood_emergency_responses: donor responses to blood requests ──
    `CREATE TABLE IF NOT EXISTS blood_emergency_responses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id UUID NOT NULL REFERENCES blood_emergency_requests(id) ON DELETE CASCADE,
      donor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      response TEXT NOT NULL,
      contacted BOOLEAN NOT NULL DEFAULT FALSE,
      responded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_blood_emergency_responses_request ON blood_emergency_responses(request_id)`,
    `CREATE INDEX IF NOT EXISTS idx_blood_emergency_responses_donor ON blood_emergency_responses(donor_id)`,

    // ── blood_donors: add otp_verified and verified_at columns (were missing) ──
    `ALTER TABLE blood_donors ADD COLUMN IF NOT EXISTS otp_verified BOOLEAN NOT NULL DEFAULT FALSE`,
    `ALTER TABLE blood_donors ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ`,

    // ── food_logs: extended micronutrient tracking ────────────────────────────
    `ALTER TABLE food_logs ADD COLUMN IF NOT EXISTS sugar_g NUMERIC(6,2)`,
    `ALTER TABLE food_logs ADD COLUMN IF NOT EXISTS sodium_mg NUMERIC(7,2)`,
    `ALTER TABLE food_logs ADD COLUMN IF NOT EXISTS calcium_mg NUMERIC(7,2)`,
    `ALTER TABLE food_logs ADD COLUMN IF NOT EXISTS iron_mg NUMERIC(6,2)`,
    `ALTER TABLE food_logs ADD COLUMN IF NOT EXISTS vitamin_c_mg NUMERIC(6,2)`,
    `ALTER TABLE food_logs ADD COLUMN IF NOT EXISTS vitamin_b12_mcg NUMERIC(6,2)`,
    `ALTER TABLE food_logs ADD COLUMN IF NOT EXISTS vitamin_d_mcg NUMERIC(6,2)`,

    // Fix Aorane IDs: uppercase all existing, then clear any that are still invalid format
    `UPDATE user_profiles SET aorane_id = UPPER(aorane_id) WHERE aorane_id IS NOT NULL AND aorane_id <> UPPER(aorane_id)`,
    `UPDATE user_profiles SET aorane_id = NULL WHERE aorane_id IS NOT NULL AND aorane_id !~ '^[A-Z0-9]{12}$'`,

    // ── ad_campaigns: add slider control columns (may be missing on older production DBs) ──
    `ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS slide_position INTEGER DEFAULT 1`,
    `ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS target_screen TEXT DEFAULT 'dashboard'`,
    `ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS google_ad_code TEXT`,
    `ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS impression_count INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS click_count INTEGER NOT NULL DEFAULT 0`,

    // ── enquiries: add notified_at column if missing ──
    `ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ`,
    // ── enquiries: add admin_notes column for internal tracking ──
    `ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS admin_notes TEXT`,

    // ── plan_pricing: update family plan price to 499, fix type to individual, fix features ──
    `UPDATE plan_pricing SET
       monthly_price = 499,
       yearly_price = 4990,
       type = 'individual',
       badge_text = '4 Members',
       features = '["Everything in Pro","Up to 4 Family Members","Family Health Dashboard","Shared Health Reports","Member Health Alerts","Family Reminders"]'
     WHERE plan_key = 'family'`,

    // ── plan_pricing: fix pro plan features (remove Hindi) ──
    `UPDATE plan_pricing SET
       features = '["Everything in Max","Medical Report AI Scanner","Advanced Gemini AI","Priority Support","Unlimited History","Export PDF & CSV"]'
     WHERE plan_key = 'pro' AND features::text LIKE '%Sab Max%'`,

    // ── organizations: custom pricing columns (admin panel — custom deals) ────
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS custom_price_per_seat NUMERIC(10,2)`,
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS custom_price_note TEXT`,
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS custom_price_valid_until TIMESTAMPTZ`,
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS custom_price_applied_by TEXT`,

    // ── users: custom discount columns (admin panel — custom deals) ──────────
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_discount_pct INTEGER`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_discount_note TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_discount_valid_until TIMESTAMPTZ`,

    // ── promo_codes: toggle active endpoint support ───────────────────────────
    `ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE`,

    // ── food_items: add vitamin_b12_mcg column (was missing — food_logs has it, food_items didn't) ──
    `ALTER TABLE food_items ADD COLUMN IF NOT EXISTS vitamin_b12_mcg NUMERIC(6,2)`,

    // ── plan_pricing: add discount / offer columns (missing from original CREATE TABLE) ──
    `ALTER TABLE plan_pricing ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0`,
    `ALTER TABLE plan_pricing ADD COLUMN IF NOT EXISTS offer_label TEXT`,
    `ALTER TABLE plan_pricing ADD COLUMN IF NOT EXISTS offer_valid_from TIMESTAMPTZ`,
    `ALTER TABLE plan_pricing ADD COLUMN IF NOT EXISTS offer_valid_to TIMESTAMPTZ`,

    // ── plan_pricing: add org plans (starter, growth, enterprise) if missing ──
    `INSERT INTO plan_pricing (plan_key, display_name, type, monthly_price, yearly_price, max_seats, features, badge_color, sort_order)
     VALUES
       ('starter',    'Starter',    'organization', 199, null, 50,   '["All Pro app features for every member","Real-time team health dashboard","Department-wise analytics","Exportable PDF health reports","GST-ready invoicing","Email support"]', '#0077B6', 10),
       ('growth',     'Growth',     'organization', 249, null, 250,  '["Everything in Starter","Advanced analytics & health trends","AI burnout & absenteeism prediction","Business CRM — FREE","Priority support"]', '#10B981', 11),
       ('enterprise', 'Enterprise', 'organization', 0,   null, null, '["Everything in Growth","Dedicated account manager","Custom HRMS / ERP integrations","SLA guarantee","White-label option"]', '#F59E0B', 12)
     ON CONFLICT (plan_key) DO NOTHING`,

    // ── plan_pricing: add org_seat plans (org_max, org_pro) used by Business Portal billing ──
    `INSERT INTO plan_pricing (plan_key, display_name, type, monthly_price, yearly_price, max_seats, features, badge_color, sort_order, is_active)
     VALUES
       ('org_max', 'Max', 'org_seat', 249, 2532, null,
        '["Everything in Pro","Advanced health analytics & charts","Health risk distribution alerts","Weekly & monthly team reports","Priority support","Custom announcements to employees"]',
        '#0077B6', 20, true),
       ('org_pro', 'Pro', 'org_seat', 199, 2028, null,
        '["Basic aggregate health dashboard","Enrollment code management","Employee search","GST-ready invoice","Email support"]',
        '#7C3AED', 21, true)
     ON CONFLICT (plan_key) DO NOTHING`,

    // CRITICAL FIX: the INSERT above originally seeded org_max/org_pro with
    // swapped monthly_price, yearly_price, AND features (org_max=₹199/yr₹2028
    // with basic features, org_pro=₹249/yr₹2532 with advanced features —
    // backwards). Because the INSERT uses ON CONFLICT DO NOTHING, any row
    // already created by the old seed would never self-correct on redeploy.
    // These explicit UPDATEs force-fix rows that were already seeded with
    // the old, wrong values. Safe to run every deploy — becomes a no-op
    // once values are already correct.
    `UPDATE plan_pricing SET monthly_price = '249', yearly_price = '2532',
       features = '["Everything in Pro","Advanced health analytics & charts","Health risk distribution alerts","Weekly & monthly team reports","Priority support","Custom announcements to employees"]'
     WHERE plan_key = 'org_max' AND (monthly_price != '249' OR yearly_price != '2532')`,
    `UPDATE plan_pricing SET monthly_price = '199', yearly_price = '2028',
       features = '["Basic aggregate health dashboard","Enrollment code management","Employee search","GST-ready invoice","Email support"]'
     WHERE plan_key = 'org_pro' AND (monthly_price != '199' OR yearly_price != '2028')`,

    // ── daily_activity_scores: task-based active percentage per day ────────────
    `CREATE TABLE IF NOT EXISTS daily_activity_scores (
      id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      activity_date    DATE        NOT NULL,
      food_score       SMALLINT    NOT NULL DEFAULT 0,
      water_score      SMALLINT    NOT NULL DEFAULT 0,
      exercise_score   SMALLINT    NOT NULL DEFAULT 0,
      medicine_score   SMALLINT,
      stress_score     SMALLINT    NOT NULL DEFAULT 0,
      total_score      SMALLINT    NOT NULL DEFAULT 0,
      max_possible     SMALLINT    NOT NULL DEFAULT 85,
      normalized_pct   SMALLINT    NOT NULL DEFAULT 0,
      app_opened       BOOLEAN     NOT NULL DEFAULT true,
      calculated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, activity_date)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_daily_activity_user_date ON daily_activity_scores(user_id, activity_date DESC)`,

    // ══════════════════════════════════════════════════════════════════════════
    // PLAN FEATURES — granular per-plan limits (20 rows)
    // ══════════════════════════════════════════════════════════════════════════
    `CREATE TABLE IF NOT EXISTS plan_features (
      feature_name  TEXT PRIMARY KEY,
      free_value    TEXT NOT NULL DEFAULT 'false',
      max_value     TEXT NOT NULL DEFAULT 'false',
      pro_value     TEXT NOT NULL DEFAULT 'false',
      family_value  TEXT NOT NULL DEFAULT 'false',
      description   TEXT,
      created_at    TIMESTAMPTZ DEFAULT now(),
      updated_at    TIMESTAMPTZ DEFAULT now()
    )`,

    // period column — daily/weekly/monthly reset cadence for count-based
    // features. Added July 2026 alongside the AI plan-limits overhaul;
    // existing rows default to 'daily' (their previous, only, behavior).
    `ALTER TABLE plan_features ADD COLUMN IF NOT EXISTS period TEXT NOT NULL DEFAULT 'daily'`,

    // Seed / upsert all 21 feature rows
    // NOTE (July 2026 plan-limits overhaul): numbers below are the agreed
    // Free/Pro/Max/Family limits. Max is intentionally >= Pro on every
    // AI feature (Max ₹199 vs Pro ₹249 pricing will be swapped separately
    // in plan_pricing — Max is the higher tier).
    `INSERT INTO plan_features (feature_name, free_value, max_value, pro_value, family_value, description, period) VALUES
      ('ai_food_scan_photo_daily',    '0',     '10',    '5',     '10',    'AI photo food scan per day',             'daily'),
      ('ai_food_scan_text_daily',     '3',     '15',    '10',    '15',    'AI text food analysis per day',          'daily'),
      ('ai_medical_scan_daily',       '0',     '1',     '1',     '1',     'Medical report AI scan per month',       'monthly'),
      ('ai_diet_plan_daily',          '0',     '1',     '1',     '1',     'Weekly AI diet chart',                   'weekly'),
      ('ai_health_coach_daily',       '3',     '20',    '10',    '20',    'AI daily health coach suggestions',      'daily'),
      ('ai_health_prediction_weekly', '0',     '1',     '1',     '1',     'AI health prediction per week',          'weekly'),
      ('ai_meal_swap_daily',          '0',     '20',    '20',    '20',    'AI meal swap suggestions per day',       'daily'),
      ('ai_meal_planner_daily',       '0',     '5',     '5',     '5',     'AI ad-hoc meal/diet plan generation per day', 'daily'),
      ('ai_weather_suggestions_daily','1',     '8',     '4',     '8',     'AI weather-based food suggestions per day (also 6h cached)', 'daily'),
      -- NOTE: 'ai_predictions_enabled' row removed — verified dead, never
      -- read by any route. The real plan-eligibility gate for AI health
      -- predictions is requireFeature("health_prediction") (feature_flags
      -- table), which IS correctly wired in intelligence.ts.
      ('ai_stress_monitoring',        'false', 'true',  'true',  'true',  'Stress & Burnout AI monitoring',         'daily'),
      ('ai_stress_insight_daily',     '0',     '10',    '5',     '10',    'AI-generated personalized stress insight per day', 'daily'),
      ('health_history_days',         '7',     '-1',    '-1',    '-1',    'Health history days, -1 = unlimited',    'daily'),
      ('blood_sugar_bp_tracking',     'false', 'true',  'true',  'true',  'Blood sugar and BP tracking',            'daily'),
      ('sleep_stage_analysis',        'false', 'true',  'true',  'true',  'Sleep stage analysis',                   'daily'),
      ('period_tracker',              'false', 'true',  'true',  'true',  'Period cycle tracker',                   'daily'),
      ('wearable_sync',               'false', 'true',  'true',  'true',  'Wearable sync (Health Connect)',         'daily'),
      ('member_accounts',             '1',     '1',     '1',     '4',     'Number of member accounts',              'daily'),
      ('family_dashboard',            'false', 'false', 'false', 'true',  'Family health dashboard',                'daily'),
      ('elderly_monitoring',          'false', 'false', 'false', 'true',  'Elderly health monitoring',              'daily'),
      ('offline_logging',             'true',  'true',  'true',  'true',  'Offline data logging',                   'daily'),
      ('export_data',                 'false', 'false', 'true',  'true',  'Export data PDF and CSV',                'daily'),
      ('support_level',               'community', 'priority_email', '24x7_priority', 'priority_email', 'Support level', 'daily'),
      ('ads_shown',                   'true',  'false', 'false', 'false', 'Show ads to user',                       'daily')
    ON CONFLICT (feature_name) DO UPDATE SET
      free_value   = EXCLUDED.free_value,
      max_value    = EXCLUDED.max_value,
      pro_value    = EXCLUDED.pro_value,
      family_value = EXCLUDED.family_value,
      description  = EXCLUDED.description,
      period       = EXCLUDED.period,
      updated_at   = now()`,

    // "ai_health_suggestions_daily" is retired — routes/modules/suggestions.ts
    // (the actual "AI Coach"/"Daily Coach" screen) now consumes
    // "ai_health_coach_daily" instead, so this row no longer gates anything
    // and would otherwise sit in the admin panel's AI Limits table as a
    // dead, confusing entry.
    `DELETE FROM plan_features WHERE feature_name = 'ai_health_suggestions_daily'`,

    // ══════════════════════════════════════════════════════════════════════════
    // SUBSCRIPTION_PLANS — canonical plan catalogue (6 plans)
    // ══════════════════════════════════════════════════════════════════════════
    `CREATE TABLE IF NOT EXISTS subscription_plans (
      plan_id       TEXT PRIMARY KEY,
      plan_name     TEXT NOT NULL,
      plan_type     TEXT NOT NULL DEFAULT 'individual',
      price_monthly INTEGER NOT NULL DEFAULT 0,
      price_yearly  INTEGER NOT NULL DEFAULT 0,
      currency      TEXT NOT NULL DEFAULT 'INR',
      is_active     BOOLEAN NOT NULL DEFAULT true,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ DEFAULT now(),
      updated_at    TIMESTAMPTZ DEFAULT now()
    )`,

    `INSERT INTO subscription_plans (plan_id, plan_name, plan_type, price_monthly, price_yearly, currency, is_active, display_order) VALUES
      ('free',        'Free',    'individual', 0,   0,    'INR', true, 1),
      ('max',         'Max',     'individual', 199, 1990, 'INR', true, 2),
      ('pro',         'Pro',     'individual', 249, 2490, 'INR', true, 3),
      ('family',      'Family',  'individual', 499, 4990, 'INR', true, 4),
      ('b2b_starter', 'Starter', 'business',   199, 0,    'INR', true, 5),
      ('b2b_growth',  'Growth',  'business',   249, 0,    'INR', true, 6)
    ON CONFLICT (plan_id) DO UPDATE SET
      plan_name     = EXCLUDED.plan_name,
      price_monthly = EXCLUDED.price_monthly,
      price_yearly  = EXCLUDED.price_yearly,
      is_active     = EXCLUDED.is_active,
      updated_at    = now()`,

    // ══════════════════════════════════════════════════════════════════════════
    // B2B_PLAN_CONFIG — business plan seat rules
    // ══════════════════════════════════════════════════════════════════════════
    `CREATE TABLE IF NOT EXISTS b2b_plan_config (
      plan_id            TEXT PRIMARY KEY,
      min_seats          INTEGER NOT NULL,
      max_seats          INTEGER,
      crm_included       BOOLEAN DEFAULT false,
      crm_monthly_charge INTEGER DEFAULT 0,
      base_features      TEXT,
      created_at         TIMESTAMPTZ DEFAULT now()
    )`,

    `INSERT INTO b2b_plan_config (plan_id, min_seats, max_seats, crm_included, crm_monthly_charge, base_features) VALUES
      ('b2b_starter', 10, 50,  false, 499, 'max'),
      ('b2b_growth',  20, 250, true,  0,   'pro')
    ON CONFLICT (plan_id) DO UPDATE SET
      min_seats          = EXCLUDED.min_seats,
      max_seats          = EXCLUDED.max_seats,
      crm_included       = EXCLUDED.crm_included,
      crm_monthly_charge = EXCLUDED.crm_monthly_charge,
      base_features      = EXCLUDED.base_features`,

    // ══════════════════════════════════════════════════════════════════════════
    // AI_USAGE_DAILY — per-user per-feature daily usage counter + RLS
    // ══════════════════════════════════════════════════════════════════════════
    `CREATE TABLE IF NOT EXISTS ai_usage_daily (
      id           BIGSERIAL PRIMARY KEY,
      user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      feature_name TEXT NOT NULL,
      usage_date   DATE NOT NULL DEFAULT CURRENT_DATE,
      usage_count  INTEGER NOT NULL DEFAULT 1,
      UNIQUE(user_id, feature_name, usage_date)
    )`,

    `CREATE INDEX IF NOT EXISTS idx_ai_usage_daily ON ai_usage_daily(user_id, feature_name, usage_date)`,

    // ══════════════════════════════════════════════════════════════════════════
    // INCREMENT_AI_USAGE — atomic upsert stored procedure
    // ══════════════════════════════════════════════════════════════════════════
    `CREATE OR REPLACE FUNCTION increment_ai_usage(
      p_user_id UUID,
      p_feature  TEXT,
      p_date     DATE
    ) RETURNS void AS $$
    BEGIN
      INSERT INTO ai_usage_daily (user_id, feature_name, usage_date, usage_count)
      VALUES (p_user_id, p_feature, p_date, 1)
      ON CONFLICT (user_id, feature_name, usage_date)
      DO UPDATE SET usage_count = ai_usage_daily.usage_count + 1;
    END;
    $$ LANGUAGE plpgsql`,

    // ══════════════════════════════════════════════════════════════════════════
    // TRY_INCREMENT_AI_USAGE — atomic CHECK-AND-INCREMENT in one round trip.
    //
    // BUG FIXED (AI system production-hardening pass): the old flow in
    // aiLimiter.ts did a SELECT (check usage) followed by a SEPARATE
    // increment_ai_usage() call. Two concurrent requests from the same user
    // (double-tap, two devices, retry-on-timeout) could both read the same
    // "under limit" count before either one's increment landed, letting the
    // user exceed their configured limit by N (N = concurrency). This
    // function does the check AND the increment as a single atomic
    // UPSERT — the row's UNIQUE(user_id, feature_name, usage_date)
    // constraint serializes concurrent callers, and the WHERE guard on the
    // UPDATE ensures the count can never be pushed past p_limit.
    // ══════════════════════════════════════════════════════════════════════════
    `CREATE OR REPLACE FUNCTION try_increment_ai_usage(
      p_user_id UUID,
      p_feature  TEXT,
      p_date     DATE,
      p_limit    INTEGER
    ) RETURNS TABLE(allowed BOOLEAN, usage_count INTEGER) AS $$
    DECLARE
      v_count INTEGER;
    BEGIN
      INSERT INTO ai_usage_daily (user_id, feature_name, usage_date, usage_count)
      VALUES (p_user_id, p_feature, p_date, 1)
      ON CONFLICT (user_id, feature_name, usage_date)
      DO UPDATE SET usage_count = ai_usage_daily.usage_count + 1
        WHERE ai_usage_daily.usage_count < p_limit
      RETURNING ai_usage_daily.usage_count INTO v_count;

      IF v_count IS NULL THEN
        -- Either the row already existed AND was already at/over p_limit
        -- (the WHERE guard skipped the update, so RETURNING produced no
        -- row) — fetch the current count to report back accurately.
        SELECT usage_count INTO v_count FROM ai_usage_daily
          WHERE user_id = p_user_id AND feature_name = p_feature AND usage_date = p_date;
        RETURN QUERY SELECT false, COALESCE(v_count, 0);
      ELSE
        RETURN QUERY SELECT true, v_count;
      END IF;
    END;
    $$ LANGUAGE plpgsql`,

    // ══════════════════════════════════════════════════════════════════════════
    // ORGANIZATIONS — B2B config columns (admin panel FIX 3)
    // ══════════════════════════════════════════════════════════════════════════
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS b2b_plan TEXT DEFAULT 'starter'`,
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS crm_enabled BOOLEAN DEFAULT false`,
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan_status TEXT DEFAULT 'active'`,

    // ══════════════════════════════════════════════════════════════════════════
    // MARKETING ATTRIBUTION — first-party UTM/click-id snapshot on enquiries
    // and organizations, plus the enquiry→organization link. See
    // lib/db/src/schema/platform.ts (AttributionData) for the JSON shape.
    // Additive + nullable, so every existing row keeps working unchanged.
    // ══════════════════════════════════════════════════════════════════════════
    `ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS attribution JSONB`,
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS attribution JSONB`,
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS enquiry_id UUID REFERENCES enquiries(id) ON DELETE SET NULL`,

    // ══════════════════════════════════════════════════════════════════════════
    // Fix: schema.ts declared subscriptions.org_id and subscription_events.org_id
    // (added when the org-billing/enrollment-code work landed) but the generated
    // drizzle migration 0006 never included the ALTER TABLE for either column —
    // a drizzle-kit generation gap, not an intentional change. Every insert into
    // either table fails without these, since Drizzle always references every
    // declared column. Fixed properly via migration 0007; mirrored here as the
    // usual safety net for deploys that only run this legacy path.
    // ══════════════════════════════════════════════════════════════════════════
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE`,
    `ALTER TABLE subscription_events ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE SET NULL`,

    // ══════════════════════════════════════════════════════════════════════════
    // ORG SEAT PLANS — Set yearly prices (₹169/seat/month × 12 = ₹2028, ₹211/seat/month × 12 = ₹2532)
    // Fix: yearly_price is NUMERIC — cannot compare to '' (empty string), only IS NULL
    // ══════════════════════════════════════════════════════════════════════════
    // (old NULL-only yearly_price backfill removed — superseded by the
    // CRITICAL FIX block above, which also had the correct swapped values
    // and runs unconditionally so it can fix already-wrong data too)

    // ══════════════════════════════════════════════════════════════════════════
    // SECURITY FIX C4: organizations.contact_email unique constraint
    // SECURITY FIX C5: org_admins.email unique constraint (also fixes E6 race condition)
    // Dedup first (keep newest row per email) so the unique index can be created
    // even if production already has duplicate emails from before this fix.
    // SECURITY FIX A5: last_logout_at columns for token revocation
    // ══════════════════════════════════════════════════════════════════════════
    `DELETE FROM organizations o
     WHERE o.id IN (
       SELECT id FROM (
         SELECT id, ROW_NUMBER() OVER (PARTITION BY contact_email ORDER BY created_at DESC) AS rn
         FROM organizations WHERE contact_email IS NOT NULL
       ) ranked WHERE rn > 1
     )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_organizations_contact_email ON organizations (contact_email)`,
    `DELETE FROM org_admins a
     WHERE a.id IN (
       SELECT id FROM (
         SELECT id, ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at DESC) AS rn
         FROM org_admins WHERE email IS NOT NULL
       ) ranked WHERE rn > 1
     )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_org_admins_email ON org_admins (email)`,
    // BUG-7: UNIQUE on otp_store.phone prevents multiple OTP entries per phone/email key
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_otp_store_phone ON otp_store (phone)`,
    // OBS-4: UNIQUE on user_auth_providers (user_id, provider) enables ON CONFLICT DO NOTHING upserts
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_user_auth_providers_user_provider ON user_auth_providers (user_id, provider)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_logout_at TIMESTAMPTZ`,
    `ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS last_logout_at TIMESTAMPTZ`,
    `ALTER TABLE org_admins ADD COLUMN IF NOT EXISTS last_logout_at TIMESTAMPTZ`,
    // W3: Email verification columns for org_admins
    `ALTER TABLE org_admins ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN NOT NULL DEFAULT FALSE`,
    `ALTER TABLE org_admins ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ`,

    // ── blood_request_flags: one-flag-per-user enforcement ────────────────────
    `CREATE TABLE IF NOT EXISTS blood_request_flags (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id UUID NOT NULL REFERENCES blood_emergency_requests(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_blood_request_flags_user_request ON blood_request_flags (request_id, user_id)`,

    // ── blood_emergency_requests: hospital GPS + cancel support ───────────────
    `ALTER TABLE blood_emergency_requests ADD COLUMN IF NOT EXISTS hospital_lat TEXT`,
    `ALTER TABLE blood_emergency_requests ADD COLUMN IF NOT EXISTS hospital_lng TEXT`,
    `ALTER TABLE blood_emergency_requests ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ`,

    // ── blood_emergency_requests: columns missing from original Drizzle-created schema ──
    // Drizzle created the table without these columns; startup CREATE TABLE IF NOT EXISTS
    // was a no-op so these were never added. Debug confirmed 6 columns missing on Supabase.
    `ALTER TABLE blood_emergency_requests ADD COLUMN IF NOT EXISTS hospital_address TEXT`,
    `ALTER TABLE blood_emergency_requests ADD COLUMN IF NOT EXISTS hospital_pincode TEXT`,
    `ALTER TABLE blood_emergency_requests ADD COLUMN IF NOT EXISTS hospital_phone TEXT`,
    `ALTER TABLE blood_emergency_requests ADD COLUMN IF NOT EXISTS doctor_name TEXT`,
    `ALTER TABLE blood_emergency_requests ADD COLUMN IF NOT EXISTS doctor_phone TEXT`,
    `ALTER TABLE blood_emergency_requests ADD COLUMN IF NOT EXISTS urgency TEXT NOT NULL DEFAULT 'urgent'`,

    // ── blood_donors: otp_verified + verified_at + donor_inactive_until ───────
    `ALTER TABLE blood_donors ADD COLUMN IF NOT EXISTS otp_verified BOOLEAN NOT NULL DEFAULT FALSE`,
    `ALTER TABLE blood_donors ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ`,
    `ALTER TABLE blood_donors ADD COLUMN IF NOT EXISTS donor_inactive_until TIMESTAMPTZ`,

    // ── daily_health_scores: make the persisted row enough to serve a report ──
    // The health report needs a score for every day of its period. Computing
    // one costs ~17 queries, and the connection pool runs at max 1 against the
    // Supabase pooler, so a 30-day report serialised ~336 queries through a
    // single connection and blew past the client's 15s timeout — weekly (~119)
    // squeaked under it, monthly never did. Serving those days from this table
    // turns the whole range into one SELECT.
    //
    // Four columns the report reads were missing, so a persisted row could not
    // stand in for a computed one:
    `ALTER TABLE daily_health_scores ADD COLUMN IF NOT EXISTS sleep_hours NUMERIC(4,2)`,
    `ALTER TABLE daily_health_scores ADD COLUMN IF NOT EXISTS medicines_taken INTEGER`,
    `ALTER TABLE daily_health_scores ADD COLUMN IF NOT EXISTS medicines_scheduled INTEGER`,
    // total_calories_out already existed but was never written by scoring.ts.

    // Sub-scores were NOT NULL DEFAULT 0, which cannot express "this pillar was
    // never logged". The report distinguishes those cases — a zero reads as
    // "ate badly", a null as "not tracked" — so the columns have to allow null.
    `ALTER TABLE daily_health_scores ALTER COLUMN food_score DROP NOT NULL`,
    `ALTER TABLE daily_health_scores ALTER COLUMN exercise_score DROP NOT NULL`,
    `ALTER TABLE daily_health_scores ALTER COLUMN water_score DROP NOT NULL`,
    `ALTER TABLE daily_health_scores ALTER COLUMN medicine_score DROP NOT NULL`,
    `ALTER TABLE daily_health_scores ALTER COLUMN sleep_score DROP NOT NULL`,

    // Rows written before the change above store 0 where they should store
    // null, so they cannot be trusted for the "not tracked" distinction. This
    // marks which engine wrote a row: 1 = the old shape, 2 = null-aware and
    // carrying the four new columns. Version 1 rows get recomputed on demand.
    `ALTER TABLE daily_health_scores ADD COLUMN IF NOT EXISTS score_version SMALLINT NOT NULL DEFAULT 1`,

    // ── blood_donors: phone column + auto-verify all existing donors (OTP flow removed) ─
    `ALTER TABLE blood_donors ADD COLUMN IF NOT EXISTS phone TEXT`,
    `UPDATE blood_donors SET otp_verified = TRUE WHERE otp_verified = FALSE`,

    // ── admin_notifications: in-app bell notifications for admin panel ────────
    `CREATE TABLE IF NOT EXISTS admin_notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      data JSONB,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_admin_notif_created ON admin_notifications(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_admin_notif_is_read ON admin_notifications(is_read)`,

    // ── sleep_quality enum + sleep_logs table (safety net — Drizzle may not have run) ─
    `DO $$ BEGIN CREATE TYPE sleep_quality AS ENUM ('poor','fair','good','excellent'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `CREATE TABLE IF NOT EXISTS sleep_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sleep_date TEXT NOT NULL,
      bedtime TEXT,
      wake_time TEXT,
      sleep_hours NUMERIC(3,1) NOT NULL,
      quality sleep_quality,
      notes TEXT,
      is_offline_entry BOOLEAN NOT NULL DEFAULT FALSE,
      synced_at TIMESTAMPTZ,
      logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // ── plan_pricing.features one-time content correction ───────────────────
    // Guarded with `@>` (jsonb containment: "does this array still have this
    // old-only marker item") rather than exact array equality — the earlier
    // exact-match version silently missed the "max" row in production
    // (its real stored value differed from what was assumed byte-for-byte,
    // so the `=` comparison never matched and the UPDATE never fired).
    // Containment on one unmistakable old-only string is robust to that:
    // it doesn't care about the rest of the array's exact content/order,
    // and each marker is specific enough to a plan's pre-fix copy that it
    // can never appear in a legitimate future admin-panel edit — so this
    // still can't clobber a manual edit, same guarantee as before.
    `UPDATE plan_pricing SET features = $json$["AI Meal Logging (Text) — 5/day","Exercise Logging","Water Tracker & Reminders","Basic Daily Health Score","Blood Emergency SOS","Period Cycle Tracker (Female)","Manual Logging (Sleep, Stress, Heart Rate, BP, Steps)"]$json$::jsonb
      WHERE plan_key = 'free' AND features @> '["Community forum access"]'::jsonb`,
    `UPDATE plan_pricing SET features = $json$["Meal Logging (Text) — 10/day","AI Food Scan — 5/day","AI Medical Report Analysis — 1/month","AI Health Coach","Health Prediction","AI Diet Planner","Health Reports (Weekly & Monthly)","Smart Watch Integration (Auto Sync)","Stress & Burnout AI Monitoring","All Basic Plan Features"]$json$::jsonb
      WHERE plan_key = 'pro' AND features @> '["Everything in Max"]'::jsonb`,
    `UPDATE plan_pricing SET features = $json$["Everything in Pro","AI Food Scan — 10/day","Meal Logging (Text) — 15/day","AI Medical Report Analysis — Up to 4/month","Advanced Health Prediction","Advanced Health Reports"]$json$::jsonb
      WHERE plan_key = 'max' AND features @> '["Wearable Sync (Phase 4)"]'::jsonb`,
    `UPDATE plan_pricing SET features = $json$["Everything in Max","Up to 4 Members","Shared Health Reports","Member Health Alerts","Family Reminders"]$json$::jsonb
      WHERE plan_key = 'family' AND features @> '["Family Health Dashboard"]'::jsonb`,
    `UPDATE plan_pricing SET features = $json$["Meal Logging (Text) — 10/day","AI Food Scan — 5/day","AI Medical Report Analysis — 1/month","AI Health Coach","Health Prediction","AI Diet Planner","Health Reports (Weekly & Monthly)","Smart Watch Integration (Auto Sync)","Stress & Burnout AI Monitoring","All Basic Plan Features","Free CRM Dashboard Access"]$json$::jsonb
      WHERE plan_key = 'org_pro' AND features @> '["GST-ready invoice"]'::jsonb`,
    `UPDATE plan_pricing SET features = $json$["Everything in Pro","AI Food Scan — 10/day","Meal Logging (Text) — 15/day","AI Medical Report Analysis — Up to 4/month","Advanced Health Prediction","Advanced Health Reports","Free CRM Dashboard Access","Weekly Report Generation"]$json$::jsonb
      WHERE plan_key = 'org_max' AND features @> '["Custom announcements to employees"]'::jsonb`,
  ];

  let ok = 0; let fail = 0;
  for (const sql of migrations) {
    try {
      await pool.query(sql);
      ok++;
    } catch (e) {
      fail++;
      logger.warn({ sql: sql.slice(0, 80), err: (e as Error).message }, "Migration skipped");
    }
  }
  logger.info({ ok, fail, total: migrations.length }, "Startup migrations complete");
}

import { fileURLToPath } from "url";
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runStartupMigrations().then(() => process.exit(0)).catch((e: any) => {
    logger.error({ err: e }, "Migration script failed");
    process.exit(1);
  });
}