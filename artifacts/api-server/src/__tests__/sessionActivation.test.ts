import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shouldActivateSession } from "../lib/sessionActivation.js";

describe("shouldActivateSession", () => {
  it("returns false when only the player is connected", () => {
    assert.equal(shouldActivateSession([{ role: "player" }]), false);
  });

  it("returns false when only the host is connected", () => {
    assert.equal(shouldActivateSession([{ role: "host" }]), false);
  });

  it("returns true when both host and player are connected", () => {
    assert.equal(
      shouldActivateSession([{ role: "host" }, { role: "player" }]),
      true,
    );
  });

  it("returns true regardless of connection order", () => {
    assert.equal(
      shouldActivateSession([{ role: "player" }, { role: "host" }]),
      true,
    );
  });
});
