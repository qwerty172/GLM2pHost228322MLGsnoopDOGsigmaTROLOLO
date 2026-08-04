import { describe, expect, it } from "vitest";
import { applyLaunchFee } from "./launchFee";

describe("launchFee", () => {
  it("no-ops for zero or non-finite fee", async () => {
    await expect(
      applyLaunchFee({
        sessionId: "s1",
        hostId: "h1",
        playerId: "p1",
        launchPriceUsd: 0,
        paymentSource: "auto",
      }),
    ).resolves.toEqual({ ok: true });

    await expect(
      applyLaunchFee({
        sessionId: "s1",
        hostId: "h1",
        playerId: "p1",
        launchPriceUsd: NaN,
        paymentSource: "auto",
      }),
    ).resolves.toEqual({ ok: true });
  });
});
