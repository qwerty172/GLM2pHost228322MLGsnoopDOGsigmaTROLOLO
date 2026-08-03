import "../test/setup-renderer-dom.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";

const { escHtml } = await import("../dist/renderer/renderer/utils.js");
const { renderLibraryEntry } = await import("../dist/renderer/renderer/library.js");

test("renderLibraryEntry builds list item for browser game", () => {
  const li = renderLibraryEntry({
    gameId: "g1",
    enabled: true,
    boundUrl: "https://game.example.com",
    appPath: "",
    localAvailable: true,
    pricePerMinuteLzt: 5,
    lastError: "",
    game: { title: "Browser Game" },
  });
  assert.equal(li.dataset.gameId, "g1");
  assert.match(li.innerHTML, /Browser Game/);
  assert.ok(li.innerHTML.includes(escHtml("https://game.example.com")));
});

test("renderLibraryEntry marks disabled games", () => {
  const li = renderLibraryEntry({
    gameId: "g2",
    enabled: false,
    boundUrl: "",
    appPath: "C:\\game.exe",
    localAvailable: false,
    pricePerMinuteLzt: 3,
    lastError: "file_not_found",
    game: { title: "Offline Game" },
  });
  assert.match(li.innerHTML, /disabled/);
});
