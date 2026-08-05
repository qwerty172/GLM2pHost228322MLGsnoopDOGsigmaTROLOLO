import { test } from "node:test";
import assert from "node:assert/strict";
import { setupRendererEnv } from "./helpers/renderer-env.mjs";

setupRendererEnv();

const { initUpdateBanner } = await import("../dist/renderer/renderer/update-banner.js");

test("initUpdateBanner shows Russian banner and install button on update-ready", () => {
  let readyCb = null;
  window.agent.onUpdateReady = (cb) => {
    readyCb = cb;
    return () => {
      readyCb = null;
    };
  };
  let installCalled = false;
  window.agent.installUpdate = async () => {
    installCalled = true;
  };

  initUpdateBanner();

  const banner = document.getElementById("update-ready-banner");
  const btn = document.getElementById("update-install-btn");
  assert.ok(banner);
  assert.ok(btn);
  assert.equal(banner.hidden, true);
  assert.match(banner.querySelector(".update-ready-text").textContent, /Обновление готово/);
  assert.equal(btn.textContent, "Перезапустить и обновить");

  readyCb();
  assert.equal(banner.hidden, false);

  btn.click();
  assert.equal(installCalled, true);
});

test("initUpdateBanner ends active session before installing update", async () => {
  const { session } = await import("../dist/renderer/renderer/state.js");
  session.currentSessionId = "sess-active";
  session.isStreaming = true;
  session.currentConfig = {
    hostToken: "test-host-token",
    apiBaseUrl: "https://platform.example.com",
  };
  session.activeSaveSyncContext = null;
  session.ws = null;
  session.pc = null;
  session.captureStream = null;

  let installCalled = false;
  let sessionClearedBeforeInstall = false;

  window.agent.onUpdateReady = (cb) => {
    cb();
    return () => {};
  };
  window.agent.installUpdate = async () => {
    sessionClearedBeforeInstall = session.currentSessionId === null;
    installCalled = true;
  };
  window.agent.saveSyncPush = async () => ({ ok: true, skipped: true });
  window.agent.clearInputGuard = async () => {};
  window.agent.clearInputBlock = () => {};
  window.agent.setCaptureSource = () => {};
  window.agent.disconnectGamepad = () => {};

  globalThis.fetch = async (url, opts) => {
    if (opts?.method === "PATCH") return { ok: true };
    return { ok: false, async json() { return {}; } };
  };

  initUpdateBanner();
  document.getElementById("update-install-btn").click();

  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(installCalled, true);
  assert.equal(sessionClearedBeforeInstall, true);
  assert.equal(session.isStreaming, false);
});
