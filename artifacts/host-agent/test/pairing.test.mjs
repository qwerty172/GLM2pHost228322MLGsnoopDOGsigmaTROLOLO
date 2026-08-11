import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { setupRendererEnv, resetAgentConfig, defaultHostConfig } from "./helpers/renderer-env.mjs";

setupRendererEnv();
const { pairingCard, submitPairingCode, initPairingFromDeepLink } = await import(
  "../dist/renderer/renderer/pairing.js"
);
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

test("submitPairingCode overwrites stale apiBaseUrl from dashboard deep link (U-34)", async () => {
  resetAgentConfig();
  defaultHostConfig.apiBaseUrl = "https://staging.example.com";
  defaultHostConfig.hostToken = "";

  const pairingCodeInput = document.getElementById("pairing-code");
  const apiBaseUrlInput = document.getElementById("apiBaseUrl");
  apiBaseUrlInput.value = "https://staging.example.com";

  const agent = window.agent;
  const origConsumeApi = agent.consumePendingApiBaseUrl;
  agent.consumePendingApiBaseUrl = async () => "https://production.example.com";

  let pairUrl = "";
  const fetchRestore = mock.method(globalThis, "fetch", async (url) => {
    pairUrl = String(url);
    if (pairUrl.includes("/api/auth/agent-pair")) {
      return {
        ok: true,
        json: async () => ({ hostToken: "prod-host-token", displayName: "Prod Host" }),
      };
    }
    return { ok: false, json: async () => ({}) };
  });

  try {
    await submitPairingCode("112233");
    assert.equal(pairUrl, "https://production.example.com/api/auth/agent-pair");
    assert.equal(defaultHostConfig.apiBaseUrl, "https://production.example.com");
    assert.equal(document.getElementById("hostToken").value, "prod-host-token");
  } finally {
    agent.consumePendingApiBaseUrl = origConsumeApi;
    fetchRestore.mock.restore();
    resetAgentConfig();
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
