import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
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

// --- main process config.ts (loadConfig, saveConfig, getCachedConfig, resetConfigCache) ---
let mainUserDataDir = mkdtempSync(path.join(tmpdir(), "main-config-user-"));
let mainAppDir = mkdtempSync(path.join(tmpdir(), "main-config-app-"));

const moduleLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return {
      app: {
        getPath: (key) => (key === "userData" ? mainUserDataDir : mainUserDataDir),
        getAppPath: () => mainAppDir,
      },
      safeStorage: {
        isEncryptionAvailable: () => false,
      },
    };
  }
  return moduleLoad.apply(this, arguments);
};

async function importMainConfig() {
  const url = new URL("../dist/main/main/config.js", import.meta.url);
  url.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return import(url.href);
}

const baseHostConfig = {
  hostToken: "",
  apiBaseUrl: "",
  signalingUrl: "",
  appPath: "",
  appArgs: "",
  appName: "",
  captureSourceName: "",
  ratePerMinute: 0.05,
  commissionSplit: 0.7,
  resolution: { width: 1920, height: 1080 },
  bitrateKbps: 6000,
  killAppOnDisconnect: false,
  autoLaunchAtStartup: true,
  autoQuotaEnabled: false,
  audioMode: "off",
};

test("main loadConfig returns defaults when no user config exists", async () => {
  mainUserDataDir = mkdtempSync(path.join(tmpdir(), "main-config-user-"));
  mainAppDir = mkdtempSync(path.join(tmpdir(), "main-config-app-"));

  const { loadConfig, resetConfigCache, getCachedConfig } = await importMainConfig();
  resetConfigCache();
  assert.equal(getCachedConfig(), null);

  const cfg = await loadConfig();
  assert.equal(cfg.hostToken, "");
  assert.equal(cfg.apiBaseUrl, "");
  assert.equal(getCachedConfig(), cfg);
});

test("main saveConfig persists config and getCachedConfig reflects cache", async () => {
  mainUserDataDir = mkdtempSync(path.join(tmpdir(), "main-config-user-"));
  mainAppDir = mkdtempSync(path.join(tmpdir(), "main-config-app-"));

  const { saveConfig, resetConfigCache, getCachedConfig } = await importMainConfig();
  resetConfigCache();

  const saved = await saveConfig({
    ...baseHostConfig,
    hostToken: "tok",
    apiBaseUrl: "https://api.test",
  });
  assert.equal(saved.hostToken, "tok");
  assert.equal(saved.apiBaseUrl, "https://api.test");
  assert.equal(getCachedConfig(), saved);

  const disk = JSON.parse(
    readFileSync(path.join(mainUserDataDir, "config.json"), "utf8"),
  );
  assert.equal(disk.hostToken, "tok");
  assert.equal(disk.apiBaseUrl, "https://api.test");
});

test("main resetConfigCache forces loadConfig to read disk again", async () => {
  mainUserDataDir = mkdtempSync(path.join(tmpdir(), "main-config-user-"));
  mainAppDir = mkdtempSync(path.join(tmpdir(), "main-config-app-"));
  writeFileSync(
    path.join(mainUserDataDir, "config.json"),
    JSON.stringify({ hostToken: "from-disk", apiBaseUrl: "https://disk.test" }, null, 2),
  );

  const { loadConfig, saveConfig, resetConfigCache, getCachedConfig } = await importMainConfig();
  resetConfigCache();
  const first = await loadConfig();
  assert.equal(first.hostToken, "from-disk");

  await saveConfig({ ...baseHostConfig, hostToken: "updated", apiBaseUrl: "https://updated.test" });
  assert.equal(getCachedConfig()?.hostToken, "updated");

  resetConfigCache();
  assert.equal(getCachedConfig(), null);
  const reloaded = await loadConfig();
  assert.equal(reloaded.hostToken, "updated");
  assert.equal(reloaded.apiBaseUrl, "https://updated.test");
});
