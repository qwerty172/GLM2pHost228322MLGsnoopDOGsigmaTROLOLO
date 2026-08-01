// Unit tests for limited-user launch (non-Windows paths + arg quoting).
import { test } from "node:test";
import assert from "node:assert/strict";

const { launchWithLimitedUser } = await import(
  "../dist/main/main/limited-user-launch.js"
);
const { parseArgs } = await import("../dist/main/main/app-launcher.js");

test("launchWithLimitedUser rejects non-Windows platforms", () => {
  if (process.platform === "win32") return;
  const result = launchWithLimitedUser(
    "C:\\Games\\game.exe",
    ["-fullscreen"],
    "C:\\Games",
    {
      enabled: true,
      username: "Player",
      password: "secret",
    },
  );
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /Windows-only/i);
});

test("launchWithLimitedUser rejects disabled credentials", () => {
  const result = launchWithLimitedUser(
    "C:\\Games\\game.exe",
    [],
    "C:\\Games",
    {
      enabled: false,
      username: "Player",
      password: "secret",
    },
  );
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /not configured/i);
});

test("launchWithLimitedUser rejects empty username/password", () => {
  const result = launchWithLimitedUser(
    "C:\\Games\\game.exe",
    [],
    "C:\\Games",
    {
      enabled: true,
      username: "",
      password: "",
    },
  );
  assert.equal(result.ok, false);
});

test("parseArgs respects quoted spans", () => {
  assert.deepEqual(parseArgs('-map "Custom Map.umap" -log'), [
    "-map",
    "Custom Map.umap",
    "-log",
  ]);
});

test("parseArgs handles escaped quotes", () => {
  assert.deepEqual(parseArgs(String.raw`-name \"Arena\"`), ["-name", '"Arena"']);
});
