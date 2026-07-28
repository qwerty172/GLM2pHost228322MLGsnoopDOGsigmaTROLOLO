CREATE TABLE IF NOT EXISTS "platform_settings" (
  "id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
  "weekly_interest_rate_hbps" integer DEFAULT 20 NOT NULL,
  "guest_credit_limit_lzt" integer DEFAULT 500 NOT NULL,
  "default_credit_limit_lzt" integer DEFAULT 3000 NOT NULL,
  "welcome_bonus_lzt" integer DEFAULT 0 NOT NULL,
  "interest_enabled" boolean DEFAULT true NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
INSERT INTO "platform_settings" ("id") VALUES (1) ON CONFLICT DO NOTHING;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "drip_schedules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_type" text NOT NULL,
  "owner_id" uuid NOT NULL,
  "amount_lzt_per_tick" integer NOT NULL,
  "interval" text NOT NULL,
  "ticks_total" integer NOT NULL,
  "ticks_done" integer DEFAULT 0 NOT NULL,
  "next_tick_at" timestamp with time zone NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "bucket" text DEFAULT 'balance' NOT NULL,
  "note" text DEFAULT '' NOT NULL,
  "purchase_usdt_cents" integer,
  "created_by_admin_host_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "drip_schedules_status_next_idx" ON "drip_schedules" USING btree ("status","next_tick_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "drip_schedules_owner_idx" ON "drip_schedules" USING btree ("owner_type","owner_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "drip_schedules" ADD CONSTRAINT "drip_schedules_created_by_admin_host_id_hosts_id_fk" FOREIGN KEY ("created_by_admin_host_id") REFERENCES "public"."hosts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
