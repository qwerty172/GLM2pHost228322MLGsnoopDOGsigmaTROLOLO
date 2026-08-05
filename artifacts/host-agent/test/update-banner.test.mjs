import { test } from "node:test";
import assert from "node:assert/strict";
import { setupRendererEnv } from "./helpers/renderer-env.mjs";

setupRendererEnv();

const { initUpdateBanner } = await import("../dist/renderer/renderer/update-banner.js");

test("initUpdateBanner shows Russian banner and install button on update-ready", () => {
  let readyCb: (() => void) | null = null;
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

  readyCb?.();
  assert.equal(banner.hidden, false);

  btn.click();
  assert.equal(installCalled, true);
});
