import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return {
      shell: { openExternal: async () => {} },
      desktopCapturer: { getSources: async () => [] },
    };
  }
  return load.apply(this, arguments);
};

const { launchTargetKey } = await import("../dist/main/main/app-launcher.js");

test("launchTargetKey prefers boundUrl over appPath", () => {
  assert.equal(
    launchTargetKey({
      boundUrl: "https://game.example/play",
      appPath: "C:\\Games\\game.exe",
    }),
    "url:https://game.example/play",
  );
});

test("launchTargetKey normalizes exe paths case-insensitively", () => {
  assert.equal(
    launchTargetKey({ appPath: "D:\\Steam\\MyGame.EXE" }),
    "exe:d:\\steam\\mygame.exe",
  );
});

test("launchTargetKey distinguishes different native games", () => {
  const a = launchTargetKey({ appPath: "C:\\A\\one.exe" });
  const b = launchTargetKey({ appPath: "C:\\B\\two.exe" });
  assert.notEqual(a, b);
});
