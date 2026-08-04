import { describe, expect, it } from "vitest";
import { resolveOwnerByToken, ensureDepositAddressesForOwner } from "./walletOwner";

describe("walletOwner", () => {
  it("exports owner resolution helpers", () => {
    expect(typeof resolveOwnerByToken).toBe("function");
    expect(typeof ensureDepositAddressesForOwner).toBe("function");
  });
});
