import { test } from "node:test";
import assert from "node:assert/strict";
import { setupRendererEnv, defaultHostConfig } from "./helpers/renderer-env.mjs";

setupRendererEnv();
const {
  renderLibraryEntry,
  renderLibrary,
  showHostGamePicker,
  loadLibrary,
  startLibraryPolling,
} = await import("../dist/renderer/renderer/library.js");
const { session } = await import("../dist/renderer/renderer/state.js");
const {
  libraryList,
  libraryStatus,
  libraryCard,
  gamePickerCard,
  gamePickerHint,
  selectedGameSelect,
  connectBtn,
} = await import("../dist/renderer/renderer/dom.js");

const sampleEntry = {
  gameId: "g1",
  game: { id: "g1", title: "Test Game" },
  enabled: true,
  localAvailable: true,
  appPath: "C:\\Games\\test.exe",
  boundUrl: "",
  pricePerMinuteLzt: 5,
  lastError: "",
};

test("renderLibraryEntry renders enabled local game", () => {
  const li = renderLibraryEntry(sampleEntry);
  assert.equal(li.dataset.gameId, "g1");
  assert.match(li.textContent, /Test Game/);
  assert.match(li.textContent, /5 LZT\/min/);
  assert.match(li.textContent, /готова/);
});

test("renderLibraryEntry marks browser games with URL", () => {
  const li = renderLibraryEntry({
    ...sampleEntry,
    gameId: "g2",
    game: { id: "g2", title: "Browser Game" },
    appPath: "",
    boundUrl: "https://shellshock.io",
    pricePerMinuteLzt: 3,
  });
  assert.match(li.textContent, /shellshock\.io/);
});

test("renderLibrary shows empty state", () => {
  renderLibrary([]);
  assert.match(libraryStatus.textContent, /В библиотеке пусто/);
  assert.equal(libraryList.children.length, 0);
});

test("renderLibrary lists entries and populates game picker", () => {
  renderLibrary([
    sampleEntry,
    {
      ...sampleEntry,
      gameId: "g2",
      game: { id: "g2", title: "Disabled Game" },
      enabled: false,
      localAvailable: false,
    },
  ]);
  assert.match(libraryStatus.textContent, /1 включено · 1 выключено/);
  assert.equal(libraryList.children.length, 2);
  assert.equal(selectedGameSelect.options.length, 2);
});

test("loadLibrary returns early without host token", async () => {
  session.libraryEntries = [sampleEntry];
  await loadLibrary({ ...defaultHostConfig, hostToken: "" });
  assert.equal(session.libraryEntries.length, 1);
});

test("loadLibrary fetches entries and renders library", async () => {
  const entries = [
    {
      ...sampleEntry,
      game: { id: "g1", title: "Loaded Game" },
    },
  ];
  window.agent.fetchLibrary = async () => entries;
  libraryCard.hidden = true;

  await loadLibrary(defaultHostConfig);

  assert.equal(libraryCard.hidden, false);
  assert.deepEqual(session.libraryEntries, entries);
  assert.match(libraryStatus.textContent, /1 включено/);
  assert.equal(libraryList.querySelectorAll("li").length, 1);
});

test("showHostGamePicker reveals picker and disables connect", async () => {
  session.libraryEntries = [sampleEntry];
  session.steamGames = [{ appId: "1", name: "Steam", alreadyInLibrary: false, catalogGame: null, bestExePath: null, isNewDiscovery: false }];
  gamePickerCard.hidden = true;
  connectBtn.disabled = false;

  await showHostGamePicker();

  assert.equal(gamePickerCard.hidden, false);
  assert.equal(connectBtn.disabled, true);
  assert.match(gamePickerHint.textContent, /Выбери игру из библиотеки/);
});

test("startLibraryPolling replaces existing refresh timer", () => {
  const oldTimer = setInterval(() => {}, 10_000);
  session.libraryRefreshTimer = oldTimer;

  startLibraryPolling(defaultHostConfig);

  assert.notEqual(session.libraryRefreshTimer, oldTimer);
  assert.ok(session.libraryRefreshTimer);

  clearInterval(session.libraryRefreshTimer);
  session.libraryRefreshTimer = null;
});
