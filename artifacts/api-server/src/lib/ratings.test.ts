import { describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

describe("ratings", () => {
  it("exports rating helpers", async () => {
    const mod = await import("./ratings");
    expect(typeof mod.submitSessionRating).toBe("function");
    expect(typeof mod.recordBlockReserveLedger).toBe("function");
  });
});
