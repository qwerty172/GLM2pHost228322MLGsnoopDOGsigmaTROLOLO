import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { setupRendererEnv } from "./helpers/renderer-env.mjs";

setupRendererEnv();
const { refreshSteamAutoHost } = await import("../dist/renderer/renderer/steam-auto-host.js");
const { session } = await import("../dist/renderer/renderer/state.js");

test("refreshSteamAutoHost populates eligible items from API", async () => {
  session.steamGames = [
    { appId: "570", name: "Dota 2", bestExePath: "C:\\dota.exe", catalogGame: null, alreadyInLibrary: false, isNewDiscovery: false },
  ];

  const restore = mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => ({
      eligible: [{ gameId: "g-dota", title: "Dota 2", appPath: "C:\\dota.exe" }],
    }),
  }));

  try {
    await refreshSteamAutoHost({
      hostToken: "tok",
      apiBaseUrl: "https://api.example.com",
    });
    assert.equal(session.steamEligibleItems.length, 1);
    assert.equal(session.steamEligibleItems[0].title, "Dota 2");
    assert.equal(document.getElementById("auto-steam-card").hidden, false);
  } finally {
    restore.mock.restore();
  }
});
