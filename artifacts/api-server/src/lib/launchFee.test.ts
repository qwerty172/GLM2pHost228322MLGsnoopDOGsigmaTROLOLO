import { describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

describe("launchFee", () => {
  it("no-ops when launch fee is zero", async () => {
    const { applyLaunchFee } = await import("./launchFee");
    await expect(
      applyLaunchFee({
        sessionId: "s1",
        hostId: "h1",
        playerId: "p1",
        launchPriceUsd: 0,
        paymentSource: "auto",
      }),
    ).resolves.toEqual({ ok: true });
  });
});
