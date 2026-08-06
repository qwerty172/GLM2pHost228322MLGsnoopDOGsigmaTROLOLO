import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { setupRendererEnv } from "./helpers/renderer-env.mjs";

setupRendererEnv();
const {
  recommendedCatalogGames,
  renderGamePickerSteam,
  runSteamScan,
} = await import("../dist/renderer/renderer/steam.js");
const { session } = await import("../dist/renderer/renderer/state.js");
const {
  gamePickerSteam,
  gamePickerSteamList,
  gamePickerSteamTitle,
} = await import("../dist/renderer/renderer/dom.js");

function setHostForm({ hostToken, apiBaseUrl }) {
  document.getElementById("hostToken").value = hostToken ?? "";
  document.getElementById("apiBaseUrl").value = apiBaseUrl ?? "";
}

function catalogGame(name, id = "cg1") {
  return {
    appId: "1",
    name,
    installDir: "dir",
    fullInstallPath: "C:\\dir",
    alreadyInLibrary: false,
    catalogGame: {
      id,
      title: name,
      slug: name.toLowerCase(),
      coverImageUrl: "",
    },
    bestExePath: "C:\\game.exe",
    isNewDiscovery: true,
  };
}

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

test("renderGamePickerSteam hides picker when no catalog matches", () => {
  session.steamGames = [];
  renderGamePickerSteam();
  assert.equal(gamePickerSteam.hidden, true);
  assert.equal(gamePickerSteamList.children.length, 0);
});

test("renderGamePickerSteam lists catalog games with add buttons", () => {
  session.steamGames = [
    catalogGame("Dota 2", "cg-dota"),
    catalogGame("CS2", "cg-cs2"),
  ];
  renderGamePickerSteam();
  assert.equal(gamePickerSteam.hidden, false);
  assert.match(gamePickerSteamTitle.textContent, /2 игр/);
  assert.equal(gamePickerSteamList.children.length, 2);
  assert.match(gamePickerSteamList.textContent, /Dota 2/);
  assert.match(gamePickerSteamList.textContent, /Добавить и выбрать/);
});

test("runSteamScan returns early without host credentials", async () => {
  session.steamGames = [];
  session.steamScanInFlight = false;
  setHostForm({ hostToken: "", apiBaseUrl: "" });
  await runSteamScan();
  assert.equal(session.steamGames.length, 0);
  assert.equal(session.steamScanInFlight, false);
});

test("runSteamScan populates session from agent scanSteam", async () => {
  session.steamGames = [];
  session.steamScanInFlight = false;
  setHostForm({
    hostToken: "tok",
    apiBaseUrl: "https://api.example.com",
  });

  const scanned = [catalogGame("Portal 2", "cg-portal")];
  const restore = mock.method(window.agent, "scanSteam", async () => ({
    steamRoot: "C:\\Steam",
    games: scanned,
  }));

  try {
    await runSteamScan();
    assert.equal(session.steamGames.length, 1);
    assert.equal(session.steamGames[0].name, "Portal 2");
    assert.equal(session.steamScanInFlight, false);
    assert.equal(document.getElementById("badge-catalog").textContent, "1");
  } finally {
    restore.mock.restore();
  }
});
