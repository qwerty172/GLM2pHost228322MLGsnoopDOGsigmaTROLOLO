CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"cover_image_url" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"genre" text DEFAULT '' NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"genres" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"steam_app_id" text,
	"has_mods" boolean DEFAULT false NOT NULL,
	"is_multiplayer" boolean DEFAULT false NOT NULL,
	"host_spectates_player" boolean DEFAULT false NOT NULL,
	"has_quests" boolean DEFAULT false NOT NULL,
	"browser_host_url" text DEFAULT '' NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "games_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "hosts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_token" text NOT NULL,
	"display_name" text NOT NULL,
	"internal_balance_lzt" integer DEFAULT 0 NOT NULL,
	"withdrawable_balance_lzt" integer DEFAULT 0 NOT NULL,
	"credit_debt_lzt" integer DEFAULT 0 NOT NULL,
	"credit_receivable_lzt" integer DEFAULT 0 NOT NULL,
	"pending_interest_fraction_lzt" integer DEFAULT 0 NOT NULL,
	"interest_sample_lzt" integer DEFAULT 0 NOT NULL,
	"lifetime_deposit_usdt_cents" integer DEFAULT 0 NOT NULL,
	"max_deposit_usdt_cents" integer DEFAULT 0 NOT NULL,
	"max_withdrawal_usdt_cents" integer DEFAULT 0 NOT NULL,
	"premium_until" timestamp with time zone,
	"kyc_verified" boolean DEFAULT false NOT NULL,
	"has_default" boolean DEFAULT false NOT NULL,
	"credit_minutes_per_new_player" integer DEFAULT 10 NOT NULL,
	"credit_max_lzt_per_player" integer DEFAULT 12000 NOT NULL,
	"game_id" uuid,
	"bound_app_path" text DEFAULT '' NOT NULL,
	"bound_url" text DEFAULT '' NOT NULL,
	"bound_app_label" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"launch_price_usd" numeric(18, 6) DEFAULT '0' NOT NULL,
	"minute_price_usd" numeric(18, 6) DEFAULT '0.04' NOT NULL,
	"schedule_mode" text DEFAULT 'always' NOT NULL,
	"schedule_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"stream_platform" text DEFAULT '' NOT NULL,
	"stream_url" text DEFAULT '' NOT NULL,
	"stream_key" text DEFAULT '' NOT NULL,
	"games_contributed" integer DEFAULT 0 NOT NULL,
	"is_admin" integer DEFAULT 0 NOT NULL,
	"last_submission_status" text,
	"last_submission_note" text DEFAULT '' NOT NULL,
	"agent_pubkey" text,
	"is_vds" integer DEFAULT 0 NOT NULL,
	"pc_specs" jsonb,
	"ping_ms" integer,
	"rating_avg" numeric(4, 2),
	"rating_count" integer DEFAULT 0 NOT NULL,
	"schedule_auto_disabled_reason" text,
	"schedule_auto_disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hosts_host_token_unique" UNIQUE("host_token")
);
--> statement-breakpoint
CREATE TABLE "host_games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"price_per_minute_lzt" integer DEFAULT 8 NOT NULL,
	"app_path" text DEFAULT '' NOT NULL,
	"bound_url" text DEFAULT '' NOT NULL,
	"launch_args" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"local_available" boolean DEFAULT true NOT NULL,
	"last_error" text DEFAULT '' NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "host_games_host_game_unique" UNIQUE("host_id","game_id")
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_token" text NOT NULL,
	"display_name" text NOT NULL,
	"internal_balance_lzt" integer DEFAULT 0 NOT NULL,
	"withdrawable_balance_lzt" integer DEFAULT 0 NOT NULL,
	"credit_debt_lzt" integer DEFAULT 0 NOT NULL,
	"credit_receivable_lzt" integer DEFAULT 0 NOT NULL,
	"pending_interest_fraction_lzt" integer DEFAULT 0 NOT NULL,
	"interest_sample_lzt" integer DEFAULT 0 NOT NULL,
	"lifetime_deposit_usdt_cents" integer DEFAULT 0 NOT NULL,
	"max_deposit_usdt_cents" integer DEFAULT 0 NOT NULL,
	"max_withdrawal_usdt_cents" integer DEFAULT 0 NOT NULL,
	"credit_limit_lzt" integer DEFAULT 3000 NOT NULL,
	"premium_until" timestamp with time zone,
	"kyc_verified" boolean DEFAULT false NOT NULL,
	"has_default" boolean DEFAULT false NOT NULL,
	"is_guest" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_player_token_unique" UNIQUE("player_token")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"player_token" text NOT NULL,
	"invite_code" text,
	"invite_expires_at" timestamp with time zone,
	"claimed_by_player_id" uuid,
	"dev_key_id" uuid,
	"app_name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"resolution" text DEFAULT '1920x1080' NOT NULL,
	"bitrate_kbps" integer DEFAULT 6000 NOT NULL,
	"rate_per_minute" text DEFAULT '0.04' NOT NULL,
	"payment_source" text DEFAULT 'auto' NOT NULL,
	"quota_id" uuid,
	"block_minutes" integer,
	"block_reserved_lzt" integer,
	"is_test" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"last_billed_at" timestamp with time zone,
	"end_reason" text,
	CONSTRAINT "sessions_player_token_unique" UNIQUE("player_token"),
	CONSTRAINT "sessions_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "withdrawals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" text DEFAULT 'host' NOT NULL,
	"owner_id" uuid NOT NULL,
	"currency" text NOT NULL,
	"address" text NOT NULL,
	"amount" numeric(18, 6) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "deposit_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"currency" text NOT NULL,
	"label" text NOT NULL,
	"address" text NOT NULL,
	"network" text NOT NULL,
	"encrypted_private_key" text,
	"min_deposit" numeric(18, 6) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deposits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"currency" text NOT NULL,
	"network" text NOT NULL,
	"address" text NOT NULL,
	"tx_hash" text NOT NULL,
	"gross_amount" numeric(18, 6) NOT NULL,
	"commission_amount" numeric(18, 6) NOT NULL,
	"net_amount" numeric(18, 6) NOT NULL,
	"status" text DEFAULT 'credited' NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"credited_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "billing_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"host_id" uuid NOT NULL,
	"player_id" uuid,
	"minutes" integer DEFAULT 1 NOT NULL,
	"bucket" text DEFAULT 'green' NOT NULL,
	"player_debit_lzt" integer DEFAULT 0 NOT NULL,
	"host_credit_lzt" integer DEFAULT 0 NOT NULL,
	"kind" text DEFAULT 'session_tick' NOT NULL,
	"quota_id" uuid,
	"billed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"game_id" uuid,
	"visibility" text DEFAULT 'public' NOT NULL,
	"access_code" text,
	"dev_key_id" uuid,
	"min_session_minutes" integer,
	"max_session_minutes" integer,
	"min_gpu_vram" integer,
	"min_cpu_cores" integer,
	"min_ram_gb" integer,
	"min_download_mbps" integer,
	"min_upload_mbps" integer,
	"rec_gpu_vram" integer,
	"rec_cpu_cores" integer,
	"rec_ram_gb" integer,
	"rec_download_mbps" integer,
	"rec_upload_mbps" integer,
	"required_tier" text DEFAULT 'min' NOT NULL,
	"start_at" timestamp with time zone DEFAULT now() NOT NULL,
	"end_at" timestamp with time zone,
	"budget_lzt" integer,
	"escrow_remaining_lzt" integer,
	"sponsor_host_per_minute_lzt" integer,
	"sponsor_player_per_minute_lzt" integer,
	"royalty_basis" text,
	"royalty_value" integer,
	"royalty_source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quota_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quota_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"attached_at" timestamp with time zone DEFAULT now() NOT NULL,
	"detached_at" timestamp with time zone,
	"total_royalty_lzt" integer DEFAULT 0 NOT NULL,
	"total_sponsor_host_lzt" integer DEFAULT 0 NOT NULL,
	"total_sponsor_player_lzt" integer DEFAULT 0 NOT NULL,
	"minutes_billed" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"title" text NOT NULL,
	"slug" text DEFAULT '' NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"genres" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"cover_image_url" text DEFAULT '' NOT NULL,
	"kind" text DEFAULT 'native' NOT NULL,
	"default_browser_url" text DEFAULT '' NOT NULL,
	"steam_app_id" text,
	"reviewer_id" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"approved_game_id" uuid,
	"pending_host_config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"owner_type" text NOT NULL,
	"owner_id" uuid,
	"bucket" text NOT NULL,
	"delta_lzt" integer NOT NULL,
	"ref_type" text,
	"ref_id" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loan_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"borrower_type" text NOT NULL,
	"borrower_id" uuid NOT NULL,
	"amount_lzt" integer NOT NULL,
	"term_days" integer NOT NULL,
	"rate_bps" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"funded_amount_lzt" integer DEFAULT 0 NOT NULL,
	"funded_loan_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_type" text DEFAULT 'p2p' NOT NULL,
	"lender_type" text NOT NULL,
	"lender_id" uuid NOT NULL,
	"borrower_type" text NOT NULL,
	"borrower_id" uuid NOT NULL,
	"request_id" uuid,
	"principal_lzt" integer NOT NULL,
	"outstanding_lzt" integer NOT NULL,
	"repaid_lzt" integer DEFAULT 0 NOT NULL,
	"escrow_lzt" integer DEFAULT 0 NOT NULL,
	"platform_fee_lzt" integer DEFAULT 0 NOT NULL,
	"rate_bps" integer DEFAULT 0 NOT NULL,
	"lender_payout_mode" text DEFAULT 'cash_on_close' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"due_at" timestamp with time zone,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"defaulted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "system_accounts" (
	"key" text PRIMARY KEY NOT NULL,
	"balance_lzt" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quota_vds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quota_id" uuid NOT NULL,
	"provider" text DEFAULT 'ssh' NOT NULL,
	"ssh_host" text NOT NULL,
	"ssh_port" integer DEFAULT 22 NOT NULL,
	"ssh_user" text NOT NULL,
	"ssh_key_encrypted" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provision_log" text DEFAULT '' NOT NULL,
	"last_health_at" timestamp with time zone,
	"host_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quota_vds_quota_id_unique" UNIQUE("quota_id")
);
--> statement-breakpoint
CREATE TABLE "dev_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_key" text NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	"internal_balance_lzt" integer DEFAULT 0 NOT NULL,
	"withdrawable_balance_lzt" integer DEFAULT 0 NOT NULL,
	"credit_debt_lzt" integer DEFAULT 0 NOT NULL,
	"credit_receivable_lzt" integer DEFAULT 0 NOT NULL,
	"lifetime_deposit_usdt_cents" integer DEFAULT 0 NOT NULL,
	"premium_until" timestamp with time zone,
	"max_deposit_usdt_cents" integer DEFAULT 0 NOT NULL,
	"max_withdrawal_usdt_cents" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"host_rules_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dev_keys_api_key_unique" UNIQUE("api_key")
);
--> statement-breakpoint
CREATE TABLE "session_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"host_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hosts" ADD CONSTRAINT "hosts_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_games" ADD CONSTRAINT "host_games_host_id_hosts_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."hosts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_games" ADD CONSTRAINT "host_games_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_host_id_hosts_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."hosts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_claimed_by_player_id_players_id_fk" FOREIGN KEY ("claimed_by_player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_dev_key_id_dev_keys_id_fk" FOREIGN KEY ("dev_key_id") REFERENCES "public"."dev_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_quota_id_quotas_id_fk" FOREIGN KEY ("quota_id") REFERENCES "public"."quotas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_host_id_hosts_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."hosts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_quota_id_quotas_id_fk" FOREIGN KEY ("quota_id") REFERENCES "public"."quotas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotas" ADD CONSTRAINT "quotas_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotas" ADD CONSTRAINT "quotas_dev_key_id_dev_keys_id_fk" FOREIGN KEY ("dev_key_id") REFERENCES "public"."dev_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quota_sessions" ADD CONSTRAINT "quota_sessions_quota_id_quotas_id_fk" FOREIGN KEY ("quota_id") REFERENCES "public"."quotas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quota_sessions" ADD CONSTRAINT "quota_sessions_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_submissions" ADD CONSTRAINT "game_submissions_host_id_hosts_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."hosts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_submissions" ADD CONSTRAINT "game_submissions_reviewer_id_hosts_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."hosts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_submissions" ADD CONSTRAINT "game_submissions_approved_game_id_games_id_fk" FOREIGN KEY ("approved_game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quota_vds" ADD CONSTRAINT "quota_vds_quota_id_quotas_id_fk" FOREIGN KEY ("quota_id") REFERENCES "public"."quotas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_ratings" ADD CONSTRAINT "session_ratings_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_ratings" ADD CONSTRAINT "session_ratings_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_ratings" ADD CONSTRAINT "session_ratings_host_id_hosts_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."hosts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hosts_last_seen_at_idx" ON "hosts" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "host_games_host_idx" ON "host_games" USING btree ("host_id","enabled");--> statement-breakpoint
CREATE INDEX "host_games_game_idx" ON "host_games" USING btree ("game_id","enabled");--> statement-breakpoint
CREATE INDEX "sessions_host_status_idx" ON "sessions" USING btree ("host_id","status");--> statement-breakpoint
CREATE INDEX "sessions_status_idx" ON "sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sessions_quota_idx" ON "sessions" USING btree ("quota_id");--> statement-breakpoint
CREATE INDEX "sessions_game_status_idx" ON "sessions" USING btree ("game_id","status");--> statement-breakpoint
CREATE INDEX "sessions_active_billing_idx" ON "sessions" USING btree ("status","last_billed_at") WHERE "sessions"."status" <> 'ended';--> statement-breakpoint
CREATE INDEX "withdrawals_owner_idx" ON "withdrawals" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deposit_addresses_owner_currency_idx" ON "deposit_addresses" USING btree ("owner_type","owner_id","currency");--> statement-breakpoint
CREATE INDEX "deposit_addresses_address_idx" ON "deposit_addresses" USING btree ("address");--> statement-breakpoint
CREATE UNIQUE INDEX "deposits_network_tx_hash_idx" ON "deposits" USING btree ("network","tx_hash");--> statement-breakpoint
CREATE INDEX "deposits_owner_idx" ON "deposits" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "billing_events_session_idx" ON "billing_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "billing_events_quota_idx" ON "billing_events" USING btree ("quota_id");--> statement-breakpoint
CREATE INDEX "billing_events_host_idx" ON "billing_events" USING btree ("host_id");--> statement-breakpoint
CREATE INDEX "billing_events_session_tick_idx" ON "billing_events" USING btree ("session_id","billed_at") WHERE "billing_events"."kind" = 'session_tick';--> statement-breakpoint
CREATE INDEX "quotas_owner_idx" ON "quotas" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "quotas_visibility_idx" ON "quotas" USING btree ("visibility","status");--> statement-breakpoint
CREATE INDEX "quotas_game_idx" ON "quotas" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "quotas_dev_key_idx" ON "quotas" USING btree ("dev_key_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quotas_dev_key_unique_idx" ON "quotas" USING btree ("dev_key_id") WHERE "quotas"."dev_key_id" is not null;--> statement-breakpoint
CREATE INDEX "quota_sessions_quota_idx" ON "quota_sessions" USING btree ("quota_id");--> statement-breakpoint
CREATE INDEX "quota_sessions_session_idx" ON "quota_sessions" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quota_sessions_session_unique_idx" ON "quota_sessions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "game_submissions_host_idx" ON "game_submissions" USING btree ("host_id");--> statement-breakpoint
CREATE INDEX "game_submissions_status_idx" ON "game_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ledger_owner_idx" ON "ledger" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "ledger_owner_created_idx" ON "ledger" USING btree ("owner_type","owner_id","created_at");--> statement-breakpoint
CREATE INDEX "ledger_group_idx" ON "ledger" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "ledger_kind_idx" ON "ledger" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "loan_requests_borrower_idx" ON "loan_requests" USING btree ("borrower_type","borrower_id");--> statement-breakpoint
CREATE INDEX "loan_requests_status_idx" ON "loan_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "loans_borrower_idx" ON "loans" USING btree ("borrower_type","borrower_id");--> statement-breakpoint
CREATE INDEX "loans_lender_idx" ON "loans" USING btree ("lender_type","lender_id");--> statement-breakpoint
CREATE INDEX "loans_status_idx" ON "loans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "loans_status_due_at_idx" ON "loans" USING btree ("status","due_at");--> statement-breakpoint
CREATE INDEX "quota_vds_quota_idx" ON "quota_vds" USING btree ("quota_id");--> statement-breakpoint
CREATE INDEX "quota_vds_host_idx" ON "quota_vds" USING btree ("host_id");--> statement-breakpoint
CREATE INDEX "quota_vds_status_idx" ON "quota_vds" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "session_ratings_session_player_idx" ON "session_ratings" USING btree ("session_id","player_id");