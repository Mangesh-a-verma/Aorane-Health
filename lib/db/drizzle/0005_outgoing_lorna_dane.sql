ALTER TABLE "organizations" ADD COLUMN "enquiry_id" uuid;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "attribution" jsonb;--> statement-breakpoint
ALTER TABLE "enquiries" ADD COLUMN "attribution" jsonb;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_enquiry_id_enquiries_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiries"("id") ON DELETE set null ON UPDATE no action;