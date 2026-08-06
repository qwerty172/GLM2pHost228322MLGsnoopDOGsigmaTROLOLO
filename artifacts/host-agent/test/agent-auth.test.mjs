import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { setupRendererEnv } from "./helpers/renderer-env.mjs";

setupRendererEnv();
const {
  initAgentKey,
  agentKeyStatusEl,
  fetchAgentKeyBound,
  tryAutoBindAgentKey,
  setConnectionTroubleshootVisible,
} = await import("../dist/renderer/renderer/agent-auth.js");

test("initAgentKey auto-binds when hostToken present", async () => {
  await initAgentKey();
  assert.match(agentKeyStatusEl.textContent, /привязан/i);
  assert.equal(document.getElementById("connection-troubleshoot").hidden, true);
  assert.match(document.getElementById("pc-specs-info").textContent, /Test CPU/);
  assert.equal(document.getElementById("bind-agent-key").disabled, false);
});

test("initAgentKey prefills bind code from URL hash", async () => {
  window.location.hash = "#bind=ABC123";
  await initAgentKey();
  assert.equal(document.getElementById("agentBindCode").value, "ABC123");
  window.location.hash = "";
});

test("fetchAgentKeyBound returns true when host reports agentKeyBound", async () => {
  const restore = mock.method(globalThis, "fetch", async (url) => ({
    ok: true,
    json: async () => ({ agentKeyBound: true }),
  }));
  try {
    assert.equal(
      await fetchAgentKeyBound("https://platform.example.com/", "host-token"),
      true,
    );
    assert.match(restore.mock.calls[0].arguments[0], /\/api\/hosts\/host-token$/);
  } finally {
    restore.mock.restore();
  }
});

test("fetchAgentKeyBound returns false on HTTP error or network failure", async () => {
  const httpRestore = mock.method(globalThis, "fetch", async () => ({ ok: false }));
  try {
    assert.equal(await fetchAgentKeyBound("https://platform.example.com", "bad"), false);
  } finally {
    httpRestore.mock.restore();
  }

  const netRestore = mock.method(globalThis, "fetch", async () => {
    throw new Error("network down");
  });
  try {
    assert.equal(await fetchAgentKeyBound("https://platform.example.com", "bad"), false);
  } finally {
    netRestore.mock.restore();
  }
});

test("tryAutoBindAgentKey skips empty credentials", async () => {
  assert.equal(await tryAutoBindAgentKey({ hostToken: "", apiBaseUrl: "" }), false);
  assert.equal(await tryAutoBindAgentKey({ hostToken: "tok", apiBaseUrl: "  " }), false);
});

test("tryAutoBindAgentKey returns true when key already bound", async () => {
  const restore = mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => ({ agentKeyBound: true }),
  }));
  try {
    assert.equal(
      await tryAutoBindAgentKey({
        hostToken: "host-token",
        apiBaseUrl: "https://platform.example.com",
      }),
      true,
    );
  } finally {
    restore.mock.restore();
  }
});

test("tryAutoBindAgentKey binds via agent when not yet bound", async () => {
  const fetchRestore = mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => ({ agentKeyBound: false }),
  }));
  const bindRestore = mock.method(window.agent, "bindAgentKey", async () => ({ ok: true }));
  try {
    assert.equal(
      await tryAutoBindAgentKey({
        hostToken: "host-token",
        apiBaseUrl: "https://platform.example.com",
      }),
      true,
    );
    assert.equal(bindRestore.mock.calls.length, 1);
  } finally {
    fetchRestore.mock.restore();
    bindRestore.mock.restore();
  }
});

test("tryAutoBindAgentKey returns false when bind fails", async () => {
  const fetchRestore = mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => ({ agentKeyBound: false }),
  }));
  const bindRestore = mock.method(window.agent, "bindAgentKey", async () => ({
    ok: false,
    error: "invalid key",
  }));
  try {
    assert.equal(
      await tryAutoBindAgentKey({
        hostToken: "host-token",
        apiBaseUrl: "https://platform.example.com",
      }),
      false,
    );
  } finally {
    fetchRestore.mock.restore();
    bindRestore.mock.restore();
  }
});

test("setConnectionTroubleshootVisible toggles details visibility", () => {
  const el = document.getElementById("connection-troubleshoot");
  el.hidden = true;
  el.open = true;

  setConnectionTroubleshootVisible(true);
  assert.equal(el.hidden, false);

  setConnectionTroubleshootVisible(false);
  assert.equal(el.hidden, true);
  assert.equal(el.open, false);
});
