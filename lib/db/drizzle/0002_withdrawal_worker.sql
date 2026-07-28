ALTER TABLE "withdrawals" ADD COLUMN IF NOT EXISTS "tx_hash" text;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD COLUMN IF NOT EXISTS "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD COLUMN IF NOT EXISTS "last_error" text;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD COLUMN IF NOT EXISTS "processing_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "withdrawals_status_idx" ON "withdrawals" USING btree ("status");
