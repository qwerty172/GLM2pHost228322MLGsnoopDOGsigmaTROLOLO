import { test } from "node:test";
import assert from "node:assert/strict";
import { setupRendererEnv } from "./helpers/renderer-env.mjs";

setupRendererEnv();
const { pathBasename, deriveSignalingUrl, readForm } = await import(
  "../dist/renderer/renderer/config.js"
);

test("pathBasename returns last path segment", () => {
  assert.equal(pathBasename("C:\\Games\\Foo\\bar.exe"), "bar.exe");
  assert.equal(pathBasename("/usr/games/bar"), "bar");
});

test("deriveSignalingUrl uses explicit override", () => {
  assert.equal(
    deriveSignalingUrl({
      apiBaseUrl: "https://api.example.com",
      signalingUrl: "wss://custom.example/signal",
    }),
    "wss://custom.example/signal",
  );
});

test("deriveSignalingUrl builds ws URL from apiBaseUrl", () => {
  assert.equal(
    deriveSignalingUrl({ apiBaseUrl: "https://api.example.com/", signalingUrl: "" }),
    "wss://api.example.com/api/signal",
  );
  assert.equal(
    deriveSignalingUrl({ apiBaseUrl: "http://localhost:3000", signalingUrl: "" }),
    "ws://localhost:3000/api/signal",
  );
});

test("readForm reads values from the settings form", () => {
  document.getElementById("hostToken").value = " tok ";
  document.getElementById("apiBaseUrl").value = "https://x.test";
  document.getElementById("ratePerMinute").value = "0.1";
  document.getElementById("commissionSplit").value = "1.5";
  document.getElementById("width").value = "1280";
  document.getElementById("height").value = "720";

  const cfg = readForm();
  assert.equal(cfg.hostToken, "tok");
  assert.equal(cfg.apiBaseUrl, "https://x.test");
  assert.equal(cfg.ratePerMinute, 0.1);
  assert.equal(cfg.commissionSplit, 1);
  assert.deepEqual(cfg.resolution, { width: 1280, height: 720 });
});
