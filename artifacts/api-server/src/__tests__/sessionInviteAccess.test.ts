import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isPublicInviteSession } from "../lib/sessionInviteAccess.js";

describe("isPublicInviteSession", () => {
  it("allows normal player sessions", () => {
    assert.equal(
      isPublicInviteSession({ devKeyId: null, status: "active" }),
      true,
    );
    assert.equal(
      isPublicInviteSession({ devKeyId: null, status: "pending" }),
      true,
    );
  });

  it("rejects embed/dev-key sessions", () => {
    assert.equal(
      isPublicInviteSession({ devKeyId: "key-123", status: "active" }),
      false,
    );
  });

  it("rejects ended sessions", () => {
    assert.equal(
      isPublicInviteSession({ devKeyId: null, status: "ended" }),
      false,
    );
  });
});
