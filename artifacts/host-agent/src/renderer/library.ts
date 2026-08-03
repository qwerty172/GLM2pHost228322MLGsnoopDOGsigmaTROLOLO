import type { HostConfig, LibraryEntry, SteamScanGame } from "../shared/messages";
import { gamePickerCard, gamePickerHint, libraryCard, libraryList, libraryStatus, selectedGameSelect, connectBtn } from "./dom.js";
import { readForm, pathBasename } from "./config.js";
import { session } from "./state.js";
import { log } from "./ui.js";
import { escHtml } from "./utils.js";
import { renderGamePickerSteam, recommendedCatalogGames, runSteamScan } from "./steam.js";

export function renderLibraryEntry(entry: LibraryEntry): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "library-entry";
  li.dataset["gameId"] = entry.gameId;

  const isBrowser = !!entry.boundUrl;
  const isAvailable = !entry.appPath || entry.localAvailable; // browser games always "available"
  const statusIcon = !entry.enabled
    ? "⏸️"
    : isAvailable
      ? "✅"
      : "❌";
  const statusLabel = !entry.enabled
    ? "disabled"
    : isAvailable
      ? "ready"
      : `not found (${entry.lastError || "file_not_found"})`;

  const priceLabel = `🔵 ${entry.pricePerMinuteLzt} LZT/min`;

  li.innerHTML = `
    <div class="library-entry-header">
      <span class="library-entry-icon">${statusIcon}</span>
      <span class="library-entry-title">${escHtml(entry.game.title)}</span>
      <span class="library-entry-price">${priceLabel}</span>
      <span class="library-entry-status muted">${statusLabel}</span>
    </div>
    <div class="library-entry-path muted">
      ${isBrowser ? `🌐 ${escHtml(entry.boundUrl)}` : escHtml(entry.appPath || "(no path set)")}
    </div>
    <div class="library-entry-actions"></div>
  `;

  const actionsDiv = li.querySelector<HTMLDivElement>(".library-entry-actions")!;

  if (!isBrowser && entry.appPath) {
    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.textContent = "Open in Explorer";
    openBtn.addEventListener("click", () => {
      window.agent.openExplorer(entry.appPath);
    });
    actionsDiv.appendChild(openBtn);
  }

  if (!isBrowser) {
    const changeBtn = document.createElement("button");
    changeBtn.type = "button";
    changeBtn.textContent = "Change path…";
    changeBtn.addEventListener("click", async () => {
      const picked = await window.agent.openFileDialog();
      if (!picked) return;
      const cfg = readForm();
      if (!cfg.hostToken || !cfg.apiBaseUrl) {
        log("Set host token and platform URL before changing game path.");
        return;
      }
      changeBtn.disabled = true;
      try {
        const resp = await fetch(
          `${cfg.apiBaseUrl.replace(/\/$/, "")}/api/hosts/${encodeURIComponent(cfg.hostToken)}/library/${encodeURIComponent(entry.gameId)}`,
          {
            method: "PATCH",
            headers: {
              "content-type": "application/json",
              "x-host-token": cfg.hostToken,
            },
            body: JSON.stringify({ appPath: picked }),
          },
        );
        if (!resp.ok) {
          log(`Failed to update path (${resp.status}).`);
          return;
        }
        log(`Updated ${entry.game.title} path → ${pathBasename(picked)}`);
        await window.agent.patchLibraryAvailability(
          cfg.hostToken,
          cfg.apiBaseUrl,
          entry.gameId,
          true,
          "",
        );
        await loadLibrary(cfg);
      } catch (err) {
        log(`Change path error: ${String(err)}`);
      } finally {
        changeBtn.disabled = false;
      }
    });
    actionsDiv.appendChild(changeBtn);
  }

  return li;
}

export function renderLibrary(entries: LibraryEntry[]): void {
  libraryList.innerHTML = "";
  if (entries.length === 0) {
    libraryStatus.textContent =
      "В библиотеке пусто. Добавь игры с дашборда или из рекомендаций Steam.";
    selectedGameSelect.innerHTML = '<option value="">— выбери игру —</option>';
    renderGamePickerSteam();
    return;
  }
  const enabled = entries.filter((e) => e.enabled);
  const disabled = entries.filter((e) => !e.enabled);
  libraryStatus.textContent = `${enabled.length} enabled game${enabled.length !== 1 ? "s" : ""} · ${disabled.length} disabled`;

  for (const entry of entries) {
    libraryList.appendChild(renderLibraryEntry(entry));
  }

  // Populate game picker dropdown
  selectedGameSelect.innerHTML = '<option value="">— выбери игру —</option>';
  for (const entry of enabled) {
    const isBrowser = !!entry.boundUrl;
    const isAvail = isBrowser || entry.localAvailable;
    const opt = document.createElement("option");
    opt.value = entry.gameId;
    opt.textContent = `${entry.game.title} · 🔵${entry.pricePerMinuteLzt} LZT/min${isAvail ? "" : " ⚠️ не найдена"}`;
    opt.disabled = !isAvail;
    selectedGameSelect.appendChild(opt);
  }
  renderGamePickerSteam();
}


export async function showHostGamePicker(): Promise<void> {
  // Ensure Steam recommendations are fresh enough for the quick picker.
  if (
    window.agent.platform === "win32" &&
    session.steamGames.length === 0 &&
    !session.steamScanInFlight
  ) {
    await runSteamScan({ openModal: false });
  }
  const enabledLibGames = session.libraryEntries.filter(
    (e) => e.enabled && (e.boundUrl || e.localAvailable),
  );
  const steamRecs = recommendedCatalogGames();
  renderGamePickerSteam();

  if (enabledLibGames.length === 0 && steamRecs.length === 0) {
    gamePickerHint.textContent =
      "В библиотеке пусто и нет совпадений Steam с каталогом. Добавь игру на сайте или через «Сканировать Steam».";
  } else if (enabledLibGames.length === 0) {
    gamePickerHint.textContent =
      "Библиотека пуста — выбери игру из Steam ниже (добавить и выбрать), затем выйди в онлайн.";
  } else {
    gamePickerHint.textContent =
      "Выбери игру из библиотеки или быстро добавь из Steam.";
  }

  gamePickerCard.hidden = false;
  connectBtn.disabled = true;
}

export async function loadLibrary(cfg: HostConfig): Promise<void> {
  if (!cfg.hostToken || !cfg.apiBaseUrl) return;
  libraryCard.hidden = false;
  libraryStatus.textContent = "Loading…";
  try {
    const entries = await window.agent.fetchLibrary(cfg.hostToken, cfg.apiBaseUrl);
    session.libraryEntries = entries;
    renderLibrary(entries);
    log(`Library loaded: ${entries.length} game(s).`);
  } catch (err) {
    libraryStatus.textContent = "Failed to load library.";
    log(`Library load error: ${String(err)}`);
  }
}

export function startLibraryPolling(cfg: HostConfig): void {
  stopLibraryPolling();
  session.libraryRefreshTimer = setInterval(() => {
    void loadLibrary(cfg);
  }, 5 * 60 * 1000); // every 5 min
}

function stopLibraryPolling(): void {
  if (session.libraryRefreshTimer) {
    clearInterval(session.libraryRefreshTimer);
    session.libraryRefreshTimer = null;
  }
}