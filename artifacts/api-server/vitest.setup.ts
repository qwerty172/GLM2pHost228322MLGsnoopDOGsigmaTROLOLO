// Vitest has no Postgres service; satisfy @workspace/db's module-level guard so
// unit tests can import schema/types without a live connection.
process.env.DATABASE_URL ??= "postgresql://localhost:5432/vitest";
