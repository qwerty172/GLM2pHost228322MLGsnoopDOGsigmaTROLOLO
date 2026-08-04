import { describe, expect, it } from "vitest";

describe("signaling", () => {
  it("module loads without throwing", async () => {
    const mod = await import("./signaling");
    expect(mod).toBeDefined();
  });
});
