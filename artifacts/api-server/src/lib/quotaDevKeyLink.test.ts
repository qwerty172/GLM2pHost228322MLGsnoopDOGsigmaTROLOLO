import { describe, expect, it } from "vitest";
import { canLinkDevKeyToQuota } from "./quotaDevKeyLink";

describe("canLinkDevKeyToQuota", () => {
  const devKeyId = "11111111-1111-1111-1111-111111111111";

  it("allows linking when ownerToken is the dev key wallet", () => {
    expect(
      canLinkDevKeyToQuota({ type: "dev_key", id: devKeyId }, devKeyId),
    ).toBe(true);
  });

  it("rejects host/player squatting on another dev key", () => {
    expect(
      canLinkDevKeyToQuota({ type: "host", id: "host-1" }, devKeyId),
    ).toBe(false);
    expect(
      canLinkDevKeyToQuota({ type: "player", id: "player-1" }, devKeyId),
    ).toBe(false);
  });

  it("rejects a different dev_key wallet", () => {
    expect(
      canLinkDevKeyToQuota(
        { type: "dev_key", id: "other-dev-key" },
        devKeyId,
      ),
    ).toBe(false);
  });
});
