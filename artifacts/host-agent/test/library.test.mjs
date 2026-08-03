import { test } from "node:test";
import assert from "node:assert/strict";
import { installRendererEnv, RENDERER_DIST } from "./helpers/renderer-env.mjs";

installRendererEnv();

const { renderLibraryEntry } = await import(new URL("library.js", RENDERER_DIST).href);

test("renderLibraryEntry builds list item with escaped title", () => {
  const li = renderLibraryEntry({
    gameId: "g1",
    game: { id: "g1", title: "<Danger>", steamAppId: null },
    enabled: true,
    localAvailable: true,
    appPath: "C:\\Games\\safe.exe",
    boundUrl: "",
    pricePerMinuteLzt: 5,
    lastError: null,
  });
  assert.equal(li.dataset.gameId, "g1");
  assert.match(li.innerHTML, /&lt;Danger&gt;/);
  assert.ok(li.querySelector(".library-entry-title"));
});
