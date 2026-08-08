import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { setupRendererEnv, resetAgentConfig } from "./helpers/renderer-env.mjs";

setupRendererEnv();
const { pairingCard, submitPairingCode, initPairingFromDeepLink, agentAlreadyHasHostToken } =
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

test("agentAlreadyHasHostToken is exported for deep-link guard", () => {
  assert.equal(typeof agentAlreadyHasHostToken, "function");
});

test("agentAlreadyHasHostToken returns true when hostToken is configured", async () => {
  resetAgentConfig();
  const agent = window.agent;
  const origGet = agent.getConfig;
  agent.getConfig = async () => ({ hostToken: "existing-token", apiBaseUrl: "https://x.test" });
  try {
    assert.equal(await agentAlreadyHasHostToken(), true);
  } finally {
    agent.getConfig = origGet;
    resetAgentConfig();
  }
});

test("initPairingFromDeepLink skips auto-pair when hostToken already set (deep-link hijack guard)", async () => {
  resetAgentConfig();
  const pairingCodeInput = document.getElementById("pairing-code");
  const pairingStatusEl = document.getElementById("pairing-status");

  const agent = window.agent;
  const origGet = agent.getConfig;
  const origConsume = agent.consumePendingPairCode;
  agent.getConfig = async () => ({ hostToken: "victim-token", apiBaseUrl: "https://platform.example.com" });
  agent.consumePendingPairCode = async () => "111111";

  const fetchRestore = mock.method(globalThis, "fetch", async () => {
    throw new Error("fetch must not run when hostToken already configured");
  });

  try {
    pairingCodeInput.value = "";
    pairingStatusEl.textContent = "";
    await initPairingFromDeepLink();
    assert.equal(pairingCodeInput.value, "");
    assert.equal(pairingStatusEl.textContent, "");
    assert.equal(fetchRestore.mock.callCount(), 0);
  } finally {
    agent.getConfig = origGet;
    agent.consumePendingPairCode = origConsume;
    fetchRestore.mock.restore();
    resetAgentConfig();
  }
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
  const origGet = agent.getConfig;
  agent.consumePendingPairCode = async () => "654321";
  agent.getConfig = async () => ({ hostToken: "", apiBaseUrl: "https://platform.example.com" });

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
    agent.getConfig = origGet;
    fetchRestore.mock.restore();
    if (session.libraryRefreshTimer) {
      clearInterval(session.libraryRefreshTimer);
      session.libraryRefreshTimer = null;
    }
    resetAgentConfig();
  }
});
