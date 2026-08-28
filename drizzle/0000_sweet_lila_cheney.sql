CREATE TYPE "public"."dexcom_connection_status" AS ENUM('not_connected', 'connected', 'needs_reauth', 'error');--> statement-breakpoint
CREATE TYPE "public"."glucose_trend" AS ENUM('double_up', 'single_up', 'forty_five_up', 'flat', 'forty_five_down', 'single_down', 'double_down', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."household_role" AS ENUM('owner', 'member');--> statement-breakpoint
CREATE TYPE "public"."inventory_event_type" AS ENUM('received', 'consumed', 'adjustment', 'expired', 'discarded');--> statement-breakpoint
CREATE TYPE "public"."medication_form" AS ENUM('tablet', 'capsule', 'liquid', 'injection', 'patch', 'device', 'other');--> statement-breakpoint
CREATE TABLE "dexcom_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_member_id" uuid NOT NULL,
	"dexcom_account_id" text,
	"status" "dexcom_connection_status" DEFAULT 'not_connected' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dexcom_connections_household_member_id_unique" UNIQUE("household_member_id")
);
--> statement-breakpoint
CREATE TABLE "glucose_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"source_reading_id" text NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"value_mg_dl" integer NOT NULL,
	"trend" "glucose_trend" DEFAULT 'unknown' NOT NULL,
	"trend_rate" numeric(8, 3),
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"auth_user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"role" "household_role" DEFAULT 'member' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "households" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "households_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "inventory_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stock_id" uuid NOT NULL,
	"prescription_id" uuid,
	"event_type" "inventory_event_type" NOT NULL,
	"quantity_delta" numeric(10, 2) NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medication_stock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"medication_id" uuid NOT NULL,
	"unit" text NOT NULL,
	"opening_quantity" numeric(10, 2) DEFAULT '0' NOT NULL,
	"reorder_at_quantity" numeric(10, 2) DEFAULT '0' NOT NULL,
	"target_quantity" numeric(10, 2),
	"last_counted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "medication_stock_medication_id_unique" UNIQUE("medication_id")
);
--> statement-breakpoint
CREATE TABLE "medications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL,
	"generic_name" text,
	"form" "medication_form" DEFAULT 'other' NOT NULL,
	"strength_value" numeric(10, 2),
	"strength_unit" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prescriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"medication_id" uuid NOT NULL,
	"household_member_id" uuid,
	"dose_amount" numeric(10, 2),
	"dose_unit" text,
	"frequency" text,
	"instructions" text,
	"script_expires_on" date,
	"repeats_authorized" integer,
	"repeats_remaining" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dexcom_connections" ADD CONSTRAINT "dexcom_connections_household_member_id_household_members_id_fk" FOREIGN KEY ("household_member_id") REFERENCES "public"."household_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "glucose_readings" ADD CONSTRAINT "glucose_readings_connection_id_dexcom_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."dexcom_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_events" ADD CONSTRAINT "inventory_events_stock_id_medication_stock_id_fk" FOREIGN KEY ("stock_id") REFERENCES "public"."medication_stock"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_events" ADD CONSTRAINT "inventory_events_prescription_id_prescriptions_id_fk" FOREIGN KEY ("prescription_id") REFERENCES "public"."prescriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medication_stock" ADD CONSTRAINT "medication_stock_medication_id_medications_id_fk" FOREIGN KEY ("medication_id") REFERENCES "public"."medications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medications" ADD CONSTRAINT "medications_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_medication_id_medications_id_fk" FOREIGN KEY ("medication_id") REFERENCES "public"."medications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_household_member_id_household_members_id_fk" FOREIGN KEY ("household_member_id") REFERENCES "public"."household_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dexcom_connections_status_idx" ON "dexcom_connections" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "glucose_readings_source_reading_id_idx" ON "glucose_readings" USING btree ("source_reading_id");--> statement-breakpoint
CREATE INDEX "glucose_readings_connection_recorded_idx" ON "glucose_readings" USING btree ("connection_id","recorded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "household_members_auth_user_id_idx" ON "household_members" USING btree ("auth_user_id");--> statement-breakpoint
CREATE INDEX "household_members_household_id_idx" ON "household_members" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "inventory_events_stock_occurred_idx" ON "inventory_events" USING btree ("stock_id","occurred_at");--> statement-breakpoint
CREATE INDEX "inventory_events_prescription_id_idx" ON "inventory_events" USING btree ("prescription_id");--> statement-breakpoint
CREATE INDEX "medication_stock_medication_id_idx" ON "medication_stock" USING btree ("medication_id");--> statement-breakpoint
CREATE INDEX "medications_household_id_idx" ON "medications" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "medications_household_name_idx" ON "medications" USING btree ("household_id","name");--> statement-breakpoint
CREATE INDEX "prescriptions_medication_id_idx" ON "prescriptions" USING btree ("medication_id");--> statement-breakpoint
CREATE INDEX "prescriptions_expiry_idx" ON "prescriptions" USING btree ("script_expires_on");