import { describe, expect, it } from "vitest";
import { applyLaunchFee } from "./launchFee";

describe("launchFee", () => {
  it("no-ops for zero fee", async () => {
    const result = await applyLaunchFee({
      sessionId: "s1",
      hostId: "h1",
      playerId: "p1",
      launchPriceUsd: 0,
      paymentSource: "auto",
    });
    expect(result).toEqual({ ok: true });
  });
});
