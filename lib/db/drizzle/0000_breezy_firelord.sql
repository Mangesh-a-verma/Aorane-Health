CREATE TYPE "public"."activity_level" AS ENUM('sedentary', 'light', 'moderate', 'very', 'athlete');--> statement-breakpoint
CREATE TYPE "public"."auth_provider" AS ENUM('mobile', 'google', 'facebook', 'x');--> statement-breakpoint
CREATE TYPE "public"."food_preference" AS ENUM('veg', 'nonveg', 'eggetarian', 'vegan', 'jain');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('male', 'female', 'other', 'prefer_not_to_say');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('free', 'max', 'pro', 'family');--> statement-breakpoint
CREATE TYPE "public"."input_method" AS ENUM('photo', 'text', 'voice', 'wearable', 'manual');--> statement-breakpoint
CREATE TYPE "public"."meal_type" AS ENUM('breakfast', 'lunch', 'dinner', 'snack', 'other');--> statement-breakpoint
CREATE TYPE "public"."exercise_intensity" AS ENUM('light', 'moderate', 'intense');--> statement-breakpoint
CREATE TYPE "public"."medicine_frequency" AS ENUM('daily', 'alternate', 'weekly', 'custom');--> statement-breakpoint
CREATE TYPE "public"."medicine_meal_timing" AS ENUM('before_meal', 'after_meal', 'with_meal', 'anytime', 'empty_stomach', 'bedtime');--> statement-breakpoint
CREATE TYPE "public"."mood" AS ENUM('happy', 'neutral', 'stressed', 'sad');--> statement-breakpoint
CREATE TYPE "public"."sleep_quality" AS ENUM('poor', 'fair', 'good', 'excellent');--> statement-breakpoint
CREATE TYPE "public"."stress_type" AS ENUM('ppg', 'mood', 'five_pillar');--> statement-breakpoint
CREATE TYPE "public"."accident_emergency_status" AS ENUM('triggered', 'locating', 'notified', 'responded', 'cancelled', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."blood_group" AS ENUM('A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-');--> statement-breakpoint
CREATE TYPE "public"."blood_request_status" AS ENUM('active', 'fulfilled', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."donor_response" AS ENUM('can_help', 'later', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."org_plan" AS ENUM('basic', 'pro', 'max');--> statement-breakpoint
CREATE TYPE "public"."org_role" AS ENUM('owner', 'admin', 'manager', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."org_type" AS ENUM('corporate', 'hospital', 'gym', 'insurance', 'ngo', 'yoga', 'school', 'other');--> statement-breakpoint
CREATE TYPE "public"."ad_status" AS ENUM('active', 'paused', 'expired', 'pending');--> statement-breakpoint
CREATE TYPE "public"."ad_type" AS ENUM('google', 'direct');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('medicine_reminder', 'water_reminder', 'blood_emergency', 'broadcast', 'announcement', 'report_ready', 'system');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'success', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'expired', 'cancelled', 'pending');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_message_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_message_type" AS ENUM('food_log', 'exercise_log', 'water_log', 'medicine_reminder', 'meal_reminder', 'exercise_reminder', 'weekly_report', 'health_tip', 'inbound_food', 'inbound_exercise', 'inbound_query');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_subscription_status" AS ENUM('active', 'paused', 'opted_out');--> statement-breakpoint
CREATE TABLE "otp_store" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"hashed_otp" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "otp_store_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "user_auth_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "auth_provider" NOT NULL,
	"provider_user_id" text NOT NULL,
	"email" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_health_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"primary_goal" text NOT NULL,
	"current_weight_kg" numeric(5, 2),
	"target_weight_kg" numeric(5, 2),
	"target_date" text,
	"secondary_goals" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_medical_conditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"condition" text NOT NULL,
	"condition_type" text,
	"diagnosed_at" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"language_code" text DEFAULT 'hi' NOT NULL,
	"dark_mode" boolean DEFAULT false NOT NULL,
	"water_goal_glasses" integer DEFAULT 8 NOT NULL,
	"calorie_goal" integer,
	"notifications_enabled" boolean DEFAULT true NOT NULL,
	"medicine_reminders" boolean DEFAULT true NOT NULL,
	"water_reminders" boolean DEFAULT true NOT NULL,
	"food_reminders" boolean DEFAULT true NOT NULL,
	"period_reminders" boolean DEFAULT true NOT NULL,
	"suggestion_notifications" boolean DEFAULT true NOT NULL,
	"water_reminder_times" text DEFAULT '09:00,13:00,18:00,21:00' NOT NULL,
	"food_reminder_time" text DEFAULT '07:30,12:30,19:30' NOT NULL,
	"medicine_reminder_time" text DEFAULT '08:00,14:00,21:00' NOT NULL,
	"wake_up_time" text DEFAULT '07:00' NOT NULL,
	"bed_time" text DEFAULT '22:30' NOT NULL,
	"weekly_report_email" boolean DEFAULT false NOT NULL,
	"app_lock_enabled" boolean DEFAULT false NOT NULL,
	"app_lock_method" text,
	"pin_hash" text,
	"session_timeout_minutes" integer DEFAULT 5 NOT NULL,
	"ads_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_privacy_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"share_basic_profile" boolean DEFAULT true NOT NULL,
	"share_bmi" boolean DEFAULT true NOT NULL,
	"share_exercise_data" boolean DEFAULT true NOT NULL,
	"share_water_intake" boolean DEFAULT true NOT NULL,
	"share_sleep_data" boolean DEFAULT false NOT NULL,
	"share_stress_level" boolean DEFAULT false NOT NULL,
	"share_medicine_details" boolean DEFAULT false NOT NULL,
	"share_medical_conditions" boolean DEFAULT false NOT NULL,
	"share_food_data" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_privacy_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"aorane_id" text,
	"full_name" text,
	"date_of_birth" text,
	"gender" "gender",
	"profile_photo_url" text,
	"city" text,
	"state" text,
	"height_cm" numeric(5, 2),
	"weight_kg" numeric(5, 2),
	"bmi" numeric(5, 2),
	"blood_group" text,
	"food_preference" "food_preference",
	"food_allergies" text[],
	"work_profile" text,
	"activity_level" "activity_level",
	"exercise_frequency" text,
	"exercise_types" text[],
	"sleep_hours_avg" numeric(3, 1),
	"current_health_streak" integer DEFAULT 0 NOT NULL,
	"longest_health_streak" integer DEFAULT 0 NOT NULL,
	"rolling_7_day_score" integer,
	"rolling_30_day_score" integer,
	"biological_age" integer,
	"ai_health_predictions" jsonb,
	"wake_time" text,
	"sleep_time" text,
	"stress_level_self" text,
	"profile_completed_at" timestamp with time zone,
	"onboarding_step" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "user_profiles_aorane_id_unique" UNIQUE("aorane_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text,
	"email" text,
	"plan" "plan" DEFAULT 'free' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_banned" boolean DEFAULT false NOT NULL,
	"custom_discount_pct" integer,
	"custom_discount_note" text,
	"custom_discount_valid_until" timestamp with time zone,
	"country_code" text DEFAULT 'IN' NOT NULL,
	"language_code" text DEFAULT 'hi' NOT NULL,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"currency_code" text DEFAULT 'INR' NOT NULL,
	"referral_code" text,
	"referred_by" uuid,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "food_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"food_name_en" text NOT NULL,
	"food_name_local" jsonb,
	"category" text,
	"subcategory" text,
	"cuisine_type" text,
	"country_code" text DEFAULT 'IN' NOT NULL,
	"region_code" text,
	"is_global" boolean DEFAULT false NOT NULL,
	"dietary_tags" text[],
	"calories" numeric(7, 2) NOT NULL,
	"protein_g" numeric(6, 2),
	"carbs_g" numeric(6, 2),
	"fat_g" numeric(6, 2),
	"fiber_g" numeric(6, 2),
	"sugar_g" numeric(6, 2),
	"sodium_mg" numeric(7, 2),
	"potassium_mg" numeric(7, 2),
	"calcium_mg" numeric(7, 2),
	"iron_mg" numeric(6, 2),
	"vitamin_c_mg" numeric(6, 2),
	"vitamin_b12_mcg" numeric(6, 2),
	"vitamin_d_mcg" numeric(6, 2),
	"serving_size_g" numeric(6, 2),
	"serving_description" text,
	"barcode" text,
	"tags" text[],
	"is_verified" boolean DEFAULT false NOT NULL,
	"added_by_admin" boolean DEFAULT false NOT NULL,
	"ai_generated" boolean DEFAULT false NOT NULL,
	"ai_source_cache_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "food_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"food_item_id" uuid,
	"food_name_en" text NOT NULL,
	"meal_type" "meal_type" NOT NULL,
	"input_method" "input_method" DEFAULT 'text' NOT NULL,
	"quantity_g" numeric(7, 2),
	"quantity_description" text,
	"calories" numeric(7, 2) NOT NULL,
	"protein_g" numeric(6, 2),
	"carbs_g" numeric(6, 2),
	"fat_g" numeric(6, 2),
	"fiber_g" numeric(6, 2),
	"sugar_g" numeric(6, 2),
	"sodium_mg" numeric(7, 2),
	"calcium_mg" numeric(7, 2),
	"iron_mg" numeric(6, 2),
	"vitamin_c_mg" numeric(6, 2),
	"vitamin_b12_mcg" numeric(6, 2),
	"vitamin_d_mcg" numeric(6, 2),
	"photo_url" text,
	"ai_confidence" numeric(5, 2),
	"is_offline_entry" boolean DEFAULT false NOT NULL,
	"synced_at" timestamp with time zone,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "food_scan_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"food_name_en" text NOT NULL,
	"name_normalized" text,
	"ai_result" jsonb NOT NULL,
	"food_item_id" uuid,
	"hit_count" integer DEFAULT 1 NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_promoted" boolean DEFAULT false NOT NULL,
	"is_rejected" boolean DEFAULT false NOT NULL,
	"source_ai" text,
	"reviewed_at" timestamp with time zone,
	"promoted_food_item_id" uuid,
	CONSTRAINT "food_scan_cache_food_name_en_unique" UNIQUE("food_name_en")
);
--> statement-breakpoint
CREATE TABLE "daily_health_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"score_date" text NOT NULL,
	"health_score" integer DEFAULT 0 NOT NULL,
	"data_confidence_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"food_score" integer DEFAULT 0 NOT NULL,
	"exercise_score" integer DEFAULT 0 NOT NULL,
	"water_score" integer DEFAULT 0 NOT NULL,
	"medicine_score" integer DEFAULT 0 NOT NULL,
	"sleep_score" integer DEFAULT 0 NOT NULL,
	"stress_score" integer,
	"total_calories_in" numeric(8, 2),
	"total_calories_out" numeric(8, 2),
	"water_glasses" integer DEFAULT 0 NOT NULL,
	"exercise_minutes" integer DEFAULT 0 NOT NULL,
	"medicine_adherence_pct" numeric(5, 2),
	"fields_logged" integer DEFAULT 0 NOT NULL,
	"total_possible_fields" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" text NOT NULL,
	"suggestions_json" jsonb NOT NULL,
	"calorie_goal_used" integer,
	"is_ai_generated" boolean DEFAULT true NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercise_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"exercise_type" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"intensity" "exercise_intensity" DEFAULT 'moderate' NOT NULL,
	"sets" integer,
	"reps" integer,
	"steps" integer,
	"calories_burned" numeric(7, 2),
	"met_value" numeric(4, 2),
	"input_method" "input_method" DEFAULT 'manual' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"photo_url" text,
	"notes" text,
	"is_offline_entry" boolean DEFAULT false NOT NULL,
	"synced_at" timestamp with time zone,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"month" text NOT NULL,
	"week_start" text,
	"prediction_json" jsonb NOT NULL,
	"data_snapshot_json" jsonb,
	"weather_context" text,
	"was_forced" boolean DEFAULT false,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medical_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"report_type" text NOT NULL,
	"report_date" text,
	"lab_name" text,
	"patient_name" text,
	"findings" jsonb NOT NULL,
	"critical_values" jsonb,
	"ai_advice" text,
	"diet_recommendations" text[],
	"urgency_level" text,
	"follow_up_required" boolean DEFAULT false NOT NULL,
	"page_count" integer DEFAULT 1 NOT NULL,
	"analyzed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medicine_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"schedule_id" uuid NOT NULL,
	"status" text NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"taken_at" timestamp with time zone,
	"is_offline_entry" boolean DEFAULT false NOT NULL,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medicine_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"medicine_name" text NOT NULL,
	"dosage" text,
	"dose_count" integer DEFAULT 1 NOT NULL,
	"meal_timing" "medicine_meal_timing" DEFAULT 'anytime' NOT NULL,
	"frequency" "medicine_frequency" DEFAULT 'daily' NOT NULL,
	"custom_days" text[],
	"reminder_times" text[] NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"refill_alert_days" integer DEFAULT 7 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "period_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text,
	"cycle_length" integer,
	"symptoms" text[],
	"flow" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sleep_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"sleep_date" text NOT NULL,
	"bedtime" text,
	"wake_time" text,
	"sleep_hours" numeric(3, 1) NOT NULL,
	"quality" "sleep_quality",
	"notes" text,
	"is_offline_entry" boolean DEFAULT false NOT NULL,
	"synced_at" timestamp with time zone,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stress_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stress_type" "stress_type" NOT NULL,
	"stress_score" integer NOT NULL,
	"mood" "mood",
	"heart_rate_avg" integer,
	"hrv_score" numeric(5, 2),
	"sleep_hours" numeric(3, 1),
	"food_quality_score" integer,
	"exercise_minutes" integer,
	"water_glasses" integer,
	"medicine_adherence" numeric(5, 2),
	"pillars" jsonb,
	"ai_insight" text,
	"is_offline_entry" boolean DEFAULT false NOT NULL,
	"synced_at" timestamp with time zone,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "water_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"glasses_count" integer DEFAULT 1 NOT NULL,
	"ml_amount" integer DEFAULT 250 NOT NULL,
	"drink_type" text DEFAULT 'water' NOT NULL,
	"is_offline_entry" boolean DEFAULT false NOT NULL,
	"synced_at" timestamp with time zone,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_diet_charts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"week_start" text NOT NULL,
	"diet_chart_json" jsonb NOT NULL,
	"target_calories" integer,
	"was_forced" boolean DEFAULT false,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accident_emergency_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"lat" text NOT NULL,
	"lng" text NOT NULL,
	"accuracy_meters" text,
	"address" text,
	"status" "accident_emergency_status" DEFAULT 'triggered' NOT NULL,
	"hospitals_notified" integer DEFAULT 0 NOT NULL,
	"police_notified" boolean DEFAULT false NOT NULL,
	"nearby_hospitals_json" text,
	"responded_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"emergency_contacts_notified" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blood_donations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"donor_id" uuid NOT NULL,
	"request_id" uuid,
	"blood_group" "blood_group" NOT NULL,
	"units_donated" integer DEFAULT 1 NOT NULL,
	"hospital_name" text,
	"hospital_city" text,
	"donated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"donor_inactive_until" timestamp with time zone NOT NULL,
	"confirmed_by_admin" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blood_donors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blood_group" "blood_group" NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"country_code" text DEFAULT 'IN' NOT NULL,
	"lat" text,
	"lng" text,
	"phone" text,
	"is_available" boolean DEFAULT true NOT NULL,
	"last_donated_at" text,
	"next_eligible_at" text,
	"donation_count" integer DEFAULT 0 NOT NULL,
	"badges" text[],
	"verified_at" timestamp with time zone,
	"otp_verified" boolean DEFAULT false NOT NULL,
	"donor_inactive_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blood_donors_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "blood_emergency_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" uuid NOT NULL,
	"patient_name" text NOT NULL,
	"blood_group_needed" "blood_group" NOT NULL,
	"units_needed" integer DEFAULT 1 NOT NULL,
	"hospital_name" text NOT NULL,
	"hospital_address" text,
	"hospital_city" text NOT NULL,
	"hospital_state" text NOT NULL,
	"hospital_pincode" text,
	"hospital_phone" text,
	"doctor_name" text,
	"doctor_phone" text,
	"contact_phone" text NOT NULL,
	"contact_name" text,
	"urgency" text DEFAULT 'urgent' NOT NULL,
	"status" "blood_request_status" DEFAULT 'active' NOT NULL,
	"donors_notified" integer DEFAULT 0 NOT NULL,
	"donors_responded" integer DEFAULT 0 NOT NULL,
	"otp_verified" boolean DEFAULT false NOT NULL,
	"flag_count" integer DEFAULT 0 NOT NULL,
	"is_flagged" boolean DEFAULT false NOT NULL,
	"notes" text,
	"hospital_lat" text,
	"hospital_lng" text,
	"expires_at" timestamp with time zone NOT NULL,
	"fulfilled_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blood_emergency_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"donor_id" uuid NOT NULL,
	"response" "donor_response" NOT NULL,
	"contacted" boolean DEFAULT false NOT NULL,
	"responded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blood_request_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emergency_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"relation" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"notify_on_accident" boolean DEFAULT true NOT NULL,
	"notify_on_blood_emergency" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"invite_code" text NOT NULL,
	"max_members" integer DEFAULT 4 NOT NULL,
	"plan_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "family_groups_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "family_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"relation" text DEFAULT 'other' NOT NULL,
	"is_minor" boolean DEFAULT false NOT NULL,
	"health_share_permission" text DEFAULT 'basic' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollment_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"code" text NOT NULL,
	"plan_type" text DEFAULT 'basic' NOT NULL,
	"total_seats" integer DEFAULT 10 NOT NULL,
	"used_seats" integer DEFAULT 0 NOT NULL,
	"validity_days" integer DEFAULT 365 NOT NULL,
	"expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrollment_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "insurance_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"label" text,
	"last_used_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "insurance_api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "org_admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "org_role" DEFAULT 'admin' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_email_verified" boolean DEFAULT false NOT NULL,
	"email_verified_at" timestamp with time zone,
	"phone_otp_verified" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "org_announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"type" text DEFAULT 'announcement' NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"enrolled_via_code" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"plan" text NOT NULL,
	"seats" integer DEFAULT 50 NOT NULL,
	"amount" text NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"razorpay_order_id" text,
	"razorpay_payment_id" text,
	"razorpay_subscription_id" text,
	"payment_type" text DEFAULT 'one_time' NOT NULL,
	"billing_cycle" text,
	"auto_renew" boolean DEFAULT false NOT NULL,
	"next_renewal_at" timestamp with time zone,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone,
	"seat_price" text,
	"base_amount" text,
	"gst_amount" text,
	"cgst_amount" text,
	"sgst_amount" text,
	"igst_amount" text,
	"org_gstin" text,
	"org_state" text,
	"invoice_number" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"org_type" "org_type" NOT NULL,
	"plan" "org_plan" DEFAULT 'basic' NOT NULL,
	"org_code" text NOT NULL,
	"contact_email" text NOT NULL,
	"contact_phone" text,
	"city" text,
	"state" text,
	"country_code" text DEFAULT 'IN' NOT NULL,
	"gstin" text,
	"industry" text,
	"company_size" text,
	"hospital_type" text,
	"bed_count" integer,
	"nabh_accredited" boolean DEFAULT false NOT NULL,
	"gym_type" text,
	"member_count" integer,
	"irdai_license" text,
	"customer_base_size" text,
	"total_seats" integer DEFAULT 10 NOT NULL,
	"used_seats" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"discount_pct" integer DEFAULT 0 NOT NULL,
	"custom_price_per_seat" numeric(10, 2),
	"custom_price_note" text,
	"custom_price_valid_until" timestamp with time zone,
	"custom_price_applied_by" text,
	"trial_ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_org_code_unique" UNIQUE("org_code")
);
--> statement-breakpoint
CREATE TABLE "ad_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ad_type" "ad_type" NOT NULL,
	"title" text NOT NULL,
	"advertiser_name" text,
	"banner_url" text,
	"link_url" text,
	"target_plans" text[],
	"target_cities" text[],
	"target_age_min" integer,
	"target_age_max" integer,
	"status" "ad_status" DEFAULT 'active' NOT NULL,
	"priority" integer DEFAULT 1 NOT NULL,
	"deal_amount" numeric(10, 2),
	"impression_count" integer DEFAULT 0 NOT NULL,
	"click_count" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"slide_position" integer DEFAULT 1,
	"target_screen" text DEFAULT 'dashboard',
	"google_ad_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ad_clicks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ad_impressions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"user_id" uuid,
	"user_plan" text,
	"platform" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"details" jsonb,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" text NOT NULL,
	"role" text DEFAULT 'admin' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "ai_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feature" text NOT NULL,
	"label" text NOT NULL,
	"provider" text DEFAULT 'gemini' NOT NULL,
	"model" text DEFAULT 'gemini-2.0-flash' NOT NULL,
	"api_key" text,
	"system_prompt" text,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_config_feature_unique" UNIQUE("feature")
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"image_url" text,
	"link_url" text,
	"target_plans" text[],
	"is_active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"device_type" text DEFAULT 'mobile',
	"device_model" text,
	"app_version" text,
	"platform" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"duration_seconds" integer,
	"screen_count" integer DEFAULT 0,
	CONSTRAINT "app_sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "company_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"company_name" text DEFAULT 'AORANE Health' NOT NULL,
	"company_logo_url" text,
	"tagline" text DEFAULT 'Your Health, In Your Hands',
	"website" text DEFAULT 'aorane.com',
	"support_phone" text,
	"support_email" text,
	"address" text,
	"primary_color" text DEFAULT '#0077B6',
	"accent_color" text DEFAULT '#00B896',
	"scorecard_show_qr" boolean DEFAULT true,
	"scorecard_show_blood_group" boolean DEFAULT true,
	"scorecard_show_bmi" boolean DEFAULT true,
	"scorecard_show_active_percent" boolean DEFAULT true,
	"scorecard_bg_gradient_from" text DEFAULT '#023E8A',
	"scorecard_bg_gradient_to" text DEFAULT '#1B998B',
	"gstin" text,
	"cin" text,
	"pan" text,
	"city" text,
	"state" text,
	"pincode" text,
	"country" text DEFAULT 'India',
	"registered_address" text,
	"report_header_text" text,
	"report_footer_text" text,
	"report_logo_url" text,
	"weekly_report_enabled" boolean DEFAULT true,
	"monthly_report_enabled" boolean DEFAULT true,
	"social_twitter" text,
	"social_linkedin" text,
	"social_instagram" text,
	"social_youtube" text,
	"social_facebook" text,
	"investor_deck_url" text,
	"android_play_store_url" text DEFAULT 'https://play.google.com/store/apps/details?id=in.aorane.app',
	"ios_app_store_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"mobile" text,
	"city" text,
	"account_type" text,
	"company_name" text,
	"message" text,
	"source" text,
	"status" text DEFAULT 'new' NOT NULL,
	"admin_notes" text,
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"enabled_for_plans" text[],
	"config" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feature_flags_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"data" jsonb,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"platform" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"org_id" uuid,
	"subscription_id" uuid,
	"razorpay_order_id" text,
	"razorpay_payment_id" text,
	"razorpay_subscription_id" text,
	"amount" numeric(10, 2) NOT NULL,
	"base_amount" numeric(10, 2),
	"gst_amount" numeric(10, 2),
	"invoice_number" text,
	"currency" text DEFAULT 'INR' NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"plan" text NOT NULL,
	"seats" integer DEFAULT 1 NOT NULL,
	"gateway_fee" numeric(8, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_pricing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_key" text NOT NULL,
	"display_name" text NOT NULL,
	"type" text DEFAULT 'individual' NOT NULL,
	"monthly_price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"yearly_price" numeric(10, 2),
	"max_seats" integer,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"badge_text" text,
	"badge_color" text DEFAULT '#0077B6',
	"gradient_colors" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"discount_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"offer_label" text,
	"offer_valid_from" timestamp with time zone,
	"offer_valid_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_pricing_plan_key_unique" UNIQUE("plan_key")
);
--> statement-breakpoint
CREATE TABLE "promo_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"discount_pct" integer NOT NULL,
	"discount_type" text DEFAULT 'percent' NOT NULL,
	"applicable_plans" text[],
	"usage_limit" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"is_lifetime_upgrade" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promo_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrer_id" uuid NOT NULL,
	"referred_id" uuid NOT NULL,
	"reward_status" text DEFAULT 'pending' NOT NULL,
	"reward_amount" numeric(8, 2),
	"rewarded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"org_id" uuid,
	"plan" text NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"source" text DEFAULT 'razorpay' NOT NULL,
	"seats" integer DEFAULT 1 NOT NULL,
	"amount_paid" numeric(10, 2),
	"discount_pct" integer DEFAULT 0 NOT NULL,
	"promo_code_used" text,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"razorpay_subscription_id" text,
	"payment_type" text DEFAULT 'one_time' NOT NULL,
	"auto_renew" boolean DEFAULT false NOT NULL,
	"next_renewal_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "languages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name_en" text NOT NULL,
	"name_local" text NOT NULL,
	"direction" text DEFAULT 'ltr' NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"completion_pct" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "languages_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "offline_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"action_type" text NOT NULL,
	"payload" text NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"synced_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"language_code" text NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wearable_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp with time zone,
	"scopes" text[],
	"is_active" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wearable_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"steps" integer,
	"heart_rate_avg" integer,
	"heart_rate_min" integer,
	"heart_rate_max" integer,
	"calories_burned" numeric(7, 2),
	"sleep_hours" numeric(3, 1),
	"blood_oxygen" numeric(5, 2),
	"active_minutes" integer,
	"distance_km" numeric(6, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_bot_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"provider" text DEFAULT 'aisensy' NOT NULL,
	"business_phone_number" text,
	"wa_ba_id" text,
	"webhook_verify_token" text,
	"api_key_encrypted" text,
	"meal_reminder_enabled" boolean DEFAULT true NOT NULL,
	"medicine_reminder_enabled" boolean DEFAULT true NOT NULL,
	"exercise_reminder_enabled" boolean DEFAULT true NOT NULL,
	"weekly_report_enabled" boolean DEFAULT true NOT NULL,
	"breakfast_reminder_time" text DEFAULT '08:00' NOT NULL,
	"lunch_reminder_time" text DEFAULT '13:00' NOT NULL,
	"dinner_reminder_time" text DEFAULT '20:00' NOT NULL,
	"medicine_reminder_times" text DEFAULT '08:00,14:00,21:00' NOT NULL,
	"weekly_report_day" text DEFAULT 'sunday' NOT NULL,
	"weekly_report_time" text DEFAULT '09:00' NOT NULL,
	"max_messages_per_user_per_day" integer DEFAULT 5 NOT NULL,
	"templates" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_message_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"wa_phone_number" text NOT NULL,
	"message_type" "whatsapp_message_type" NOT NULL,
	"direction" "whatsapp_message_direction" NOT NULL,
	"message_body" text,
	"wa_message_id" text,
	"parsed_data" jsonb,
	"ai_processed" boolean DEFAULT false NOT NULL,
	"data_logged" boolean DEFAULT false NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"wa_phone_number" text NOT NULL,
	"status" "whatsapp_subscription_status" DEFAULT 'active' NOT NULL,
	"meal_reminders_on" boolean DEFAULT true NOT NULL,
	"medicine_reminders_on" boolean DEFAULT true NOT NULL,
	"exercise_reminders_on" boolean DEFAULT true NOT NULL,
	"weekly_report_on" boolean DEFAULT true NOT NULL,
	"preferred_language" text DEFAULT 'hi' NOT NULL,
	"custom_breakfast_time" text,
	"custom_lunch_time" text,
	"custom_dinner_time" text,
	"last_message_at" timestamp,
	"total_messages_received" integer DEFAULT 0 NOT NULL,
	"total_messages_sent" integer DEFAULT 0 NOT NULL,
	"subscribed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_name" text NOT NULL,
	"template_type" "whatsapp_message_type" NOT NULL,
	"wa_template_name" text,
	"body_text" text NOT NULL,
	"body_text_hindi" text,
	"is_approved" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"language" text DEFAULT 'hi' NOT NULL,
	"variables" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_templates_template_name_unique" UNIQUE("template_name")
);
--> statement-breakpoint
ALTER TABLE "user_auth_providers" ADD CONSTRAINT "user_auth_providers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_health_goals" ADD CONSTRAINT "user_health_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_medical_conditions" ADD CONSTRAINT "user_medical_conditions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_privacy_settings" ADD CONSTRAINT "user_privacy_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_logs" ADD CONSTRAINT "food_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_logs" ADD CONSTRAINT "food_logs_food_item_id_food_items_id_fk" FOREIGN KEY ("food_item_id") REFERENCES "public"."food_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_scan_cache" ADD CONSTRAINT "food_scan_cache_food_item_id_food_items_id_fk" FOREIGN KEY ("food_item_id") REFERENCES "public"."food_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_scan_cache" ADD CONSTRAINT "food_scan_cache_promoted_food_item_id_food_items_id_fk" FOREIGN KEY ("promoted_food_item_id") REFERENCES "public"."food_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_health_scores" ADD CONSTRAINT "daily_health_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_suggestions" ADD CONSTRAINT "daily_suggestions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_logs" ADD CONSTRAINT "exercise_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_predictions" ADD CONSTRAINT "health_predictions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_reports" ADD CONSTRAINT "medical_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medicine_logs" ADD CONSTRAINT "medicine_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medicine_logs" ADD CONSTRAINT "medicine_logs_schedule_id_medicine_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."medicine_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medicine_schedules" ADD CONSTRAINT "medicine_schedules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_logs" ADD CONSTRAINT "period_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sleep_logs" ADD CONSTRAINT "sleep_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stress_logs" ADD CONSTRAINT "stress_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "water_logs" ADD CONSTRAINT "water_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_diet_charts" ADD CONSTRAINT "weekly_diet_charts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accident_emergency_logs" ADD CONSTRAINT "accident_emergency_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blood_donations" ADD CONSTRAINT "blood_donations_donor_id_users_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blood_donations" ADD CONSTRAINT "blood_donations_request_id_blood_emergency_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."blood_emergency_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blood_donors" ADD CONSTRAINT "blood_donors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blood_emergency_requests" ADD CONSTRAINT "blood_emergency_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blood_emergency_responses" ADD CONSTRAINT "blood_emergency_responses_request_id_blood_emergency_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."blood_emergency_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blood_emergency_responses" ADD CONSTRAINT "blood_emergency_responses_donor_id_users_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blood_request_flags" ADD CONSTRAINT "blood_request_flags_request_id_blood_emergency_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."blood_emergency_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blood_request_flags" ADD CONSTRAINT "blood_request_flags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_groups" ADD CONSTRAINT "family_groups_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_group_id_family_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."family_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_codes" ADD CONSTRAINT "enrollment_codes_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurance_api_keys" ADD CONSTRAINT "insurance_api_keys_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_admins" ADD CONSTRAINT "org_admins_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_announcements" ADD CONSTRAINT "org_announcements_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_payments" ADD CONSTRAINT "org_payments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_clicks" ADD CONSTRAINT "ad_clicks_campaign_id_ad_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."ad_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_clicks" ADD CONSTRAINT "ad_clicks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_impressions" ADD CONSTRAINT "ad_impressions_campaign_id_ad_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."ad_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_impressions" ADD CONSTRAINT "ad_impressions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_admin_id_admin_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_sessions" ADD CONSTRAINT "app_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_users_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_id_users_id_fk" FOREIGN KEY ("referred_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offline_queue" ADD CONSTRAINT "offline_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wearable_connections" ADD CONSTRAINT "wearable_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wearable_data" ADD CONSTRAINT "wearable_data_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_message_logs" ADD CONSTRAINT "whatsapp_message_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_subscriptions" ADD CONSTRAINT "whatsapp_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "health_predictions_user_month_uniq" ON "health_predictions" USING btree ("user_id","month");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_diet_charts_user_week_uniq" ON "weekly_diet_charts" USING btree ("user_id","week_start");