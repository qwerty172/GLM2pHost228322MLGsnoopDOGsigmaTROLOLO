import { test } from "node:test";
import assert from "node:assert/strict";
import { setupRendererEnv } from "./helpers/renderer-env.mjs";

setupRendererEnv();
const { recommendedCatalogGames } = await import("../dist/renderer/renderer/steam.js");
const { session } = await import("../dist/renderer/renderer/state.js");

test("recommendedCatalogGames returns catalog matches not yet in library", () => {
  session.steamGames = [
    {
      appId: "1",
      name: "In Catalog",
      alreadyInLibrary: false,
      catalogGame: { id: "cg1", title: "In Catalog" },
      bestExePath: "C:\\a.exe",
      isNewDiscovery: false,
    },
    {
      appId: "2",
      name: "Already Added",
      alreadyInLibrary: true,
      catalogGame: { id: "cg2", title: "Already Added" },
      bestExePath: null,
      isNewDiscovery: false,
    },
    {
      appId: "3",
      name: "Not In Catalog",
      alreadyInLibrary: false,
      catalogGame: null,
      bestExePath: null,
      isNewDiscovery: false,
    },
  ];

  const recs = recommendedCatalogGames();
  assert.equal(recs.length, 1);
  assert.equal(recs[0].name, "In Catalog");
});
