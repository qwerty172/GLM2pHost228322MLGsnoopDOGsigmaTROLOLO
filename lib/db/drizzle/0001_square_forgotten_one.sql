CREATE TABLE "player_game_saves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"object_path" text DEFAULT '' NOT NULL,
	"storage_key" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"content_hash" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "join_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"session_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "join_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "agent_pairing_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_id" uuid NOT NULL,
	"code" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"agent_pubkey" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_buckets" (
	"key" text PRIMARY KEY NOT NULL,
	"tokens" real NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"window_ms" integer NOT NULL,
	"max" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_failures" (
	"key" text PRIMARY KEY NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" text NOT NULL,
	"sampled_at" timestamp with time zone NOT NULL,
	"rtt_ms" integer,
	"bitrate_kbps" integer,
	"fps" integer,
	"packet_loss_pct" integer,
	"frames_dropped" integer,
	"ice_candidate_type" text,
	"jitter_ms" integer
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "outbox_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"user_type" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "save_manifest" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "rec_specs" jsonb;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "specs_source" text;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "specs_fetched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "quality_score" integer;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "avg_rtt_ms" integer;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "avg_loss_pct" integer;--> statement-breakpoint
ALTER TABLE "player_game_saves" ADD CONSTRAINT "player_game_saves_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_game_saves" ADD CONSTRAINT "player_game_saves_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "join_codes" ADD CONSTRAINT "join_codes_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_pairing_codes" ADD CONSTRAINT "agent_pairing_codes_host_id_hosts_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."hosts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_metrics" ADD CONSTRAINT "session_metrics_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "player_game_saves_player_game_idx" ON "player_game_saves" USING btree ("player_id","game_id");--> statement-breakpoint
CREATE INDEX "join_codes_session_idx" ON "join_codes" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "session_metrics_session_idx" ON "session_metrics" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "session_metrics_sampled_at_idx" ON "session_metrics" USING btree ("sampled_at");--> statement-breakpoint
CREATE INDEX "outbox_status_idx" ON "outbox" USING btree ("status");--> statement-breakpoint
CREATE INDEX "outbox_created_at_idx" ON "outbox" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_idx" ON "refresh_tokens" USING btree ("user_id","user_type");--> statement-breakpoint
CREATE INDEX "refresh_tokens_expires_idx" ON "refresh_tokens" USING btree ("expires_at");