import { describe, expect, it } from "vitest";
import type { OwnerRecord, OwnerType } from "./walletOwner";

describe("walletOwner types", () => {
  it("OwnerType includes host, player, dev_key", () => {
    const types: OwnerType[] = ["host", "player", "dev_key"];
    expect(types.length).toBe(3);
    const rec: Partial<OwnerRecord> = { type: "player", displayName: "x" };
    expect(rec.type).toBe("player");
  });
});
