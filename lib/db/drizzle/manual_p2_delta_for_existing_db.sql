-- Manual delta for DBs that already exist (schema pushed earlier).
-- Do NOT apply 0000_*.sql on those DBs — it is a full CREATE baseline.
-- Review orphan rows before adding FKs; use IF NOT EXISTS where supported.
-- Not tracked by drizzle journal — apply by hand or via a reviewed ops script.

-- sessions.quotaId → quotas
ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_quota_id_quotas_id_fk"
  FOREIGN KEY ("quota_id") REFERENCES "public"."quotas"("id")
  ON DELETE set null ON UPDATE no action;

-- quota_sessions.sessionId FK + unique
ALTER TABLE "quota_sessions"
  ADD CONSTRAINT "quota_sessions_session_id_sessions_id_fk"
  FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id")
  ON DELETE cascade ON UPDATE no action;

CREATE UNIQUE INDEX IF NOT EXISTS "quota_sessions_session_unique_idx"
  ON "quota_sessions" USING btree ("session_id");

-- billing_events FKs
ALTER TABLE "billing_events"
  ADD CONSTRAINT "billing_events_session_id_sessions_id_fk"
  FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "billing_events"
  ADD CONSTRAINT "billing_events_host_id_hosts_id_fk"
  FOREIGN KEY ("host_id") REFERENCES "public"."hosts"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "billing_events"
  ADD CONSTRAINT "billing_events_player_id_players_id_fk"
  FOREIGN KEY ("player_id") REFERENCES "public"."players"("id")
  ON DELETE set null ON UPDATE no action;

ALTER TABLE "billing_events"
  ADD CONSTRAINT "billing_events_quota_id_quotas_id_fk"
  FOREIGN KEY ("quota_id") REFERENCES "public"."quotas"("id")
  ON DELETE set null ON UPDATE no action;

-- Indexes
CREATE INDEX IF NOT EXISTS "hosts_last_seen_at_idx"
  ON "hosts" USING btree ("last_seen_at");

CREATE INDEX IF NOT EXISTS "sessions_game_status_idx"
  ON "sessions" USING btree ("game_id", "status");

CREATE INDEX IF NOT EXISTS "sessions_active_billing_idx"
  ON "sessions" USING btree ("status", "last_billed_at")
  WHERE "sessions"."status" <> 'ended';

CREATE INDEX IF NOT EXISTS "billing_events_host_idx"
  ON "billing_events" USING btree ("host_id");

CREATE INDEX IF NOT EXISTS "billing_events_session_tick_idx"
  ON "billing_events" USING btree ("session_id", "billed_at")
  WHERE "billing_events"."kind" = 'session_tick';

CREATE INDEX IF NOT EXISTS "ledger_owner_created_idx"
  ON "ledger" USING btree ("owner_type", "owner_id", "created_at");

CREATE INDEX IF NOT EXISTS "loans_status_due_at_idx"
  ON "loans" USING btree ("status", "due_at");
