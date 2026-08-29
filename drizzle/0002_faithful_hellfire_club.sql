ALTER TYPE "public"."medication_form" ADD VALUE 'aerosol' BEFORE 'patch';--> statement-breakpoint
ALTER TYPE "public"."medication_form" ADD VALUE 'cream' BEFORE 'patch';--> statement-breakpoint
ALTER TABLE "medications" ADD COLUMN "strength_label" text;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD COLUMN "dose_form" "medication_form";--> statement-breakpoint
ALTER TABLE "prescriptions" ADD COLUMN "dose_strength_label" text;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD COLUMN "total_doses_per_script" integer;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD COLUMN "total_days_per_script" integer;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD COLUMN "refill_at_days_left" integer;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD COLUMN "doses_left" integer;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD COLUMN "days_left" integer;