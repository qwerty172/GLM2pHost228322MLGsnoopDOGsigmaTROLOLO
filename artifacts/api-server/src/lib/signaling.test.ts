import { describe, expect, it } from "vitest";
import { mintPreviewToken } from "./signaling";

describe("signaling", () => {
  it("mintPreviewToken returns prev_ prefixed token", () => {
    const token = mintPreviewToken("host-123");
    expect(token.startsWith("prev_")).toBe(true);
    expect(token.length).toBeGreaterThan(10);
  });

  it("exports attach/close/send helpers", async () => {
    const mod = await import("./signaling");
    expect(typeof mod.attachSignaling).toBe("function");
    expect(typeof mod.closeSignaling).toBe("function");
    expect(typeof mod.sendSignalingMessage).toBe("function");
  });
});
