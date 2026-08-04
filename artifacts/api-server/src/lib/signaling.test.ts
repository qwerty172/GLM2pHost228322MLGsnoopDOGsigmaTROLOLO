import { describe, expect, it } from "vitest";
import { mintPreviewToken } from "./signaling";

describe("signaling", () => {
  it("mintPreviewToken returns prev_ prefix", () => {
    const tok = mintPreviewToken("host-1");
    expect(tok.startsWith("prev_")).toBe(true);
  });
});
