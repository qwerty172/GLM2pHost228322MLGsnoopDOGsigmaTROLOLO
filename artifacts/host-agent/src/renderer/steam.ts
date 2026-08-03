import type { HostConfig, SteamScanGame } from "../shared/messages";
import {
  $,
  gamePickerSteam,
  gamePickerSteamList,
  gamePickerSteamTitle,
  selectedGameSelect,
} from "./dom.js";
import { readForm } from "./config.js";
import { loadLibrary } from "./library.js";
import { session } from "./state.js";
import { log } from "./ui.js";
import { refreshSteamAutoHost } from "./steam-auto-host.js";

export function renderGamePickerSteam(): void {
  const recs = recommendedCatalogGames().slice(0, 8);
  if (recs.length === 0) {
    gamePickerSteam.hidden = true;
    gamePickerSteamList.innerHTML = "";
    return;
  }
  gamePickerSteam.hidden = false;
  gamePickerSteamTitle.textContent =
    `Быстро из Steam — ${recs.length} игр${recs.length === 1 ? "а" : ""} уже в каталоге, можно добавить и хостить:`;
  gamePickerSteamList.innerHTML = "";
  for (const game of recs) {
    const li = document.createElement("li");
    li.className = "library-item";
    li.style.display = "flex";
    li.style.alignItems = "center";
    li.style.justifyContent = "space-between";
    li.style.gap = "8px";
    const name = document.createElement("span");
    name.textContent = game.name + (game.bestExePath ? "" : " (exe?)");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Добавить и выбрать";
    btn.style.flexShrink = "0";
    btn.addEventListener("click", () => {
      void addSteamGameAndSelect(game);
    });
    li.appendChild(name);
    li.appendChild(btn);
    gamePickerSteamList.appendChild(li);
  }
}

async function addSteamGameAndSelect(game: SteamScanGame): Promise<void> {
  const cfg = readForm();
  if (!cfg.hostToken || !cfg.apiBaseUrl || !game.catalogGame) return;
  const base = cfg.apiBaseUrl.replace(/\/$/, "");
  try {
    const resp = await fetch(
      `${base}/api/hosts/${encodeURIComponent(cfg.hostToken)}/library`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-host-token": cfg.hostToken,
        },
        body: JSON.stringify({
          gameId: game.catalogGame.id,
          pricePerMinuteLzt: 5,
          appPath: game.bestExePath ?? "",
        }),
      },
    );
    if (!resp.ok && resp.status !== 409) {
      log(`Не удалось добавить ${game.name} (${resp.status}).`);
      return;
    }
    try {
      await window.agent.markSteamGamesAdded([game.appId]);
    } catch {
      /* ignore */
    }
    game.alreadyInLibrary = true;
    log(`«${game.name}» добавлена в библиотеку.`);
    await loadLibrary(cfg);
    selectedGameSelect.value = game.catalogGame.id;
    renderSteamRecommendations();
    renderGamePickerSteam();
  } catch (err) {
    log(`Ошибка добавления ${game.name}: ${String(err)}`);
  }
}

const scanSteamBtn = $("scan-steam") as HTMLButtonElement;
const steamModal = $("steam-modal") as HTMLDivElement;
const steamModalClose = $("steam-modal-close") as HTMLButtonElement;
const steamScanProgress = $("steam-scan-progress") as HTMLDivElement;
const steamScanError = $("steam-scan-error") as HTMLDivElement;
const steamScanErrorText = $("steam-scan-error-text") as HTMLParagraphElement;
const steamScanResults = $("steam-scan-results") as HTMLDivElement;
const steamScanSummary = $("steam-scan-summary") as HTMLParagraphElement;
const steamGameList = $("steam-game-list") as HTMLDivElement;
const steamAddLibraryBtn = $("steam-add-library") as HTMLButtonElement;
const steamSubmitReviewBtn = $("steam-submit-review") as HTMLButtonElement;
const steamSelectAll = $("steam-select-all") as HTMLInputElement;
const steamDeltaMode = $("steam-delta-mode") as HTMLInputElement;
const badgeCatalog = $("badge-catalog") as HTMLSpanElement;
const badgeNew = $("badge-new") as HTMLSpanElement;
const badgeAdded = $("badge-added") as HTMLSpanElement;

// Show scan button on Windows only.
if (window.agent.platform === "win32") {
  scanSteamBtn.hidden = false;
}

type SteamTab = "catalog" | "new" | "added";
const steamCheckboxMap = new Map<string, HTMLInputElement>();
const steamRecommendChecks = new Map<string, HTMLInputElement>();

// When delta mode is on, only show games that are newly discovered this scan.
function isDeltaActive(): boolean {
  return !session.steamIsFirstScan && steamDeltaMode.checked;
}

function steamGamesForTab(tab: SteamTab): SteamScanGame[] {
  const delta = isDeltaActive();
  if (tab === "added") return session.steamGames.filter((g) => g.alreadyInLibrary && (!delta || g.isNewDiscovery));
  if (tab === "catalog") return session.steamGames.filter((g) => !g.alreadyInLibrary && g.catalogGame !== null && (!delta || g.isNewDiscovery));
  return session.steamGames.filter((g) => !g.alreadyInLibrary && g.catalogGame === null && (!delta || g.isNewDiscovery));
}

function renderSteamTab(tab: SteamTab): void {
  session.currentSteamTab = tab;
  steamCheckboxMap.clear();
  steamSelectAll.checked = false;

  // Update tab active states.
  document.querySelectorAll<HTMLButtonElement>(".steam-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset["tab"] === tab);
  });

  const games = steamGamesForTab(tab);
  steamGameList.innerHTML = "";

  if (games.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.style.padding = "16px 0";
    empty.textContent =
      tab === "catalog"
        ? "No installed Steam games found in the platform catalog."
        : tab === "new"
          ? "No installed games outside the catalog. All are already listed!"
          : "No games added yet.";
    steamGameList.appendChild(empty);
    updateSteamActionButtons();
    return;
  }

  for (const game of games) {
    const item = document.createElement("div");
    item.className = "steam-game-item" + (game.alreadyInLibrary ? " added" : "");

    // Checkbox (hidden for already-added tab).
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.disabled = game.alreadyInLibrary;
    cb.style.flexShrink = "0";
    cb.addEventListener("change", updateSteamActionButtons);
    steamCheckboxMap.set(game.appId, cb);
    item.appendChild(cb);

    // Cover image or placeholder.
    if (game.catalogGame?.coverImageUrl) {
      const img = document.createElement("img");
      img.src = game.catalogGame.coverImageUrl;
      img.alt = "";
      img.onerror = () => { img.style.display = "none"; };
      item.appendChild(img);
    } else {
      const ph = document.createElement("div");
      ph.className = "game-img-placeholder";
      ph.textContent = "🎮";
      item.appendChild(ph);
    }

    // Title + meta.
    const info = document.createElement("div");
    info.className = "steam-game-info";

    const title = document.createElement("div");
    title.className = "steam-game-title";
    title.textContent = game.name;
    info.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "steam-game-meta";
    meta.title = game.bestExePath ?? game.fullInstallPath;
    meta.textContent = game.bestExePath
      ? game.bestExePath.split(/[\\/]/).pop() ?? game.bestExePath
      : game.installDir;
    info.appendChild(meta);

    item.appendChild(info);

    // Status badge.
    const badge = document.createElement("span");
    badge.className = "steam-badge";
    if (game.alreadyInLibrary) {
      badge.classList.add("already-added");
      badge.textContent = "✔ Added";
    } else if (game.catalogGame) {
      badge.classList.add("in-catalog");
      badge.textContent = "In catalog";
    } else {
      badge.classList.add("not-in-catalog");
      badge.textContent = "Not listed";
    }
    item.appendChild(badge);

    steamGameList.appendChild(item);
  }

  updateSteamActionButtons();
}

function selectedSteamGames(): SteamScanGame[] {
  const games = steamGamesForTab(session.currentSteamTab);
  return games.filter((g) => steamCheckboxMap.get(g.appId)?.checked === true);
}

function updateSteamActionButtons(): void {
  const selected = selectedSteamGames();
  const canAdd = selected.some((g) => g.catalogGame !== null);
  const canSubmit = selected.some((g) => g.catalogGame === null);
  steamAddLibraryBtn.disabled = !canAdd;
  steamSubmitReviewBtn.disabled = !canSubmit;
}

steamSelectAll.addEventListener("change", () => {
  const checked = steamSelectAll.checked;
  for (const cb of steamCheckboxMap.values()) {
    if (!cb.disabled) cb.checked = checked;
  }
  updateSteamActionButtons();
});

// Re-render current tab when delta mode is toggled.
steamDeltaMode.addEventListener("change", () => {
  renderSteamTab(session.currentSteamTab);
  // Update badge counts to reflect the active filter.
  const delta = isDeltaActive();
  const inCatalog = session.steamGames.filter((g) => !g.alreadyInLibrary && g.catalogGame !== null && (!delta || g.isNewDiscovery)).length;
  const isNew = session.steamGames.filter((g) => !g.alreadyInLibrary && g.catalogGame === null && (!delta || g.isNewDiscovery)).length;
  const added = session.steamGames.filter((g) => g.alreadyInLibrary && (!delta || g.isNewDiscovery)).length;
  badgeCatalog.textContent = String(inCatalog);
  badgeNew.textContent = String(isNew);
  badgeAdded.textContent = String(added);
});

// Tab switching.
document.querySelectorAll<HTMLButtonElement>(".steam-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset["tab"] as SteamTab;
    if (tab) renderSteamTab(tab);
  });
});

function showSteamModal(): void {
  steamModal.hidden = false;
  steamScanProgress.hidden = false;
  steamScanError.hidden = true;
  steamScanResults.hidden = true;
}

function closeSteamModal(): void {
  steamModal.hidden = true;
}

steamModalClose.addEventListener("click", closeSteamModal);
steamModal.addEventListener("click", (e) => {
  if (e.target === steamModal) closeSteamModal();
});

const steamRecommendCard = $("steam-recommend-card") as HTMLDivElement;
const steamRecommendStatus = $("steam-recommend-status") as HTMLParagraphElement;
const steamRecommendList = $("steam-recommend-list") as HTMLUListElement;
const steamRecommendAddBtn = $("steam-recommend-add") as HTMLButtonElement;
const steamRecommendOpenBtn = $("steam-recommend-open") as HTMLButtonElement;

export function recommendedCatalogGames(): SteamScanGame[] {
  return session.steamGames.filter((g) => !g.alreadyInLibrary && g.catalogGame !== null);
}

function renderSteamRecommendations(): void {
  if (window.agent.platform !== "win32") {
    steamRecommendCard.hidden = true;
    return;
  }
  const recs = recommendedCatalogGames();
  steamRecommendCard.hidden = false;
  steamRecommendChecks.clear();
  steamRecommendList.innerHTML = "";

  if (recs.length === 0) {
    steamRecommendStatus.textContent =
      session.steamGames.length === 0
        ? "Установленные игры Steam не найдены (или Steam не установлен)."
        : "В каталоге платформы пока нет совпадений с твоей Steam-библиотекой.";
    steamRecommendAddBtn.hidden = true;
    return;
  }

  steamRecommendStatus.textContent =
    `Можешь хостить ${recs.length} игр${recs.length === 1 ? "у" : ""} из каталога — они уже стоят в Steam.`;
  steamRecommendAddBtn.hidden = false;

  for (const game of recs.slice(0, 12)) {
    const li = document.createElement("li");
    li.className = "library-item";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = true;
    cb.style.marginRight = "8px";
    steamRecommendChecks.set(game.appId, cb);
    const label = document.createElement("span");
    label.textContent = `${game.name}${game.bestExePath ? "" : " (exe не найден)"}`;
    li.appendChild(cb);
    li.appendChild(label);
    steamRecommendList.appendChild(li);
  }
}

export async function runSteamScan(opts: { openModal?: boolean } = {}): Promise<void> {
  const cfg = readForm();
  if (!cfg.hostToken || !cfg.apiBaseUrl) {
    log("Сначала сохрани Host Token и Platform URL, затем сканируй Steam.");
    return;
  }
  if (window.agent.platform !== "win32") {
    log("Скан Steam доступен только на Windows.");
    return;
  }
  if (session.steamScanInFlight) return;
  session.steamScanInFlight = true;

  if (opts.openModal) {
    showSteamModal();
  } else {
    steamRecommendCard.hidden = false;
    steamRecommendStatus.textContent = "Сканируем библиотеку Steam…";
    steamRecommendList.innerHTML = "";
    steamRecommendAddBtn.hidden = true;
  }

  scanSteamBtn.disabled = true;
  try {
    const result = await window.agent.scanSteam(cfg.hostToken, cfg.apiBaseUrl);
    steamScanProgress.hidden = true;

    if (result.error && result.games.length === 0) {
      if (opts.openModal) {
        steamScanError.hidden = false;
        steamScanErrorText.textContent = result.error;
      }
      steamRecommendCard.hidden = false;
      steamRecommendStatus.textContent = result.error;
      steamRecommendAddBtn.hidden = true;
      return;
    }

    session.steamGames = result.games;

    // First scan: all games marked isNewDiscovery when seenAppIds was empty.
    session.steamIsFirstScan = session.steamGames.every((g) => g.isNewDiscovery);
    steamDeltaMode.checked = !session.steamIsFirstScan;

    const newCount = session.steamGames.filter((g) => g.isNewDiscovery).length;
    const inCatalog = recommendedCatalogGames().length;
    const isNew = session.steamGames.filter((g) => !g.alreadyInLibrary && g.catalogGame === null).length;
    const added = session.steamGames.filter((g) => g.alreadyInLibrary).length;

    badgeCatalog.textContent = String(inCatalog);
    badgeNew.textContent = String(isNew);
    badgeAdded.textContent = String(added);

    const isReScan = !session.steamIsFirstScan;
    steamScanSummary.textContent = isReScan
      ? `Повторный скан: ${newCount} новых (${session.steamGames.length} всего).` +
        (result.error ? `  ⚠️ ${result.error}` : "")
      : `Найдено ${session.steamGames.length} установленных игр Steam.` +
        (result.error ? `  ⚠️ ${result.error}` : "");

    steamScanResults.hidden = false;
    const startTab: SteamTab = inCatalog > 0 ? "catalog" : isNew > 0 ? "new" : "added";
    renderSteamTab(startTab);
    renderSteamRecommendations();
    renderGamePickerSteam();
    log(
      `Steam: ${session.steamGames.length} игр, из них ${inCatalog} можно хостить (есть в каталоге).`,
    );
    void refreshSteamAutoHost(cfg);
  } catch (err) {
    steamScanProgress.hidden = true;
    if (opts.openModal) {
      steamScanError.hidden = false;
      steamScanErrorText.textContent = `Scan failed: ${String(err)}`;
    }
    steamRecommendCard.hidden = false;
    steamRecommendStatus.textContent = `Ошибка скана Steam: ${String(err)}`;
    log(`Steam scan error: ${String(err)}`);
  } finally {
    scanSteamBtn.disabled = false;
    session.steamScanInFlight = false;
  }
}

scanSteamBtn.addEventListener("click", () => {
  void runSteamScan({ openModal: true });
});

steamRecommendOpenBtn.addEventListener("click", () => {
  if (session.steamGames.length === 0) {
    void runSteamScan({ openModal: true });
  } else {
    showSteamModal();
    renderSteamTab(recommendedCatalogGames().length > 0 ? "catalog" : "new");
  }
});

steamRecommendAddBtn.addEventListener("click", async () => {
  const cfg = readForm();
  const selected = recommendedCatalogGames().filter((g) => {
    const cb = steamRecommendChecks.get(g.appId);
    return cb?.checked;
  });
  if (selected.length === 0 || !cfg.hostToken || !cfg.apiBaseUrl) return;

  steamRecommendAddBtn.disabled = true;
  const base = cfg.apiBaseUrl.replace(/\/$/, "");
  const addedAppIds: string[] = [];
  let successCount = 0;

  for (const game of selected) {
    if (!game.catalogGame) continue;
    try {
      const resp = await fetch(
        `${base}/api/hosts/${encodeURIComponent(cfg.hostToken)}/library`,
        {
          method: "POST",
          headers: {
          "content-type": "application/json",
          "x-host-token": cfg.hostToken,
        },
          body: JSON.stringify({
            gameId: game.catalogGame.id,
            pricePerMinuteLzt: 5,
            appPath: game.bestExePath ?? "",
          }),
        },
      );
      if (resp.ok || resp.status === 409) {
        addedAppIds.push(game.appId);
        successCount++;
        const g = session.steamGames.find((x) => x.appId === game.appId);
        if (g) g.alreadyInLibrary = true;
      }
    } catch (err) {
      log(`Add error for ${game.name}: ${String(err)}`);
    }
  }

  if (addedAppIds.length > 0) {
    try {
      await window.agent.markSteamGamesAdded(addedAppIds);
    } catch {
      /* ignore */
    }
  }
  steamRecommendAddBtn.disabled = false;
  log(`Добавлено в библиотеку: ${successCount}.`);
  renderSteamRecommendations();
  renderGamePickerSteam();
  await loadLibrary(cfg);
  badgeCatalog.textContent = String(recommendedCatalogGames().length);
  badgeAdded.textContent = String(session.steamGames.filter((g) => g.alreadyInLibrary).length);
});

// ── Add selected games to library ────────────────────────────────────────────

steamAddLibraryBtn.addEventListener("click", async () => {
  const cfg = readForm();
  const selected = selectedSteamGames().filter((g) => g.catalogGame !== null);
  if (selected.length === 0 || !cfg.hostToken || !cfg.apiBaseUrl) return;

  steamAddLibraryBtn.disabled = true;
  const base = cfg.apiBaseUrl.replace(/\/$/, "");
  const addedAppIds: string[] = [];
  let successCount = 0;
  let failCount = 0;

  for (const game of selected) {
    if (!game.catalogGame) continue;
    try {
      // Default price: 5 LZT/min (platform placeholder — host can adjust later).
      const resp = await fetch(
        `${base}/api/hosts/${encodeURIComponent(cfg.hostToken)}/library`,
        {
          method: "POST",
          headers: {
          "content-type": "application/json",
          "x-host-token": cfg.hostToken,
        },
          body: JSON.stringify({
            gameId: game.catalogGame.id,
            pricePerMinuteLzt: 5,
            appPath: game.bestExePath ?? "",
          }),
        },
      );
      if (resp.ok || resp.status === 409) {
        // 409 = already in library — treat as success.
        addedAppIds.push(game.appId);
        successCount++;
        // Mark game as added in UI immediately.
        const g = session.steamGames.find((g) => g.appId === game.appId);
        if (g) g.alreadyInLibrary = true;
      } else {
        failCount++;
        log(`Failed to add ${game.name} (${resp.status}).`);
      }
    } catch (err) {
      failCount++;
      log(`Add error for ${game.name}: ${String(err)}`);
    }
  }

  // Persist added state so re-scans don't show them again.
  if (addedAppIds.length > 0) {
    await window.agent.markSteamGamesAdded(addedAppIds);
  }

  const msg = successCount > 0
    ? `Added ${successCount} game${successCount !== 1 ? "s" : ""} to library${failCount > 0 ? `, ${failCount} failed` : ""}. Refreshing…`
    : `All ${failCount} add${failCount !== 1 ? "s" : ""} failed.`;
  log(msg);

  // Refresh badge counts and re-render tab.
  const inCatalog = session.steamGames.filter((g) => !g.alreadyInLibrary && g.catalogGame !== null).length;
  const isNew = session.steamGames.filter((g) => !g.alreadyInLibrary && g.catalogGame === null).length;
  const added = session.steamGames.filter((g) => g.alreadyInLibrary).length;
  badgeCatalog.textContent = String(inCatalog);
  badgeNew.textContent = String(isNew);
  badgeAdded.textContent = String(added);
  renderSteamTab(session.currentSteamTab);

  // Refresh the main library list in the background.
  await loadLibrary(cfg);
});

// ── Submit unlisted games for platform review ─────────────────────────────────

steamSubmitReviewBtn.addEventListener("click", async () => {
  const cfg = readForm();
  const selected = selectedSteamGames().filter((g) => g.catalogGame === null);
  if (selected.length === 0 || !cfg.hostToken || !cfg.apiBaseUrl) return;

  steamSubmitReviewBtn.disabled = true;
  const base = cfg.apiBaseUrl.replace(/\/$/, "");
  let submitted = 0;
  let skipped = 0;

  for (const game of selected) {
    try {
      const resp = await fetch(`${base}/api/games/submit`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-host-token": cfg.hostToken,
        },
        body: JSON.stringify({
          hostToken: cfg.hostToken,
          title: game.name,
          steamAppId: game.appId,
          kind: "native",
          // Prefill description with install dir context for the reviewer.
          description: `Steam App ID: ${game.appId} | Install dir: ${game.installDir}`,
        }),
      });
      if (resp.ok) {
        submitted++;
        // Save host launch config on the submission so the platform can
        // auto-create the library entry when the submission is approved.
        const subData = (await resp.json()) as { id?: string };
        if (subData.id) {
          fetch(`${base}/api/games/submissions/${encodeURIComponent(subData.id)}/pending-config`, {
            method: "PATCH",
            headers: {
          "content-type": "application/json",
          "x-host-token": cfg.hostToken,
        },
            body: JSON.stringify({
              hostToken: cfg.hostToken,
              pricePerMinuteLzt: 5,
              appPath: game.bestExePath ?? "",
              boundUrl: "",
              launchArgs: "",
            }),
          }).catch((err) => {
            log(`pending-config save failed for ${game.name}: ${String(err)}`);
          });
        }
      } else if (resp.status === 409) {
        skipped++; // Already submitted / already in catalog.
      } else {
        log(`Submit failed for ${game.name} (${resp.status}).`);
      }
    } catch (err) {
      log(`Submit error for ${game.name}: ${String(err)}`);
    }
  }

  log(
    submitted > 0
      ? `Submitted ${submitted} game${submitted !== 1 ? "s" : ""} for review${skipped > 0 ? ` (${skipped} already pending)` : ""}.`
      : skipped > 0
        ? `${skipped} game${skipped !== 1 ? "s" : ""} already submitted.`
        : "No games were submitted.",
  );
  steamSubmitReviewBtn.disabled = false;
});