import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { setupRendererEnv } from "./helpers/renderer-env.mjs";

setupRendererEnv();
const { initAgentKey, agentKeyStatusEl } = await import("../dist/renderer/renderer/agent-auth.js");

test("initAgentKey shows pubkey prefix and PC specs", async () => {
  await initAgentKey();
  assert.match(agentKeyStatusEl.textContent, /готов к привязке/);
  assert.match(document.getElementById("pc-specs-info").textContent, /Test CPU/);
  assert.equal(document.getElementById("bind-agent-key").disabled, false);
});

test("initAgentKey prefills bind code from URL hash", async () => {
  window.location.hash = "#bind=ABC123";
  await initAgentKey();
  assert.equal(document.getElementById("agentBindCode").value, "ABC123");
  window.location.hash = "";
});
