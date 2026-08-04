import { describe, expect, it } from "vitest";
import { JOIN_CODE_TTL_MS } from "./joinCodes";

describe("joinCodes constants", () => {
  it("JOIN_CODE_TTL_MS is 15 minutes", () => {
    expect(JOIN_CODE_TTL_MS).toBe(15 * 60 * 1000);
  });
});
