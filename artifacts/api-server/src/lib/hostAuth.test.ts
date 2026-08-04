import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { hostTokenFromRequest } from "./hostAuth";

describe("hostAuth", () => {
  it("re-exports hostTokenFromRequest", () => {
    expect(hostTokenFromRequest({ headers: { authorization: "Bearer host" } } as Request)).toBe("host");
  });
});
