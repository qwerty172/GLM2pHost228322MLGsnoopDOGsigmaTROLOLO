import { describe, it } from "node:test";
import assert from "node:assert/strict";

const { resolveCaptureMode } = await import("../dist/main/shared/messages.js");

describe("resolveCaptureMode (H-03)", () => {
  it("defaults to chromium", () => {
    assert.equal(resolveCaptureMode(), "chromium");
    assert.equal(resolveCaptureMode(undefined), "chromium");
  });

  it("coerces native to chromium", () => {
    assert.equal(resolveCaptureMode("native"), "chromium");
  });

  it("keeps chromium", () => {
    assert.equal(resolveCaptureMode("chromium"), "chromium");
  });
});
