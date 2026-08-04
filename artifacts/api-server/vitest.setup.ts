/** Dummy DATABASE_URL so @workspace/db can load in unit tests without a live Postgres. */
process.env.DATABASE_URL ??=
  "postgresql://test:test@127.0.0.1:5432/decentralhub_test";
