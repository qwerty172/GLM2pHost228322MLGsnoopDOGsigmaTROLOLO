import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installRendererDom } from "./helpers/dom-setup.mjs";

let agentKeyStatusEl;

before(async () => {
  installRendererDom();
  ({ agentKeyStatusEl } = await import("../dist/renderer/renderer/agent-auth.js"));
});

test("agentKeyStatusEl is wired to DOM", () => {
  agentKeyStatusEl.textContent = "Ключ готов";
  assert.equal(agentKeyStatusEl.textContent, "Ключ готов");
});
