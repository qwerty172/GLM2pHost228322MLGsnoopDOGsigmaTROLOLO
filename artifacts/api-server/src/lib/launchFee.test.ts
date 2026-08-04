import { describe, expect, it } from "vitest";
import { applyLaunchFee } from "./launchFee";

describe("applyLaunchFee", () => {
  it("no-ops for zero fee", async () => {
    const r = await applyLaunchFee({
      sessionId: "s1",
      hostId: "h1",
      playerId: "p1",
      launchPriceUsd: 0,
      paymentSource: "auto",
    });
    expect(r.ok).toBe(true);
  });
});
