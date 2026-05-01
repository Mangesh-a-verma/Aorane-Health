import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const bloodGroupEnum = pgEnum("blood_group", ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]);
export const bloodRequestStatusEnum = pgEnum("blood_request_status", ["active", "fulfilled", "expired", "cancelled"]);
export const donorResponseEnum = pgEnum("donor_response", ["can_help", "later", "unavailable"]);

export const familyGroupsTable = pgTable("family_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  inviteCode: text("invite_code").notNull().unique(),
  maxMembers: integer("max_members").notNull().default(4),
  planId: text("plan_id"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const familyMembersTable = pgTable("family_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id").notNull().references(() => familyGroupsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"),
  relation: text("relation").notNull().default("other"),
  isMinor: boolean("is_minor").notNull().default(false),
  healthSharePermission: text("health_share_permission").notNull().default("basic"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bloodDonorsTable = pgTable("blood_donors", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  bloodGroup: bloodGroupEnum("blood_group").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  countryCode: text("country_code").notNull().default("IN"),
  lat: text("lat"),
  lng: text("lng"),
  isAvailable: boolean("is_available").notNull().default(true),
  lastDonatedAt: text("last_donated_at"),
  nextEligibleAt: text("next_eligible_at"),
  donationCount: integer("donation_count").notNull().default(0),
  badges: text("badges").array(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  otpVerified: boolean("otp_verified").notNull().default(false),
  donorInactiveUntil: timestamp("donor_inactive_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const bloodEmergencyRequestsTable = pgTable("blood_emergency_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  requesterId: uuid("requester_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  patientName: text("patient_name").notNull(),
  bloodGroupNeeded: bloodGroupEnum("blood_group_needed").notNull(),
  unitsNeeded: integer("units_needed").notNull().default(1),

  // ── Hospital info (compulsory for donor safety) ─────────────────────────────
  hospitalName: text("hospital_name").notNull(),
  hospitalAddress: text("hospital_address"),           // full address for donors
  hospitalCity: text("hospital_city").notNull(),
  hospitalState: text("hospital_state").notNull(),
  hospitalPincode: text("hospital_pincode"),
  hospitalPhone: text("hospital_phone"),               // hospital's official number

  // ── Doctor info (optional — strongly encouraged for donor safety) ───────────
  doctorName: text("doctor_name"),
  doctorPhone: text("doctor_phone"),

  // ── Contact person (requester / family member) ──────────────────────────────
  contactPhone: text("contact_phone").notNull(),
  contactName: text("contact_name"),

  // ── Request meta ────────────────────────────────────────────────────────────
  urgency: text("urgency").notNull().default("urgent"),  // critical | urgent | routine
  status: bloodRequestStatusEnum("status").notNull().default("active"),
  donorsNotified: integer("donors_notified").notNull().default(0),
  donorsResponded: integer("donors_responded").notNull().default(0),
  otpVerified: boolean("otp_verified").notNull().default(false),
  flagCount: integer("flag_count").notNull().default(0),
  isFlagged: boolean("is_flagged").notNull().default(false),
  notes: text("notes"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const bloodEmergencyResponsesTable = pgTable("blood_emergency_responses", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id").notNull().references(() => bloodEmergencyRequestsTable.id, { onDelete: "cascade" }),
  donorId: uuid("donor_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  response: donorResponseEnum("response").notNull(),
  contacted: boolean("contacted").notNull().default(false),
  respondedAt: timestamp("responded_at", { withTimezone: true }).notNull().defaultNow(),
});

// ════════════════════════════════════════════════════════════════════════════
// ACCIDENT EMERGENCY — Structure ready, full implementation pending
// Requires: Hospital API partnerships + Police emergency API approvals
// Plan: 2-3 taps → GPS sent to nearest hospital + police → auto-call
// ════════════════════════════════════════════════════════════════════════════

export const accidentEmergencyStatusEnum = pgEnum("accident_emergency_status", [
  "triggered",   // User pressed SOS
  "locating",    // GPS being captured
  "notified",    // Hospitals/police notified
  "responded",   // Help confirmed coming
  "cancelled",   // User cancelled
  "resolved",    // Emergency resolved
]);

export const accidentEmergencyLogsTable = pgTable("accident_emergency_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),

  // GPS at time of emergency
  lat: text("lat").notNull(),
  lng: text("lng").notNull(),
  accuracyMeters: text("accuracy_meters"),
  address: text("address"),              // reverse-geocoded address

  // Status
  status: accidentEmergencyStatusEnum("status").notNull().default("triggered"),

  // Who was notified (future: linked to hospital/police APIs)
  hospitalsNotified: integer("hospitals_notified").notNull().default(0),
  policeNotified: boolean("police_notified").notNull().default(false),
  nearbyHospitalsJson: text("nearby_hospitals_json"),  // JSON of nearest hospitals sent
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancelReason: text("cancel_reason"),

  // Emergency contacts notified (from user's profile)
  emergencyContactsNotified: integer("emergency_contacts_notified").notNull().default(0),

  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Pre-configured emergency contacts (user sets these in profile)
export const emergencyContactsTable = pgTable("emergency_contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  relation: text("relation"),            // e.g. "Wife", "Son", "Friend"
  isPrimary: boolean("is_primary").notNull().default(false),
  notifyOnAccident: boolean("notify_on_accident").notNull().default(true),
  notifyOnBloodEmergency: boolean("notify_on_blood_emergency").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBloodDonorSchema = createInsertSchema(bloodDonorsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBloodEmergencyRequestSchema = createInsertSchema(bloodEmergencyRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });

// ─── Blood Donations — confirmed donations + 90-day donor cooldown ────────────
export const bloodDonationsTable = pgTable("blood_donations", {
  id: uuid("id").primaryKey().defaultRandom(),
  donorId: uuid("donor_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  requestId: uuid("request_id").references(() => bloodEmergencyRequestsTable.id, { onDelete: "set null" }),
  bloodGroup: bloodGroupEnum("blood_group").notNull(),
  unitsDoanted: integer("units_donated").notNull().default(1),
  hospitalName: text("hospital_name"),
  hospitalCity: text("hospital_city"),
  donatedAt: timestamp("donated_at", { withTimezone: true }).notNull().defaultNow(),
  donorInactiveUntil: timestamp("donor_inactive_until", { withTimezone: true }).notNull(),
  confirmedByAdmin: boolean("confirmed_by_admin").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BloodDonor = typeof bloodDonorsTable.$inferSelect;
export type BloodEmergencyRequest = typeof bloodEmergencyRequestsTable.$inferSelect;
export type BloodDonation = typeof bloodDonationsTable.$inferSelect;
export type FamilyGroup = typeof familyGroupsTable.$inferSelect;
