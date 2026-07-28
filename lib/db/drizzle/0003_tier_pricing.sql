ALTER TABLE "hosts" ADD COLUMN IF NOT EXISTS "tier_bronze_multiplier_pct" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "hosts" ADD COLUMN IF NOT EXISTS "tier_silver_multiplier_pct" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "hosts" ADD COLUMN IF NOT EXISTS "tier_gold_multiplier_pct" integer DEFAULT 100 NOT NULL;
