import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["src/__tests__/**"],
    env: {
      DATABASE_URL: "postgres://localhost:5432/marathon_test",
    },
  },
});
