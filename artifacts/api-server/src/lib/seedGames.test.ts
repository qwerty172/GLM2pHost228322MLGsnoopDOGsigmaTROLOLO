import { describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

describe("seedGames", () => {
  it("exports seedGames runner", async () => {
    const mod = await import("./seedGames");
    expect(typeof mod.seedGames).toBe("function");
  });
});
