CREATE TYPE "public"."join_type" AS ENUM('individual', 'employee');--> statement-breakpoint
CREATE TYPE "public"."department_status" AS ENUM('assigned', 'not_listed', 'declined');--> statement-breakpoint
CREATE TABLE "org_department_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"from_department_id" uuid,
	"to_department_id" uuid,
	"from_status" "department_status" NOT NULL,
	"to_status" "department_status" NOT NULL,
	"changed_by_admin_id" uuid,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_privacy_settings" ADD COLUMN "share_org_aggregate" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "join_type" "join_type" DEFAULT 'individual' NOT NULL;--> statement-breakpoint
ALTER TABLE "org_members" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "org_members" ADD COLUMN "department_status" "department_status" DEFAULT 'not_listed' NOT NULL;--> statement-breakpoint
ALTER TABLE "org_department_changes" ADD CONSTRAINT "org_department_changes_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_department_changes" ADD CONSTRAINT "org_department_changes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_department_changes" ADD CONSTRAINT "org_department_changes_from_department_id_org_departments_id_fk" FOREIGN KEY ("from_department_id") REFERENCES "public"."org_departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_department_changes" ADD CONSTRAINT "org_department_changes_to_department_id_org_departments_id_fk" FOREIGN KEY ("to_department_id") REFERENCES "public"."org_departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_department_changes" ADD CONSTRAINT "org_department_changes_changed_by_admin_id_org_admins_id_fk" FOREIGN KEY ("changed_by_admin_id") REFERENCES "public"."org_admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_departments" ADD CONSTRAINT "org_departments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_org_department_changes_org_changed_at" ON "org_department_changes" USING btree ("org_id","changed_at");--> statement-breakpoint
CREATE INDEX "idx_org_departments_org_id" ON "org_departments" USING btree ("org_id");--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_department_id_org_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."org_departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_org_members_org_department" ON "org_members" USING btree ("org_id","department_id");--> statement-breakpoint

-- Case-insensitive uniqueness of department names within one organization.
-- Hand-written because it is an expression index, which the Drizzle schema
-- cannot express and `drizzle-kit generate` therefore never emits.
--
-- This is the constraint that makes the whole "dropdown, never free text"
-- decision actually hold. A plain UNIQUE(org_id, name) accepts "Sales",
-- "sales" and "SALES" as three separate departments, which is precisely the
-- typo-fragmentation the dropdown exists to prevent - it would just move the
-- fragmentation from the employees to the admin creating the list.
--
-- Note it deliberately covers inactive departments too: a soft-deleted "Sales"
-- still owns that name, so re-creating it produces a clean conflict the API
-- can turn into "reactivate the existing one" rather than a silent duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_org_departments_org_id_lower_name"
  ON "org_departments" ("org_id", lower("name"));
