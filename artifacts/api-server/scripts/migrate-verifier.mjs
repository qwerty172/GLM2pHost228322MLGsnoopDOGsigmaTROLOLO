import pg from "pg";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, "../../../.env");

// Parse .env manually (dotenv not available here)
try {
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, "");
  }
} catch { /* .env optional */ }

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verifier_provider') THEN
        CREATE TYPE verifier_provider AS ENUM ('telegram','discord');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_type_verifier') THEN
        CREATE TYPE user_type_verifier AS ENUM ('host','player');
      END IF;
    END $$
  `);
  console.log("Enums OK");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS verifier_links (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      user_type user_type_verifier NOT NULL,
      provider verifier_provider NOT NULL,
      provider_user_id TEXT NOT NULL,
      provider_username TEXT,
      active BOOLEAN NOT NULL DEFAULT true,
      linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS verifier_link_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      token TEXT NOT NULL UNIQUE,
      user_id UUID NOT NULL,
      user_type user_type_verifier NOT NULL,
      provider verifier_provider NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      consumed_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS verifier_challenges (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL,
      user_type user_type_verifier NOT NULL,
      purpose TEXT NOT NULL DEFAULT 'explicit',
      codes TEXT NOT NULL,
      verified_providers TEXT NOT NULL DEFAULT '[]',
      expires_at TIMESTAMPTZ NOT NULL,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE players ADD COLUMN IF NOT EXISTS trust_level INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE hosts   ADD COLUMN IF NOT EXISTS trust_level INTEGER NOT NULL DEFAULT 0;
  `);
  console.log("Tables + columns OK");
  await pool.end();
}

run().catch(e => { console.error(e.message); process.exit(1); });
