import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  process.exit(1);
}

const client = new pg.Client({ connectionString });

try {
  await client.connect();
  await client.query("SELECT 1");
} finally {
  await client.end().catch(() => {});
}
