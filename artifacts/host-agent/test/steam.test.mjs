import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installRendererDom } from "./helpers/dom-setup.mjs";

let recommendedCatalogGames;
let session;

before(async () => {
  installRendererDom();
  ({ recommendedCatalogGames } = await import("../dist/renderer/renderer/steam.js"));
  ({ session } = await import("../dist/renderer/renderer/state.js"));
});

test("recommendedCatalogGames filters library matches", () => {
  session.steamGames = [
    { appId: "1", name: "A", alreadyInLibrary: false, catalogGame: { id: "c1" } },
    { appId: "2", name: "B", alreadyInLibrary: true, catalogGame: { id: "c2" } },
    { appId: "3", name: "C", alreadyInLibrary: false, catalogGame: null },
  ];
  const recs = recommendedCatalogGames();
  assert.equal(recs.length, 1);
  assert.equal(recs[0].appId, "1");
});
