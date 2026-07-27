import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveAgentKeyStatus } from "../lib/agentKeyStatus.js";

const PUB_A = "a".repeat(64);
const PUB_B = "b".repeat(64);

describe("resolveAgentKeyStatus", () => {
  it("returns unbound when client pubkey is absent", () => {
    assert.equal(resolveAgentKeyStatus(PUB_A, null), "unbound");
    assert.equal(resolveAgentKeyStatus(PUB_A, ""), "unbound");
  });

  it("returns ok when pubkeys match (case-insensitive)", () => {
    assert.equal(resolveAgentKeyStatus(PUB_A, PUB_A.toUpperCase()), "ok");
  });

  it("returns revoked when server cleared the key", () => {
    assert.equal(resolveAgentKeyStatus(null, PUB_A), "revoked");
    assert.equal(resolveAgentKeyStatus("", PUB_A), "revoked");
  });

  it("returns mismatch when a different key is bound", () => {
    assert.equal(resolveAgentKeyStatus(PUB_A, PUB_B), "mismatch");
  });
});
