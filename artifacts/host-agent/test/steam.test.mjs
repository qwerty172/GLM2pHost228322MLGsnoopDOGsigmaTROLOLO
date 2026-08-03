import "../test/setup-renderer-dom.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";

const { recommendedCatalogGames } = await import("../dist/renderer/renderer/steam.js");
const { session } = await import("../dist/renderer/renderer/state.js");

test("recommendedCatalogGames filters catalog matches not in library", () => {
  session.steamGames = [
    { appId: "1", name: "A", alreadyInLibrary: false, catalogGame: { id: "g1" } },
    { appId: "2", name: "B", alreadyInLibrary: true, catalogGame: { id: "g2" } },
    { appId: "3", name: "C", alreadyInLibrary: false, catalogGame: null },
  ];
  const recs = recommendedCatalogGames();
  assert.equal(recs.length, 1);
  assert.equal(recs[0].name, "A");
});

test("recommendedCatalogGames returns empty when no steam games", () => {
  session.steamGames = [];
  assert.deepEqual(recommendedCatalogGames(), []);
});
