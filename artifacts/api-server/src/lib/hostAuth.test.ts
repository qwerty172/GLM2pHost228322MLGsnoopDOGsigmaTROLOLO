import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { hostTokenFromRequest } from "./hostAuth";

describe("hostAuth re-exports", () => {
  it("hostTokenFromRequest works via hostAuth barrel", () => {
    expect(
      hostTokenFromRequest({
        headers: { authorization: "Bearer tok" },
      } as Request),
    ).toBe("tok");
  });
});
