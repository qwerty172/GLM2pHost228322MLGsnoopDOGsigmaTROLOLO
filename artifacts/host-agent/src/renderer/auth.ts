import { $, form, copyLinkBtn, refreshLibraryBtn, playerLinkInput } from "./dom.js";
import { readForm, refreshCaptureSources } from "./config.js";
import { loadLibrary, startLibraryPolling } from "./library.js";
import { log } from "./ui.js";
import { showAutoQuotaCard, applyQuotaStatus, autoQuotaCheckbox } from "./quota.js";
import { runSteamScan } from "./steam.js";
import { setConnectionTroubleshootVisible } from "./agent-auth.js";

// ─── Signed-in banner helpers ──────────────────────────────────────────────
const signinBanner = document.getElementById("signin-banner") as HTMLElement;
const signinDisplayName = document.getElementById("signin-display-name") as HTMLSpanElement;
const signinApiUrl = document.getElementById("signin-api-url") as HTMLSpanElement;
const switchAccountBtn = document.getElementById("switch-account-btn") as HTMLButtonElement;
const settingsSection = form.closest("section") as HTMLElement;

export function showSigninBanner(displayName: string, apiBaseUrl: string): void {
  signinDisplayName.textContent = displayName;
  signinApiUrl.textContent = (() => {
    try {
      return new URL(apiBaseUrl).hostname;
    } catch {
      return apiBaseUrl;
    }
  })();
  signinBanner.hidden = false;
  // Collapse the settings section so first-time users don't see the whole form.
  settingsSection.hidden = true;
}

function hideSigninBanner(): void {
  signinBanner.hidden = true;
  settingsSection.hidden = false;
}

switchAccountBtn.addEventListener("click", () => {
  hideSigninBanner();
  setConnectionTroubleshootVisible(true);
  ($("hostToken") as HTMLInputElement).focus();
  log("Введи новый токен хоста в «Если не подключается» или скачай ZIP с дашборда.");
});

// Validate a host token by calling GET /api/hosts/:token and return the display name.
export async function validateHostToken(apiBaseUrl: string, hostToken: string): Promise<string | null> {
  try {
    const url = `${apiBaseUrl.replace(/\/$/, "")}/api/hosts/${encodeURIComponent(hostToken)}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = (await resp.json()) as { displayName?: string };
    return data.displayName ?? null;
  } catch {
    return null;
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const saveBtn = $("save") as HTMLButtonElement;
  const existing = await window.agent.getConfig();
  const cfg = { ...readForm(), autoQuotaEnabled: existing.autoQuotaEnabled };

  // Validate the token before saving if one is provided.
  if (cfg.hostToken && cfg.apiBaseUrl) {
    saveBtn.disabled = true;
    saveBtn.textContent = "Проверяем токен…";
    const displayName = await validateHostToken(cfg.apiBaseUrl, cfg.hostToken);
    saveBtn.disabled = false;
    saveBtn.textContent = "Сохранить";
    if (!displayName) {
      log("Ошибка: токен не найден или платформа недоступна. Проверь токен хоста и URL платформы.");
      return;
    }
    log(`Токен подтверждён: ${displayName}`);
  }

  await window.agent.setConfig(cfg);
  log("Настройки сохранены.");

  if (cfg.hostToken && cfg.apiBaseUrl) {
    // Show the signed-in banner and collapse the form.
    const displayName = await validateHostToken(cfg.apiBaseUrl, cfg.hostToken);
    if (displayName) showSigninBanner(displayName, cfg.apiBaseUrl);

    await loadLibrary(cfg);
    startLibraryPolling(cfg);
    showAutoQuotaCard();
    autoQuotaCheckbox.checked = !!cfg.autoQuotaEnabled;
    if (!cfg.autoQuotaEnabled) {
      applyQuotaStatus({ statusText: "Автоподбор выключен.", hasAttached: false });
    }
    // After login — auto-scan Steam and surface hosting recommendations.
    if (window.agent.platform === "win32") {
      void runSteamScan({ openModal: false });
    }
  } else {
    await loadLibrary(cfg);
    startLibraryPolling(cfg);
  }
});

const pullBtn = $("pull-from-server") as HTMLButtonElement;
pullBtn.addEventListener("click", async () => {
  // Pulls connection credentials and pricing from the server profile.
  // Note: legacy game-binding fields (boundAppPath, boundUrl on the host row)
  // are intentionally NOT applied — the multi-game library is now authoritative.
  // Use the Library section above to manage games and their exe paths.
  const cfg = readForm();
  if (!cfg.hostToken || !cfg.apiBaseUrl) {
    log("Сначала укажи токен хоста и URL платформы, затем подтяни данные с сервера.");
    return;
  }
  pullBtn.disabled = true;
  try {
    const url = `${cfg.apiBaseUrl.replace(/\/$/, "")}/api/hosts/${encodeURIComponent(cfg.hostToken)}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      log(`Не удалось подтянуть данные (${resp.status}).`);
      return;
    }
    const data = (await resp.json()) as {
      minutePriceUsd?: number;
    };
    let touched = 0;
    if (typeof data.minutePriceUsd === "number") {
      ($("ratePerMinute") as HTMLInputElement).value = String(data.minutePriceUsd);
      touched++;
    }
    const note = touched > 0
      ? `Подтянуто полей с сервера: ${touched}. Нажми «Сохранить», чтобы применить.`
      : "С сервера нечего обновлять. Управляй играми в разделе «Моя библиотека».";
    log(note);
  } catch (err) {
    log(`Ошибка подтягивания с сервера: ${String(err)}`);
  } finally {
    pullBtn.disabled = false;
  }
});

copyLinkBtn.addEventListener("click", () => {
  playerLinkInput.select();
  document.execCommand("copy");
});

const refreshSourcesBtn = $("refresh-sources") as HTMLButtonElement;
refreshSourcesBtn.addEventListener("click", () => {
  void refreshCaptureSources(($("captureSourceName") as HTMLSelectElement).value);
});

refreshLibraryBtn.addEventListener("click", async () => {
  const cfg = readForm();
  refreshLibraryBtn.disabled = true;
  await loadLibrary(cfg);
  refreshLibraryBtn.disabled = false;
});

