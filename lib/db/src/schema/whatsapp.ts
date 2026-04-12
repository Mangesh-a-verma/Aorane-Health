import {
  pgTable,
  text,
  boolean,
  timestamp,
  uuid,
  jsonb,
  pgEnum,
  integer,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const whatsappSubscriptionStatusEnum = pgEnum("whatsapp_subscription_status", [
  "active",
  "paused",
  "opted_out",
]);

export const whatsappMessageTypeEnum = pgEnum("whatsapp_message_type", [
  "food_log",
  "exercise_log",
  "water_log",
  "medicine_reminder",
  "meal_reminder",
  "exercise_reminder",
  "weekly_report",
  "health_tip",
  "inbound_food",
  "inbound_exercise",
  "inbound_query",
]);

export const whatsappMessageDirectionEnum = pgEnum("whatsapp_message_direction", [
  "inbound",
  "outbound",
]);

export const whatsappBotConfigTable = pgTable("whatsapp_bot_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  isEnabled: boolean("is_enabled").notNull().default(false),
  provider: text("provider").notNull().default("aisensy"),
  businessPhoneNumber: text("business_phone_number"),
  waBaId: text("wa_ba_id"),
  webhookVerifyToken: text("webhook_verify_token"),
  apiKeyEncrypted: text("api_key_encrypted"),
  mealReminderEnabled: boolean("meal_reminder_enabled").notNull().default(true),
  medicineReminderEnabled: boolean("medicine_reminder_enabled").notNull().default(true),
  exerciseReminderEnabled: boolean("exercise_reminder_enabled").notNull().default(true),
  weeklyReportEnabled: boolean("weekly_report_enabled").notNull().default(true),
  breakfastReminderTime: text("breakfast_reminder_time").notNull().default("08:00"),
  lunchReminderTime: text("lunch_reminder_time").notNull().default("13:00"),
  dinnerReminderTime: text("dinner_reminder_time").notNull().default("20:00"),
  medicineReminderTimes: text("medicine_reminder_times").notNull().default("08:00,14:00,21:00"),
  weeklyReportDay: text("weekly_report_day").notNull().default("sunday"),
  weeklyReportTime: text("weekly_report_time").notNull().default("09:00"),
  maxMessagesPerUserPerDay: integer("max_messages_per_user_per_day").notNull().default(5),
  templates: jsonb("templates"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const whatsappSubscriptionsTable = pgTable("whatsapp_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  waPhoneNumber: text("wa_phone_number").notNull(),
  status: whatsappSubscriptionStatusEnum("status").notNull().default("active"),
  mealRemindersOn: boolean("meal_reminders_on").notNull().default(true),
  medicineRemindersOn: boolean("medicine_reminders_on").notNull().default(true),
  exerciseRemindersOn: boolean("exercise_reminders_on").notNull().default(true),
  weeklyReportOn: boolean("weekly_report_on").notNull().default(true),
  preferredLanguage: text("preferred_language").notNull().default("hi"),
  customBreakfastTime: text("custom_breakfast_time"),
  customLunchTime: text("custom_lunch_time"),
  customDinnerTime: text("custom_dinner_time"),
  lastMessageAt: timestamp("last_message_at"),
  totalMessagesReceived: integer("total_messages_received").notNull().default(0),
  totalMessagesSent: integer("total_messages_sent").notNull().default(0),
  subscribedAt: timestamp("subscribed_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const whatsappMessageLogsTable = pgTable("whatsapp_message_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  waPhoneNumber: text("wa_phone_number").notNull(),
  messageType: whatsappMessageTypeEnum("message_type").notNull(),
  direction: whatsappMessageDirectionEnum("direction").notNull(),
  messageBody: text("message_body"),
  waMessageId: text("wa_message_id"),
  parsedData: jsonb("parsed_data"),
  aiProcessed: boolean("ai_processed").notNull().default(false),
  dataLogged: boolean("data_logged").notNull().default(false),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const whatsappTemplatesTable = pgTable("whatsapp_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateName: text("template_name").notNull().unique(),
  templateType: whatsappMessageTypeEnum("template_type").notNull(),
  waTemplateName: text("wa_template_name"),
  bodyText: text("body_text").notNull(),
  bodyTextHindi: text("body_text_hindi"),
  isApproved: boolean("is_approved").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  language: text("language").notNull().default("hi"),
  variables: jsonb("variables"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
