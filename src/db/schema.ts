import { boolean, date, index, integer, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const householdRole = pgEnum("household_role", ["owner", "member"]);
export const medicationForm = pgEnum("medication_form", ["tablet", "capsule", "liquid", "injection", "aerosol", "cream", "patch", "device", "other"]);
export const inventoryEventType = pgEnum("inventory_event_type", ["received", "consumed", "adjustment", "expired", "discarded"]);
export const dexcomConnectionStatus = pgEnum("dexcom_connection_status", ["not_connected", "connected", "needs_reauth", "error"]);
export const glucoseTrend = pgEnum("glucose_trend", ["double_up", "single_up", "forty_five_up", "flat", "forty_five_down", "single_down", "double_down", "unknown"]);

export const households = pgTable("households", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const householdMembers = pgTable("household_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  authUserId: text("auth_user_id").notNull(),
  displayName: text("display_name").notNull(),
  role: householdRole("role").notNull().default("member"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("household_members_auth_user_id_idx").on(table.authUserId),
  index("household_members_household_id_idx").on(table.householdId),
]);

export const medications = pgTable("medications", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  genericName: text("generic_name"),
  form: medicationForm("form").notNull().default("other"),
  strengthValue: numeric("strength_value", { precision: 10, scale: 2 }),
  strengthUnit: text("strength_unit"),
  strengthLabel: text("strength_label"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("medications_household_id_idx").on(table.householdId),
  index("medications_household_name_idx").on(table.householdId, table.name),
]);

export const prescriptions = pgTable("prescriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  medicationId: uuid("medication_id").notNull().references(() => medications.id, { onDelete: "cascade" }),
  householdMemberId: uuid("household_member_id").references(() => householdMembers.id, { onDelete: "set null" }),
  doseAmount: numeric("dose_amount", { precision: 10, scale: 2 }),
  doseUnit: text("dose_unit"),
  doseForm: medicationForm("dose_form"),
  doseStrengthLabel: text("dose_strength_label"),
  frequency: text("frequency"),
  instructions: text("instructions"),
  scriptExpiresOn: date("script_expires_on"),
  totalDosesPerScript: integer("total_doses_per_script"),
  totalDaysPerScript: integer("total_days_per_script"),
  refillAtDaysLeft: integer("refill_at_days_left"),
  dosesLeft: integer("doses_left"),
  daysLeft: integer("days_left"),
  repeatsAuthorized: integer("repeats_authorized"),
  repeatsRemaining: integer("repeats_remaining"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("prescriptions_medication_id_idx").on(table.medicationId),
  index("prescriptions_expiry_idx").on(table.scriptExpiresOn),
]);

export const medicationStock = pgTable("medication_stock", {
  id: uuid("id").defaultRandom().primaryKey(),
  medicationId: uuid("medication_id").notNull().references(() => medications.id, { onDelete: "cascade" }).unique(),
  unit: text("unit").notNull(),
  openingQuantity: numeric("opening_quantity", { precision: 10, scale: 2 }).notNull().default("0"),
  reorderAtQuantity: numeric("reorder_at_quantity", { precision: 10, scale: 2 }).notNull().default("0"),
  targetQuantity: numeric("target_quantity", { precision: 10, scale: 2 }),
  lastCountedAt: timestamp("last_counted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("medication_stock_medication_id_idx").on(table.medicationId)]);

export const inventoryEvents = pgTable("inventory_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  stockId: uuid("stock_id").notNull().references(() => medicationStock.id, { onDelete: "cascade" }),
  prescriptionId: uuid("prescription_id").references(() => prescriptions.id, { onDelete: "set null" }),
  eventType: inventoryEventType("event_type").notNull(),
  quantityDelta: numeric("quantity_delta", { precision: 10, scale: 2 }).notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("inventory_events_stock_occurred_idx").on(table.stockId, table.occurredAt),
  index("inventory_events_prescription_id_idx").on(table.prescriptionId),
]);

export const dexcomConnections = pgTable("dexcom_connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdMemberId: uuid("household_member_id").notNull().references(() => householdMembers.id, { onDelete: "cascade" }).unique(),
  dexcomAccountId: text("dexcom_account_id"),
  status: dexcomConnectionStatus("status").notNull().default("not_connected"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("dexcom_connections_status_idx").on(table.status)]);

export const dexcomOAuthCredentials = pgTable("dexcom_oauth_credentials", {
  connectionId: uuid("connection_id").primaryKey().references(() => dexcomConnections.id, { onDelete: "cascade" }),
  accessTokenCiphertext: text("access_token_ciphertext").notNull(),
  refreshTokenCiphertext: text("refresh_token_ciphertext").notNull(),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }).notNull(),
  scopes: text("scopes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const glucoseReadings = pgTable("glucose_readings", {
  id: uuid("id").defaultRandom().primaryKey(),
  connectionId: uuid("connection_id").notNull().references(() => dexcomConnections.id, { onDelete: "cascade" }),
  sourceReadingId: text("source_reading_id").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  valueMgDl: integer("value_mg_dl").notNull(),
  trend: glucoseTrend("trend").notNull().default("unknown"),
  trendRate: numeric("trend_rate", { precision: 8, scale: 3 }),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("glucose_readings_source_reading_id_idx").on(table.sourceReadingId),
  index("glucose_readings_connection_recorded_idx").on(table.connectionId, table.recordedAt),
]);
