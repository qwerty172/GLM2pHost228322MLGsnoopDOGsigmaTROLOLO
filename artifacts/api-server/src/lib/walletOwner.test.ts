import { describe, expect, it } from "vitest";
import { ensureDepositAddressesForOwner } from "./walletOwner";

describe("walletOwner", () => {
  it("exports owner resolution helpers", () => {
    expect(typeof ensureDepositAddressesForOwner).toBe("function");
  });
});
