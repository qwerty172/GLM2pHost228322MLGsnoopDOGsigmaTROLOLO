import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { setupRendererEnv, defaultHostConfig } from "./helpers/renderer-env.mjs";

setupRendererEnv();
await import("../dist/renderer/renderer/connect-events.js");
const { session } = await import("../dist/renderer/renderer/state.js");
const { connectBtn } = await import("../dist/renderer/renderer/dom.js");
const { readForm } = await import("../dist/renderer/renderer/config.js");

test("connect-events wires connect button and blocks when session active", async () => {
  assert.equal(typeof connectBtn.onclick, "object"); // listener attached via addEventListener
  session.currentSessionId = "sess-1";
  const { logEl } = await import("../dist/renderer/renderer/dom.js");
  const before = logEl.textContent;
  connectBtn.click();
  assert.match(logEl.textContent, /Уже онлайн/);
  assert.notEqual(logEl.textContent, before);
  session.currentSessionId = null;
});

test("connect-events does not wipe saved hostToken when form fields are empty", async () => {
  const agent = window.agent;
  const savedToken = "persisted-host-token";
  await agent.setConfig({ ...defaultHostConfig, hostToken: savedToken });

  document.getElementById("hostToken").value = "";
  document.getElementById("apiBaseUrl").value = "";

  const setConfigSpy = mock.method(agent, "setConfig", agent.setConfig);
  try {
    connectBtn.click();
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(setConfigSpy.mock.callCount(), 0);
    assert.equal((await agent.getConfig()).hostToken, savedToken);
    assert.equal(readForm().hostToken, "");
  } finally {
    setConfigSpy.mock.restore();
  }
});
