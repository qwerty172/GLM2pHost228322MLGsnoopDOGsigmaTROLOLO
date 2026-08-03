import { test } from "node:test";
import assert from "node:assert/strict";
import { setupRendererEnv } from "./helpers/renderer-env.mjs";

setupRendererEnv();
const { renderLibraryEntry } = await import("../dist/renderer/renderer/library.js");

test("renderLibraryEntry renders enabled local game", () => {
  const li = renderLibraryEntry({
    gameId: "g1",
    game: { id: "g1", title: "Test Game" },
    enabled: true,
    localAvailable: true,
    appPath: "C:\\Games\\test.exe",
    boundUrl: "",
    pricePerMinuteLzt: 5,
    lastError: "",
  });
  assert.equal(li.dataset.gameId, "g1");
  assert.match(li.textContent, /Test Game/);
  assert.match(li.textContent, /5 LZT\/min/);
  assert.match(li.textContent, /ready/);
});

test("renderLibraryEntry marks browser games with URL", () => {
  const li = renderLibraryEntry({
    gameId: "g2",
    game: { id: "g2", title: "Browser Game" },
    enabled: true,
    localAvailable: true,
    appPath: "",
    boundUrl: "https://shellshock.io",
    pricePerMinuteLzt: 3,
    lastError: "",
  });
  assert.match(li.textContent, /shellshock\.io/);
});
