import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["src/__tests__/**"],
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgres://test:test@127.0.0.1:5432/decentralhub_test",
    },
  },
});
