CREATE TYPE "public"."medication_activity_event_type" AS ENUM('script_created', 'script_updated', 'script_archived', 'dose_consumed', 'day_consumed', 'repeat_filled', 'dose_reversed', 'day_reversed', 'repeat_reversed');--> statement-breakpoint
CREATE TABLE "medication_activity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prescription_id" uuid NOT NULL,
	"household_member_id" uuid,
	"event_type" "medication_activity_event_type" NOT NULL,
	"units_delta" numeric(10, 2) DEFAULT '0' NOT NULL,
	"repeats_delta" integer DEFAULT 0 NOT NULL,
	"summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "medication_activity_events" ADD CONSTRAINT "medication_activity_events_prescription_id_prescriptions_id_fk" FOREIGN KEY ("prescription_id") REFERENCES "public"."prescriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medication_activity_events" ADD CONSTRAINT "medication_activity_events_household_member_id_household_members_id_fk" FOREIGN KEY ("household_member_id") REFERENCES "public"."household_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "medication_activity_events_prescription_created_idx" ON "medication_activity_events" USING btree ("prescription_id","created_at");