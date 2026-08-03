import { test } from "node:test";
import assert from "node:assert/strict";
import { installRendererEnv, RENDERER_DIST } from "./helpers/renderer-env.mjs";

installRendererEnv();

const { refreshSteamAutoHost } = await import(new URL("steam-auto-host.js", RENDERER_DIST).href);
const { session } = await import(new URL("state.js", RENDERER_DIST).href);

test("refreshSteamAutoHost updates eligible items from API", async () => {
  session.steamGames = [
    {
      appId: "570",
      name: "Dota 2",
      bestExePath: "dota2.exe",
      alreadyInLibrary: false,
      catalogGame: null,
      installDir: "C:\\",
      fullInstallPath: "C:\\dota",
      isNewDiscovery: true,
    },
  ];
  globalThis.fetch = async (url, opts) => {
    assert.match(String(url), /steam-auto-hostable$/);
    assert.equal(opts.method, "POST");
    return {
      ok: true,
      json: async () => ({
        eligible: [{ gameId: "g-dota", title: "Dota 2", appPath: "dota2.exe" }],
      }),
    };
  };
  await refreshSteamAutoHost({
    hostToken: "token",
    apiBaseUrl: "https://api.example.com",
  });
  assert.equal(session.steamEligibleItems.length, 1);
  assert.equal(session.steamEligibleItems[0].gameId, "g-dota");
  const card = document.getElementById("auto-steam-card");
  assert.equal(card.hidden, false);
});
