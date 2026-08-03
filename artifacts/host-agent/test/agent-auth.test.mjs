import { test } from "node:test";
import assert from "node:assert/strict";
import { installRendererEnv, RENDERER_DIST } from "./helpers/renderer-env.mjs";

installRendererEnv();

// Side-effect module (button handlers) — smoke import.
const mod = await import(new URL("agent-auth.js", RENDERER_DIST).href);
const { initAgentKey } = mod;

test("agent-auth module exports initAgentKey", () => {
  assert.equal(typeof initAgentKey, "function");
});

test("initAgentKey populates key status from agent API", async () => {
  const statusEl = document.getElementById("agent-key-status");
  await initAgentKey();
  assert.match(statusEl.textContent, /Ключ:/);
});
