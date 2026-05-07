import { pool } from "@workspace/db";
import { logger } from "./logger";
import { buildNewFoodSeedSQL } from "./seed-new-foods";

// Safe startup migration — adds any missing columns using IF NOT EXISTS
// Run once at server startup; safe to re-run multiple times
export async function runStartupMigrations(): Promise<void> {
  const migrations: string[] = [
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

    // ── push_tokens ──────────────────────────────────────
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

    // Seed default admin user (password: admin123) — ON CONFLICT DO NOTHING preserves user-changed passwords
    `INSERT INTO admin_users (email, password_hash, full_name, role, is_active)
     VALUES ('admin@aorane.com', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'AORANE Admin', 'superadmin', TRUE)
     ON CONFLICT (email) DO NOTHING`,

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
    `INSERT INTO ai_config (feature, label, provider, model, is_enabled) VALUES
      ('food_scan',    'Food Scan AI',       'nvidia', 'meta/llama-3.1-70b-instruct', true),
      ('health_coach', 'Health Coach AI',    'nvidia', 'meta/llama-3.1-70b-instruct', true),
      ('report_scan',  'Medical Report AI',  'nvidia', 'meta/llama-3.1-70b-instruct', true),
      ('stress_ai',    'Stress Analysis AI', 'nvidia', 'meta/llama-3.1-70b-instruct', true)
     ON CONFLICT (feature) DO NOTHING`,

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

    // ── blood_donations: 90-day donor cooldown ─────────────────────────────────
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

    // ── blood_donors: add donor_inactive_until for 90-day cooldown enforcement ──
    `ALTER TABLE blood_donors ADD COLUMN IF NOT EXISTS donor_inactive_until TIMESTAMPTZ`,

    // ── plan_pricing: update Free/Max/Pro prices to correct values ──
    `UPDATE plan_pricing SET monthly_price='0', yearly_price=NULL, sort_order=0 WHERE plan_key='free'`,
    `UPDATE plan_pricing SET monthly_price='199', yearly_price='1990', badge_text='Popular', sort_order=1 WHERE plan_key='max'`,
    `UPDATE plan_pricing SET monthly_price='249', yearly_price='2490', badge_text='Best Value', sort_order=2 WHERE plan_key='pro'`,

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

    // ── push_tokens: Expo push notification tokens per user ───────────────────
    `CREATE TABLE IF NOT EXISTS push_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      token TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT 'unknown',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, token)
    )`,
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
       ('org_max', 'Max', 'org_seat', 199, null, null,
        '["Basic aggregate health dashboard","Enrollment code management","Employee search","GST-ready invoice","Email support"]',
        '#0077B6', 20, true),
       ('org_pro', 'Pro', 'org_seat', 249, null, null,
        '["Everything in Max","Advanced health analytics & charts","Health risk distribution alerts","Weekly & monthly team reports","Priority support","Custom announcements to employees"]',
        '#7C3AED', 21, true)
     ON CONFLICT (plan_key) DO NOTHING`,

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

    // Seed / upsert all 20 feature rows
    `INSERT INTO plan_features (feature_name, free_value, max_value, pro_value, family_value, description) VALUES
      ('ai_food_scan_photo_daily', '0',         '10',             '10',            '10',             'AI photo food scan per day'),
      ('ai_food_scan_text_daily',  '5',         '10',             '10',            '10',             'AI text food scan per day'),
      ('ai_medical_scan_daily',    '0',         '5',              '5',             '5',              'Medical report AI scan per day'),
      ('ai_diet_plan_daily',       '0',         '5',              '5',             '5',              'AI diet plan generations per day'),
      ('ai_health_coach_daily',    '0',         '10',             '10',            '10',             'AI health coach messages per day'),
      ('ai_meal_swap_daily',       '0',         '20',             '20',            '20',             'AI meal swap suggestions per day'),
      ('ai_predictions_enabled',   'false',     'false',          'true',          'true',           'Advanced AI health predictions'),
      ('ai_stress_monitoring',     'false',     'false',          'true',          'true',           'Stress & Burnout AI monitoring'),
      ('health_history_days',      '7',         '-1',             '-1',            '-1',             'Health history days, -1 = unlimited'),
      ('blood_sugar_bp_tracking',  'false',     'true',           'true',          'true',           'Blood sugar and BP tracking'),
      ('sleep_stage_analysis',     'false',     'true',           'true',          'true',           'Sleep stage analysis'),
      ('period_tracker',           'false',     'true',           'true',          'true',           'Period cycle tracker'),
      ('wearable_sync',            'false',     'phase4',         'phase4',        'phase4',         'Wearable sync - Phase 4'),
      ('member_accounts',          '1',         '1',              '1',             '4',              'Number of member accounts'),
      ('family_dashboard',         'false',     'false',          'false',         'true',           'Family health dashboard'),
      ('elderly_monitoring',       'false',     'false',          'false',         'true',           'Elderly health monitoring'),
      ('offline_logging',          'true',      'true',           'true',          'true',           'Offline data logging'),
      ('export_data',              'false',     'false',          'true',          'true',           'Export data PDF and CSV'),
      ('support_level',            'community', 'priority_email', '24x7_priority', 'priority_email', 'Support level'),
      ('ads_shown',                'true',      'false',          'false',         'false',          'Show ads to user')
    ON CONFLICT (feature_name) DO UPDATE SET
      free_value   = EXCLUDED.free_value,
      max_value    = EXCLUDED.max_value,
      pro_value    = EXCLUDED.pro_value,
      family_value = EXCLUDED.family_value,
      description  = EXCLUDED.description,
      updated_at   = now()`,

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
    // ORGANIZATIONS — B2B config columns (admin panel FIX 3)
    // ══════════════════════════════════════════════════════════════════════════
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS b2b_plan TEXT DEFAULT 'starter'`,
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS crm_enabled BOOLEAN DEFAULT false`,
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan_status TEXT DEFAULT 'active'`,

    // ══════════════════════════════════════════════════════════════════════════
    // ORG SEAT PLANS — Set yearly prices (₹169/seat/month × 12 = ₹2028, ₹211/seat/month × 12 = ₹2532)
    // ══════════════════════════════════════════════════════════════════════════
    `UPDATE plan_pricing SET yearly_price = '2028' WHERE plan_key = 'org_max' AND (yearly_price IS NULL OR yearly_price = '')`,
    `UPDATE plan_pricing SET yearly_price = '2532' WHERE plan_key = 'org_pro' AND (yearly_price IS NULL OR yearly_price = '')`,

    // ══════════════════════════════════════════════════════════════════════════
    // SECURITY FIX C4: organizations.contact_email unique constraint
    // SECURITY FIX C5: org_admins.email unique constraint (also fixes E6 race condition)
    // SECURITY FIX A5: last_logout_at columns for token revocation
    // ══════════════════════════════════════════════════════════════════════════
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_organizations_contact_email ON organizations (contact_email)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_org_admins_email ON org_admins (email)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_logout_at TIMESTAMPTZ`,
    `ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS last_logout_at TIMESTAMPTZ`,
    `ALTER TABLE org_admins ADD COLUMN IF NOT EXISTS last_logout_at TIMESTAMPTZ`,
    // W3: Email verification columns for org_admins
    `ALTER TABLE org_admins ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN NOT NULL DEFAULT FALSE`,
    `ALTER TABLE org_admins ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ`,
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
