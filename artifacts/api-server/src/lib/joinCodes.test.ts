import { describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

const { JOIN_CODE_TTL_MS } = await import("./joinCodes");

describe("joinCodes", () => {
  it("exposes 15-minute TTL constant", () => {
    expect(JOIN_CODE_TTL_MS).toBe(15 * 60 * 1000);
  });
});
