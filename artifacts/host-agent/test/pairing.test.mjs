import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { setupRendererEnv, resetAgentConfig, defaultHostConfig } from "./helpers/renderer-env.mjs";

setupRendererEnv();
const { pairingCard, submitPairingCode, initPairingFromDeepLink } = await import(
  "../dist/renderer/renderer/pairing.js"
);
const { session } = await import("../dist/renderer/renderer/state.js");
const { agentKeyStatusEl } = await import("../dist/renderer/renderer/agent-auth.js");

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

test("submitPairingCode binds agent key after pairing saves hostToken", async () => {
  resetAgentConfig();
  Object.assign(defaultHostConfig, { hostToken: "", apiBaseUrl: "" });

  const agent = window.agent;
  const bindCalls = [];
  const origBind = agent.bindAgentKey;
  agent.bindAgentKey = async (...args) => {
    bindCalls.push(args);
    return { ok: true };
  };

  const fetchRestore = mock.method(globalThis, "fetch", async (url) => {
    if (String(url).includes("/api/auth/agent-pair")) {
      return {
        ok: true,
        json: async () => ({ hostToken: "paired-host-token", displayName: "Paired Host" }),
      };
    }
    if (String(url).includes("/api/hosts/")) {
      return {
        ok: true,
        json: async () => ({ agentKeyBound: false }),
      };
    }
    return { ok: false, json: async () => ({}) };
  });

  try {
    document.getElementById("apiBaseUrl").value = "https://platform.example.com";
    await submitPairingCode("112233");
    assert.equal(bindCalls.length, 1);
    assert.equal(bindCalls[0][0], "paired-host-token");
    assert.match(agentKeyStatusEl.textContent, /привязан/i);
  } finally {
    agent.bindAgentKey = origBind;
    fetchRestore.mock.restore();
    if (session.libraryRefreshTimer) {
      clearInterval(session.libraryRefreshTimer);
      session.libraryRefreshTimer = null;
    }
    resetAgentConfig();
  }
});
