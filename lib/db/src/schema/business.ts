import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
  pgEnum,
  decimal,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { enquiriesTable, type AttributionData } from "./platform";

export const orgTypeEnum = pgEnum("org_type", [
  "corporate",
  "hospital",
  "gym",
  "insurance",
  "ngo",
  "yoga",
  "school",
  "other",
]);

export const orgPlanEnum = pgEnum("org_plan", ["basic", "pro", "max"]);
export const orgRoleEnum = pgEnum("org_role", ["owner", "admin", "manager", "viewer"]);

export const organizationsTable = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  orgType: orgTypeEnum("org_type").notNull(),
  plan: orgPlanEnum("plan").notNull().default("basic"),
  orgCode: text("org_code").notNull().unique(),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  city: text("city"),
  state: text("state"),
  countryCode: text("country_code").notNull().default("IN"),
  gstin: text("gstin"),
  industry: text("industry"),
  companySize: text("company_size"),
  hospitalType: text("hospital_type"),
  bedCount: integer("bed_count"),
  nabhAccredited: boolean("nabh_accredited").notNull().default(false),
  gymType: text("gym_type"),
  memberCount: integer("member_count"),
  irdaiLicense: text("irdai_license"),
  customerBaseSize: text("customer_base_size"),
  totalSeats: integer("total_seats").notNull().default(10),
  usedSeats: integer("used_seats").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  isVerified: boolean("is_verified").notNull().default(false),
  discountPct: integer("discount_pct").notNull().default(0),
  customPricePerSeat: decimal("custom_price_per_seat", { precision: 10, scale: 2 }),
  customPriceNote: text("custom_price_note"),
  customPriceValidUntil: timestamp("custom_price_valid_until", { withTimezone: true }),
  customPriceAppliedBy: text("custom_price_applied_by"),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  // ── Columns that existed in production before they existed here ──────────
  // These three were added by artifacts/api-server/src/lib/migrate.ts (the
  // legacy hardening script) via ALTER TABLE, so every real database has had
  // them for months while this schema - the intended source of truth - did
  // not. Declared here so Drizzle can actually read/write them and so the
  // next generated migration reflects reality instead of silently proposing
  // to drop them. Nullable with defaults, matching the live columns exactly.
  //
  // b2bPlan / crmEnabled gate the Business CRM: see b2b_plan_config, where
  // b2b_starter has crm_included = false (CRM is a paid add-on) and
  // b2b_growth has it bundled. planStatus is the org-level lifecycle flag
  // (active | ...) that the admin panel already writes - see
  // routes/modules/admin.ts.
  b2bPlan: text("b2b_plan").default("starter"),
  crmEnabled: boolean("crm_enabled").default(false),
  planStatus: text("plan_status").default("active"),
  // Links back to the enquiry (demo request / "talk to expert") that led to
  // this organization being created, when one exists. Nullable — plenty of
  // orgs self-register directly from the pricing page with no prior enquiry.
  // ON DELETE SET NULL: losing the source enquiry should never take the
  // paying organization down with it.
  enquiryId: uuid("enquiry_id").references(() => enquiriesTable.id, { onDelete: "set null" }),
  // Same first-touch/last-touch acquisition snapshot as enquiries.attribution
  // — captured client-side at registration if the enquiry linkage above
  // isn't present (self-serve signups skip the enquiry step entirely).
  attribution: jsonb("attribution").$type<AttributionData>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const orgAdminsTable = pgTable("org_admins", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: orgRoleEnum("role").notNull().default("admin"),
  isActive: boolean("is_active").notNull().default(true),
  isEmailVerified: boolean("is_email_verified").notNull().default(false),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  phoneOtpVerified: boolean("phone_otp_verified").notNull().default(false),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const orgMembersTable = pgTable("org_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"),
  enrolledViaCode: text("enrolled_via_code"),
  isActive: boolean("is_active").notNull().default(true),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

export const enrollmentCodesTable = pgTable("enrollment_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  planType: text("plan_type").notNull().default("basic"),
  totalSeats: integer("total_seats").notNull().default(10),
  usedSeats: integer("used_seats").notNull().default(0),
  validityDays: integer("validity_days").notNull().default(365),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insuranceApiKeysTable = pgTable("insurance_api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  keyHash: text("key_hash").notNull().unique(),
  keyPrefix: text("key_prefix").notNull(),
  label: text("label"),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orgPaymentsTable = pgTable("org_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  plan: text("plan").notNull(),
  seats: integer("seats").notNull().default(50),
  amount: text("amount").notNull(),
  currency: text("currency").notNull().default("INR"),
  razorpayOrderId: text("razorpay_order_id"),
  razorpayPaymentId: text("razorpay_payment_id"),
  razorpaySubscriptionId: text("razorpay_subscription_id"),
  paymentType: text("payment_type").notNull().default("one_time"),
  billingCycle: text("billing_cycle").notNull().default("monthly"),
  autoRenew: boolean("auto_renew").notNull().default(false),
  nextRenewalAt: timestamp("next_renewal_at", { withTimezone: true }),
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  seatPrice: integer("seat_price"),
  baseAmount: integer("base_amount"),
  gstAmount: integer("gst_amount"),
  cgstAmount: integer("cgst_amount"),
  sgstAmount: integer("sgst_amount"),
  igstAmount: integer("igst_amount"),
  orgGstin: text("org_gstin"),
  orgState: text("org_state"),
  invoiceNumber: text("invoice_number"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orgAnnouncementsTable = pgTable("org_announcements", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  type: text("type").notNull().default("announcement"),
  sentCount: integer("sent_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOrganizationSchema = createInsertSchema(organizationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOrgAdminSchema = createInsertSchema(orgAdminsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type Organization = typeof organizationsTable.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type OrgAdmin = typeof orgAdminsTable.$inferSelect;
export type OrgMember = typeof orgMembersTable.$inferSelect;
export type EnrollmentCode = typeof enrollmentCodesTable.$inferSelect;
export type OrgPayment = typeof orgPaymentsTable.$inferSelect;
export type OrgAnnouncement = typeof orgAnnouncementsTable.$inferSelect;
