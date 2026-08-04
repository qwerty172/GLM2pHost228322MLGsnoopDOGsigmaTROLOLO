import { describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

const { mintPreviewToken } = await import("./signaling");

describe("signaling", () => {
  it("mints preview tokens with prefix", () => {
    const token = mintPreviewToken("host-1");
    expect(token.startsWith("prev_")).toBe(true);
    expect(token.length).toBeGreaterThan(10);
  });
});
