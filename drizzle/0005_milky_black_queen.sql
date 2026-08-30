CREATE TYPE "public"."medication_treatment" AS ENUM('diabetes', 'depression_anxiety', 'blood_pressure', 'cholesterol', 'other');--> statement-breakpoint
ALTER TABLE "medications" ADD COLUMN "treatment_of" "medication_treatment";--> statement-breakpoint
ALTER TABLE "medications" ADD COLUMN "treatment_other" text;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD COLUMN "supports_day_consumption" boolean DEFAULT true NOT NULL;