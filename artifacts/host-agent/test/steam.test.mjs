import { test } from "node:test";
import assert from "node:assert/strict";
import { installRendererEnv, RENDERER_DIST } from "./helpers/renderer-env.mjs";

installRendererEnv();

const { recommendedCatalogGames } = await import(new URL("steam.js", RENDERER_DIST).href);
const { session } = await import(new URL("state.js", RENDERER_DIST).href);

test("recommendedCatalogGames filters catalog matches not yet in library", () => {
  session.steamGames = [
    {
      appId: "1",
      name: "In Catalog",
      alreadyInLibrary: false,
      catalogGame: { id: "g1", title: "Game 1", coverImageUrl: null },
      bestExePath: "game.exe",
      installDir: "C:\\",
      fullInstallPath: "C:\\game",
      isNewDiscovery: true,
    },
    {
      appId: "2",
      name: "Already Added",
      alreadyInLibrary: true,
      catalogGame: { id: "g2", title: "Game 2", coverImageUrl: null },
      bestExePath: "game2.exe",
      installDir: "C:\\",
      fullInstallPath: "C:\\game2",
      isNewDiscovery: false,
    },
  ];
  const recs = recommendedCatalogGames();
  assert.equal(recs.length, 1);
  assert.equal(recs[0].name, "In Catalog");
});
