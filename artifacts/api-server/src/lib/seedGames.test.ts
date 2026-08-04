import { describe, expect, it } from "vitest";

describe("seedGames", () => {
  it("module exports seedGames", async () => {
    const mod = await import("./seedGames");
    expect(typeof mod.seedGames).toBe("function");
  });
});
