-- Postgres NOTIFY triggers for DecentralHub platform events.
-- Apply manually in production: psql $DATABASE_URL -f lib/db/sql/notify_triggers.sql

CREATE OR REPLACE FUNCTION decentralhub_notify_event() RETURNS trigger AS $$
DECLARE
  payload json;
BEGIN
  payload := json_build_object(
    'type', TG_ARGV[0],
    'payload', row_to_json(NEW),
    'at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );
  PERFORM pg_notify('decentralhub_events', payload::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sessions_notify ON sessions;
CREATE TRIGGER sessions_notify
  AFTER UPDATE OF status ON sessions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION decentralhub_notify_event('session_status');

DROP TRIGGER IF EXISTS hosts_last_seen_notify ON hosts;
CREATE TRIGGER hosts_last_seen_notify
  AFTER UPDATE OF last_seen_at ON hosts
  FOR EACH ROW
  WHEN (OLD.last_seen_at IS DISTINCT FROM NEW.last_seen_at)
  EXECUTE FUNCTION decentralhub_notify_event('host_last_seen');
