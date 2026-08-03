import "../test/setup-renderer-dom.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { elements } from "../test/setup-renderer-dom.mjs";

// Module registers click handlers at import time.
await import("../dist/renderer/renderer/agent-auth.js");

test("agent-auth exports status element", async () => {
  const { agentKeyStatusEl } = await import("../dist/renderer/renderer/agent-auth.js");
  assert.ok(agentKeyStatusEl);
  assert.equal(agentKeyStatusEl, elements.get("agent-key-status"));
});

test("bind and login buttons are enabled after module load", () => {
  assert.equal(elements.get("bind-agent-key").disabled, false);
  assert.equal(elements.get("agent-login").disabled, false);
});
