import { describe, expect, it } from "vitest";
import { resolveOwnerByToken } from "./walletOwner";

describe("walletOwner", () => {
  it("resolveOwnerByToken is exported", () => {
    expect(typeof resolveOwnerByToken).toBe("function");
  });
});
