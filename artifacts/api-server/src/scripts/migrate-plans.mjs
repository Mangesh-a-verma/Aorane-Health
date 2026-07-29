/**
 * Migration: Fix pricing and plans database structure
 * Run: node src/scripts/migrate-plans.mjs
 */
import pg from "pg";

const { Pool } = pg;

const DATABASE_URL = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("SUPABASE_DATABASE_URL not set");

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
  connectionTimeoutMillis: 15000,
});

async function run() {
  const client = await pool.connect();
  try {
    console.log("Connected to Supabase. Running migrations...\n");

    // ── Step 1: plan_features ─────────────────────────────────────────────────
    console.log("Step 1: Recreating plan_features table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS plan_features (
        feature_name    TEXT PRIMARY KEY,
        free_value      TEXT NOT NULL DEFAULT 'false',
        max_value       TEXT NOT NULL DEFAULT 'false',
        pro_value       TEXT NOT NULL DEFAULT 'false',
        family_value    TEXT NOT NULL DEFAULT 'false',
        description     TEXT,
        created_at      TIMESTAMPTZ DEFAULT now(),
        updated_at      TIMESTAMPTZ DEFAULT now()
      )
    `);
    await client.query(`DELETE FROM plan_features`);
    await client.query(`
      INSERT INTO plan_features
        (feature_name, free_value, max_value, pro_value, family_value, description)
      VALUES
        ('ai_food_scan_photo_daily',  '0',              '10',             '10',             '10',             'AI photo food scan per day'),
        ('ai_food_scan_text_daily',   '5',              '10',             '10',             '10',             'AI text food scan per day'),
        ('ai_medical_scan_daily',     '0',              '5',              '5',              '5',              'Medical report AI scan per day'),
        ('ai_diet_plan_daily',        '0',              '5',              '5',              '5',              'AI diet plan generations per day'),
        ('ai_health_coach_daily',     '0',              '10',             '10',             '10',             'AI health coach messages per day'),
        ('ai_meal_swap_daily',        '0',              '20',             '20',             '20',             'AI meal swap suggestions per day'),
        ('ai_predictions_enabled',    'false',          'false',          'true',           'true',           'Advanced AI health predictions'),
        ('ai_stress_monitoring',      'false',          'false',          'true',           'true',           'Stress & Burnout AI monitoring'),
        ('health_history_days',       '7',              '-1',             '-1',             '-1',             'Health history days, -1 = unlimited'),
        ('blood_sugar_bp_tracking',   'false',          'true',           'true',           'true',           'Blood sugar and BP tracking'),
        ('sleep_stage_analysis',      'false',          'true',           'true',           'true',           'Sleep stage analysis'),
        ('period_tracker',            'false',          'true',           'true',           'true',           'Period cycle tracker'),
        ('wearable_sync',             'false',          'phase4',         'phase4',         'phase4',         'Wearable sync - Phase 4'),
        ('member_accounts',           '1',              '1',              '1',              '4',              'Number of member accounts'),
        ('family_dashboard',          'false',          'false',          'false',          'true',           'Family health dashboard'),
        ('elderly_monitoring',        'false',          'false',          'false',          'true',           'Elderly health monitoring'),
        ('offline_logging',           'true',           'true',           'true',           'true',           'Offline data logging'),
        ('export_data',               'false',          'false',          'true',           'true',           'Export data PDF and CSV'),
        ('support_level',             'community',      'priority_email', '24x7_priority',  'priority_email', 'Support level'),
        ('ads_shown',                 'true',           'false',          'false',          'false',          'Show ads to user')
    `);
    const { rows: pfRows } = await client.query(`SELECT COUNT(*) FROM plan_features`);
    console.log(`  ✓ plan_features: ${pfRows[0].count} rows inserted\n`);

    // ── Step 2: subscription_plans ────────────────────────────────────────────
    console.log("Step 2: Recreating subscription_plans table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscription_plans (
        plan_id        TEXT PRIMARY KEY,
        plan_name      TEXT NOT NULL,
        plan_type      TEXT NOT NULL DEFAULT 'individual',
        price_monthly  INTEGER NOT NULL DEFAULT 0,
        price_yearly   INTEGER NOT NULL DEFAULT 0,
        currency       TEXT NOT NULL DEFAULT 'INR',
        is_active      BOOLEAN NOT NULL DEFAULT true,
        display_order  INTEGER NOT NULL DEFAULT 0,
        created_at     TIMESTAMPTZ DEFAULT now(),
        updated_at     TIMESTAMPTZ DEFAULT now()
      )
    `);
    await client.query(`DELETE FROM subscription_plans`);
    await client.query(`
      INSERT INTO subscription_plans
        (plan_id, plan_name, plan_type, price_monthly, price_yearly, currency, is_active, display_order)
      VALUES
        ('free',        'Free',     'individual', 0,   0,    'INR', true, 1),
        ('max',         'Max',      'individual', 199, 1990, 'INR', true, 2),
        ('pro',         'Pro',      'individual', 249, 2490, 'INR', true, 3),
        ('family',      'Family',   'individual', 499, 4990, 'INR', true, 4),
        ('b2b_starter', 'Starter',  'business',   199, 0,    'INR', true, 5),
        ('b2b_growth',  'Growth',   'business',   249, 0,    'INR', true, 6)
    `);
    const { rows: spRows } = await client.query(`SELECT COUNT(*) FROM subscription_plans`);
    console.log(`  ✓ subscription_plans: ${spRows[0].count} rows inserted\n`);

    // ── Step 3: b2b_plan_config ───────────────────────────────────────────────
    console.log("Step 3: Creating b2b_plan_config table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS b2b_plan_config (
        plan_id             TEXT PRIMARY KEY,
        min_seats           INTEGER NOT NULL,
        max_seats           INTEGER,
        crm_included        BOOLEAN DEFAULT false,
        crm_monthly_charge  INTEGER DEFAULT 0,
        base_features       TEXT,
        created_at          TIMESTAMPTZ DEFAULT now()
      )
    `);
    await client.query(`
      INSERT INTO b2b_plan_config (plan_id, min_seats, max_seats, crm_included, crm_monthly_charge, base_features)
      VALUES
        ('b2b_starter', 10, 50,  false, 499, 'max'),
        ('b2b_growth',  20, 250, true,  0,   'pro')
      ON CONFLICT (plan_id) DO UPDATE SET
        min_seats          = EXCLUDED.min_seats,
        max_seats          = EXCLUDED.max_seats,
        crm_included       = EXCLUDED.crm_included,
        crm_monthly_charge = EXCLUDED.crm_monthly_charge,
        base_features      = EXCLUDED.base_features
    `);
    const { rows: b2bRows } = await client.query(`SELECT COUNT(*) FROM b2b_plan_config`);
    console.log(`  ✓ b2b_plan_config: ${b2bRows[0].count} rows\n`);

    // ── Step 4: ai_usage_daily ────────────────────────────────────────────────
    console.log("Step 4: Creating ai_usage_daily table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_usage_daily (
        id            BIGSERIAL PRIMARY KEY,
        user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
        feature_name  TEXT NOT NULL,
        usage_date    DATE DEFAULT CURRENT_DATE,
        usage_count   INTEGER DEFAULT 1,
        UNIQUE(user_id, feature_name, usage_date)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_usage_daily
        ON ai_usage_daily(user_id, feature_name, usage_date)
    `);
    await client.query(`ALTER TABLE ai_usage_daily ENABLE ROW LEVEL SECURITY`);
    // Create policy (drop if exists first to avoid conflict)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE tablename = 'ai_usage_daily' AND policyname = 'own_ai_usage'
        ) THEN
          EXECUTE 'CREATE POLICY own_ai_usage ON ai_usage_daily FOR ALL USING (auth.uid() = user_id)';
        END IF;
      END $$
    `);
    console.log(`  ✓ ai_usage_daily: table + index + RLS created\n`);

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ ALL 4 STEPS COMPLETED SUCCESSFULLY");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // ── Verify final state ────────────────────────────────────────────────────
    console.log("Final verification:");
    const { rows: verifyPf } = await client.query(`SELECT feature_name, free_value, max_value, pro_value, family_value FROM plan_features ORDER BY feature_name`);
    console.log("\n📋 plan_features:");
    verifyPf.forEach(r => console.log(`  ${r.feature_name.padEnd(30)} FREE=${r.free_value.padEnd(10)} MAX=${r.max_value.padEnd(10)} PRO=${r.pro_value.padEnd(15)} FAMILY=${r.family_value}`));

    const { rows: verifySp } = await client.query(`SELECT plan_id, plan_name, plan_type, price_monthly, price_yearly FROM subscription_plans ORDER BY display_order`);
    console.log("\n📋 subscription_plans:");
    verifySp.forEach(r => console.log(`  ${r.plan_id.padEnd(15)} ${r.plan_name.padEnd(10)} ${r.plan_type.padEnd(12)} ₹${r.price_monthly}/mo  ₹${r.price_yearly}/yr`));

    const { rows: verifyB2b } = await client.query(`SELECT plan_id, min_seats, max_seats, crm_included FROM b2b_plan_config`);
    console.log("\n📋 b2b_plan_config:");
    verifyB2b.forEach(r => console.log(`  ${r.plan_id.padEnd(15)} seats:${r.min_seats}-${r.max_seats}  crm:${r.crm_included}`));

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error("❌ Migration failed:", err.message);
  process.exit(1);
});
