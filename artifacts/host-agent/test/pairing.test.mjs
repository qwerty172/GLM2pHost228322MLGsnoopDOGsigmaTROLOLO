import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { setupRendererEnv, resetAgentConfig } from "./helpers/renderer-env.mjs";

setupRendererEnv();
const { pairingCard, submitPairingCode, initPairingFromDeepLink, handlePairingDeepLink } =
  await import("../dist/renderer/renderer/pairing.js");
const { session } = await import("../dist/renderer/renderer/state.js");

test("pairing module exposes pairing inputs inside troubleshoot panel", () => {
  assert.equal(pairingCard.id, "pairing-card-inner");
  assert.equal(document.getElementById("pairing-code").getAttribute("maxlength"), "6");
});

test("pairing code format requires exactly six digits", () => {
  const isValid = (code) => /^\d{6}$/.test(code.trim());
  assert.equal(isValid("123456"), true);
  assert.equal(isValid("abc"), false);
  assert.equal(isValid("12345"), false);
});

test("submitPairingCode is exported for dashboard deep-link auto bind (U-34)", () => {
  assert.equal(typeof submitPairingCode, "function");
});

test("initPairingFromDeepLink is exported for dashboard deep-link bootstrap (U-34)", () => {
  assert.equal(typeof initPairingFromDeepLink, "function");
});

test("initPairingFromDeepLink no-ops when agent has no pending pair code", async () => {
  const pairingCodeInput = document.getElementById("pairing-code");
  const pairingStatusEl = document.getElementById("pairing-status");
  pairingCodeInput.value = "999999";
  pairingStatusEl.textContent = "unchanged";

  const agent = window.agent;
  const origConsume = agent.consumePendingPairCode;
  agent.consumePendingPairCode = async () => null;

  try {
    await initPairingFromDeepLink();
    assert.equal(pairingCodeInput.value, "999999");
    assert.equal(pairingStatusEl.textContent, "unchanged");
  } finally {
    agent.consumePendingPairCode = origConsume;
  }
});

test("initPairingFromDeepLink auto-submits pending pair code from agent (U-34)", async () => {
  resetAgentConfig();
  const pairingCodeInput = document.getElementById("pairing-code");
  const pairingStatusEl = document.getElementById("pairing-status");

  const agent = window.agent;
  const origConsume = agent.consumePendingPairCode;
  agent.consumePendingPairCode = async () => "654321";

  const fetchRestore = mock.method(globalThis, "fetch", async (url) => {
    if (String(url).includes("/api/auth/agent-pair")) {
      return {
        ok: true,
        json: async () => ({ hostToken: "new-host-token", displayName: "Test Host" }),
      };
    }
    return { ok: false, json: async () => ({}) };
  });

  try {
    pairingCodeInput.value = "";
    pairingStatusEl.textContent = "";
    await initPairingFromDeepLink();
    assert.equal(pairingCodeInput.value, "");
    assert.match(pairingStatusEl.textContent, /Подключено/);
    assert.equal(document.getElementById("hostToken").value, "new-host-token");
  } finally {
    agent.consumePendingPairCode = origConsume;
    fetchRestore.mock.restore();
    if (session.libraryRefreshTimer) {
      clearInterval(session.libraryRefreshTimer);
      session.libraryRefreshTimer = null;
    }
    resetAgentConfig();
  }
});

test("handlePairingDeepLink uses api hint when pending URL was already consumed (M-266 race)", async () => {
  resetAgentConfig();
  const pairingCodeInput = document.getElementById("pairing-code");
  const pairingStatusEl = document.getElementById("pairing-status");
  const apiInput = document.getElementById("apiBaseUrl");

  const agent = window.agent;
  const origConsumeApi = agent.consumePendingApiBaseUrl;
  agent.consumePendingApiBaseUrl = async () => null;

  const fetchRestore = mock.method(globalThis, "fetch", async (url) => {
    if (String(url).includes("/api/auth/agent-pair")) {
      assert.equal(String(url).startsWith("https://platform.example.com"), true);
      return {
        ok: true,
        json: async () => ({ hostToken: "hint-host-token", displayName: "Hint Host" }),
      };
    }
    return { ok: false, json: async () => ({}) };
  });

  try {
    apiInput.value = "";
    pairingCodeInput.value = "";
    pairingStatusEl.textContent = "";
    await handlePairingDeepLink({
      apiBaseUrl: "https://platform.example.com",
      pairCode: "112233",
    });
    assert.equal(apiInput.value, "https://platform.example.com");
    assert.match(pairingStatusEl.textContent, /Подключено/);
    assert.equal(document.getElementById("hostToken").value, "hint-host-token");
  } finally {
    agent.consumePendingApiBaseUrl = origConsumeApi;
    fetchRestore.mock.restore();
    if (session.libraryRefreshTimer) {
      clearInterval(session.libraryRefreshTimer);
      session.libraryRefreshTimer = null;
    }
    resetAgentConfig();
  }
});
