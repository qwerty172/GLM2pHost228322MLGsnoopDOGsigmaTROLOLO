import { describe, expect, it } from "vitest";
import { mintPreviewToken } from "./signaling";

describe("signaling", () => {
  it("mintPreviewToken returns prev_ prefix token", () => {
    const token = mintPreviewToken("host-abc");
    expect(token.startsWith("prev_")).toBe(true);
    expect(token.length).toBeGreaterThan(10);
  });
});
