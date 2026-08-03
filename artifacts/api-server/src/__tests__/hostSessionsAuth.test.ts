import { describe, it } from "node:test";
import assert from "node:assert/strict";

/** Mirrors GET /hosts/:hostToken/sessions header gate. */
function hostSessionsAuthorized(
  pathHostToken: string,
  headerHostToken: string | null,
): boolean {
  return !!headerHostToken && headerHostToken === pathHostToken;
}

describe("host sessions list auth", () => {
  it("rejects URL-only hostToken (no header)", () => {
    assert.equal(hostSessionsAuthorized("leaked-host-token", null), false);
  });

  it("rejects mismatched header", () => {
    assert.equal(hostSessionsAuthorized("path-token", "other-token"), false);
  });

  it("allows matching header", () => {
    assert.equal(hostSessionsAuthorized("same-token", "same-token"), true);
  });
});
