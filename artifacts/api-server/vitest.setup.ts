// Dummy DATABASE_URL so modules importing @workspace/db can load in unit tests.
process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";
