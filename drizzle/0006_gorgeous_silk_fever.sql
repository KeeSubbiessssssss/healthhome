CREATE TYPE "public"."medication_bsl_source" AS ENUM('dexcom', 'manual');--> statement-breakpoint
CREATE TABLE "medication_dose_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prescription_id" uuid NOT NULL,
	"household_member_id" uuid,
	"glucose_reading_id" uuid,
	"units_consumed" numeric(10, 2) NOT NULL,
	"bsl_mg_dl" integer,
	"bsl_source" "medication_bsl_source",
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prescriptions" ADD COLUMN "tracks_bsl_at_dose" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "medication_dose_logs" ADD CONSTRAINT "medication_dose_logs_prescription_id_prescriptions_id_fk" FOREIGN KEY ("prescription_id") REFERENCES "public"."prescriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medication_dose_logs" ADD CONSTRAINT "medication_dose_logs_household_member_id_household_members_id_fk" FOREIGN KEY ("household_member_id") REFERENCES "public"."household_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medication_dose_logs" ADD CONSTRAINT "medication_dose_logs_glucose_reading_id_glucose_readings_id_fk" FOREIGN KEY ("glucose_reading_id") REFERENCES "public"."glucose_readings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "medication_dose_logs_prescription_occurred_idx" ON "medication_dose_logs" USING btree ("prescription_id","occurred_at");--> statement-breakpoint
CREATE INDEX "medication_dose_logs_glucose_reading_idx" ON "medication_dose_logs" USING btree ("glucose_reading_id");