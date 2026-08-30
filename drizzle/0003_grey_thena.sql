ALTER TABLE "prescriptions" ADD COLUMN "total_units_per_script" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "prescriptions" ADD COLUMN "units_per_dose" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "prescriptions" ADD COLUMN "doses_per_day" integer;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD COLUMN "units_left" numeric(10, 2);