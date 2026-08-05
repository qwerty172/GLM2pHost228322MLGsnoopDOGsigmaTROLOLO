import test from "node:test";
import assert from "node:assert/strict";

const { compareAgentVersions, isAgentVersionSupported } = await import(
  "../dist/main/main/agent-version-policy.js"
);

test("compareAgentVersions orders semver parts (U-17)", () => {
  assert.equal(compareAgentVersions("0.1.0", "0.1.0"), 0);
  assert.equal(compareAgentVersions("0.2.0", "0.1.9"), 1);
  assert.equal(compareAgentVersions("0.0.9", "0.1.0"), -1);
});

test("isAgentVersionSupported respects minimum (U-17)", () => {
  assert.equal(isAgentVersionSupported("0.1.0", "0.1.0"), true);
  assert.equal(isAgentVersionSupported("0.2.0", "0.1.0"), true);
  assert.equal(isAgentVersionSupported("0.0.9", "0.1.0"), false);
});
