import { describe, expect, it } from "vitest";
import { JOIN_CODE_TTL_MS } from "./joinCodes";

describe("joinCodes", () => {
  it("exports 15-minute TTL constant", () => {
    expect(JOIN_CODE_TTL_MS).toBe(15 * 60 * 1000);
  });

  it("exports async helpers", async () => {
    const mod = await import("./joinCodes");
    expect(typeof mod.ensureJoinCodeForSession).toBe("function");
    expect(typeof mod.exchangeJoinCode).toBe("function");
    expect(typeof mod.ensureJoinCodeForPlayerToken).toBe("function");
  });
});
