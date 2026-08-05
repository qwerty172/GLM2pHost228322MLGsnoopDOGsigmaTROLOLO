import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

let userDataDir = mkdtempSync(path.join(tmpdir(), "bundled-config-user-"));
let appDir = mkdtempSync(path.join(tmpdir(), "bundled-config-app-"));

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return {
      app: {
        getPath: (key) => (key === "userData" ? userDataDir : userDataDir),
        getAppPath: () => appDir,
      },
      safeStorage: {
        isEncryptionAvailable: () => false,
      },
    };
  }
  return load.apply(this, arguments);
};

async function importConfig() {
  const url = new URL("../dist/main/main/config.js", import.meta.url);
  url.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return import(url.href);
}

test("loadConfig picks up apiBaseUrl from bundled config.json", async () => {
  userDataDir = mkdtempSync(path.join(tmpdir(), "bundled-config-user-"));
  appDir = mkdtempSync(path.join(tmpdir(), "bundled-config-app-"));
  writeFileSync(
    path.join(appDir, "config.json"),
    JSON.stringify({ apiBaseUrl: "https://platform.example.com" }, null, 2),
  );

  const { loadConfig, resetConfigCache } = await importConfig();
  resetConfigCache();
  const cfg = await loadConfig();
  assert.equal(cfg.apiBaseUrl, "https://platform.example.com");
});

test("loadConfig keeps user apiBaseUrl over bundled defaults", async () => {
  userDataDir = mkdtempSync(path.join(tmpdir(), "bundled-config-user-"));
  appDir = mkdtempSync(path.join(tmpdir(), "bundled-config-app-"));
  writeFileSync(
    path.join(appDir, "config.json"),
    JSON.stringify({ apiBaseUrl: "https://platform.example.com" }, null, 2),
  );
  writeFileSync(
    path.join(userDataDir, "config.json"),
    JSON.stringify({ hostToken: "tok", apiBaseUrl: "https://custom.example.com" }, null, 2),
  );

  const { loadConfig, resetConfigCache } = await importConfig();
  resetConfigCache();
  const cfg = await loadConfig();
  assert.equal(cfg.apiBaseUrl, "https://custom.example.com");
  assert.equal(cfg.hostToken, "tok");
});
