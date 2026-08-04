import { describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

describe("hostHealthWorker", () => {
  it("exports worker lifecycle", async () => {
    const mod = await import("./hostHealthWorker");
    expect(typeof mod.startHostHealthWorker).toBe("function");
    expect(typeof mod.stopHostHealthWorker).toBe("function");
  });
});
