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
  index,
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

// How a member's department was arrived at. The distinction matters because
// the two non-assigned cases need opposite treatment:
//   assigned    - picked from the org's own department list
//   not_listed  - "my department isn't on the list". A DATA-QUALITY signal:
//                 the admin should see these and extend the list, and the
//                 member can be reassigned once it exists.
//   declined    - "prefer not to say". A PRIVACY choice, so an admin must NOT
//                 be able to reassign it - that would defeat the opt-out.
// Collapsing these into one "unassigned" bucket would lose the first signal
// and silently override the second.
export const departmentStatusEnum = pgEnum("department_status", ["assigned", "not_listed", "declined"]);

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
  // Department lives on the membership, not on the user: it is org-scoped, and
  // a user who leaves one org and joins another should not carry the old org's
  // department with them. ON DELETE SET NULL so removing a department leaves
  // its members without one rather than deleting the memberships.
  departmentId: uuid("department_id").references(() => orgDepartmentsTable.id, { onDelete: "set null" }),
  // Defaults to not_listed rather than assigned: every member who existed
  // before departments did genuinely has no department yet, and that is a
  // prompt for the admin to extend the list, not a privacy choice.
  departmentStatus: departmentStatusEnum("department_status").notNull().default("not_listed"),
  isActive: boolean("is_active").notNull().default(true),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // The department aggregate query groups active members of one org by
  // department; no existing index covers that access path.
  orgDepartmentIdx: index("idx_org_members_org_department").on(t.orgId, t.departmentId),
}));

// Admin-managed list of departments for one organization. Employee onboarding
// offers exactly this list as a dropdown - never free text - so that analytics
// cannot fragment across "Sales", "sales" and "Sale". The case-insensitive
// unique index below is what actually enforces that; a plain UNIQUE(org_id,
// name) would happily accept "Sales" and "sales" as two departments.
//
// EXTENSION POINT: departments are self-declared today because there is no
// HRMS/SSO integration to verify them against. If one is added later, this is
// the table an automatic sync would write to, and org_members.department_status
// is where a "verified by HRMS" state would go alongside the existing three.
export const orgDepartmentsTable = pgTable("org_departments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  orgIdx: index("idx_org_departments_org_id").on(t.orgId),
}));

// Every department reassignment an org admin performs, kept as an append-only
// trail. Two reasons, and the second is the load-bearing one:
//   1. A self-declared department that an admin can silently rewrite needs a
//      record of who rewrote it.
//   2. Department aggregates are vulnerable to a differencing attack - move
//      one member between two departments and compare the averages before and
//      after, and you have recovered that individual's score. Knowing exactly
//      when a department's membership changed is what lets the aggregate layer
//      freeze or suppress around it.
export const orgDepartmentChangesTable = pgTable("org_department_changes", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  // Nullable on both sides: a move can start from or end at "no department".
  // ON DELETE SET NULL so deleting a department never erases the history of
  // members having been in it.
  fromDepartmentId: uuid("from_department_id").references(() => orgDepartmentsTable.id, { onDelete: "set null" }),
  toDepartmentId: uuid("to_department_id").references(() => orgDepartmentsTable.id, { onDelete: "set null" }),
  fromStatus: departmentStatusEnum("from_status").notNull(),
  toStatus: departmentStatusEnum("to_status").notNull(),
  // Null when the change came from the member themselves during onboarding
  // rather than from an admin acting on them.
  changedByAdminId: uuid("changed_by_admin_id").references(() => orgAdminsTable.id, { onDelete: "set null" }),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgChangedAtIdx: index("idx_org_department_changes_org_changed_at").on(t.orgId, t.changedAt),
}));

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
export type OrgDepartment = typeof orgDepartmentsTable.$inferSelect;
export type OrgDepartmentChange = typeof orgDepartmentChangesTable.$inferSelect;
