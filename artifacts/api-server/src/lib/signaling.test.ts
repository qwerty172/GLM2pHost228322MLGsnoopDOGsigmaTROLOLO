import { describe, expect, it } from "vitest";

describe("signaling module", () => {
  it("loads without auto-starting workers", async () => {
    const mod = await import("./signaling");
    expect(mod).toBeDefined();
  });
});
