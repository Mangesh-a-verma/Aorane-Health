CREATE TYPE "public"."sugar_reading_context" AS ENUM('fasting', 'post_meal', 'random', 'bedtime');--> statement-breakpoint
CREATE TABLE "blood_pressure_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"systolic" integer NOT NULL,
	"diastolic" integer NOT NULL,
	"pulse" integer,
	"measured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"is_offline_entry" boolean DEFAULT false NOT NULL,
	"synced_at" timestamp with time zone,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blood_sugar_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"glucose_mg_dl" integer NOT NULL,
	"reading_context" "sugar_reading_context",
	"measured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"is_offline_entry" boolean DEFAULT false NOT NULL,
	"synced_at" timestamp with time zone,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blood_pressure_logs" ADD CONSTRAINT "blood_pressure_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blood_sugar_logs" ADD CONSTRAINT "blood_sugar_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_blood_pressure_logs_user_measured_at" ON "blood_pressure_logs" USING btree ("user_id","measured_at");--> statement-breakpoint
CREATE INDEX "idx_blood_sugar_logs_user_measured_at" ON "blood_sugar_logs" USING btree ("user_id","measured_at");