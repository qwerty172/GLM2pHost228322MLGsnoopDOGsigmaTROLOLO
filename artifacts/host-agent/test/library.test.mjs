import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installRendererDom } from "./helpers/dom-setup.mjs";

let renderLibraryEntry;
let escHtml;

before(async () => {
  installRendererDom();
  ({ renderLibraryEntry } = await import("../dist/renderer/renderer/library.js"));
  ({ escHtml } = await import("../dist/renderer/renderer/utils.js"));
});

test("renderLibraryEntry builds list item with escaped title", () => {
  const li = renderLibraryEntry({
    gameId: "g1",
    game: { title: "<Hack>", id: "g1" },
    enabled: true,
    localAvailable: true,
    appPath: "C:\\game.exe",
    boundUrl: null,
    pricePerMinuteLzt: 5,
    lastError: null,
  });
  assert.equal(li.dataset.gameId, "g1");
  assert.ok(li.innerHTML.includes(escHtml("<Hack>")));
});
