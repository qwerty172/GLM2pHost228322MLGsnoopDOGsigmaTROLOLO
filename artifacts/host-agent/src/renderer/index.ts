import type { AgentStatus, HostConfig, InputEvent, LibraryEntry, SteamScanGame, SteamScanResult, SaveSyncRequest, SaveSyncResult } from "../shared/messages";

// The preload script (src/preload/index.ts) exposes this API on `window.agent`
// via contextBridge. Re-declare the surface here so the renderer typechecks
// without depending on the preload's CommonJS module graph.
declare global {
  interface Window {
    agent: {
      getConfig: () => Promise<HostConfig>;
      setConfig: (next: HostConfig) => Promise<HostConfig>;
      setStatus: (status: AgentStatus, message?: string) => void;
      injectInput: (event: InputEvent) => void;
      launchApp: () => Promise<{ ok: boolean; pid?: number; error?: string }>;
      launchEntry: (entry: {
        appPath: string;
        boundUrl: string;
        launchArgs: string;
      }) => Promise<{ ok: boolean; pid?: number; error?: string }>;
      onGameExited: (cb: () => void) => void;
      getCaptureSources: () => Promise<{ id: string; name: string }[]>;
      killApp: () => void;
      openFileDialog: () => Promise<string | null>;
      fetchLibrary: (
        hostToken: string,
        apiBaseUrl: string,
      ) => Promise<LibraryEntry[]>;
      patchLibraryAvailability: (
        hostToken: string,
        apiBaseUrl: string,
        gameId: string,
        localAvailable: boolean,
        lastError?: string,
      ) => Promise<void>;
      openExplorer: (filePath: string) => void;
      scanSteam: (hostToken: string, apiBaseUrl: string) => Promise<SteamScanResult>;
      markSteamGamesAdded: (appIds: string[]) => Promise<void>;
      platform: string;
      log: (level: "info" | "warn" | "error", message: string) => void;
      getAgentPubkey: () => Promise<string | null>;
      bindAgentKey: (hostToken: string, apiBaseUrl: string) => Promise<{ ok: boolean; error?: string }>;
      agentLogin: (apiBaseUrl: string) => Promise<{ ok: boolean; error?: string }>;
      updatePcSpecs: (hostToken: string, apiBaseUrl: string) => Promise<{ ok: boolean; error?: string; pcSpecs?: { gpu: string; cpu: string; ramGb: number } }>;
      getPcSpecs: () => Promise<{ gpu: string; cpu: string; ramGb: number }>;
      getInjectorStatus: () => Promise<{ ok: boolean; error: string; platform: string }>;
      // Auto-quota IPC (main-process scheduler)
      onQuotaStatus: (cb: (ev: { statusText: string; attachedQuotaId: string | null; attachedQuotaTitle: string | null; hasAttached: boolean }) => void) => () => void;
      quotaRunCycle: () => void;
      quotaDetach: () => Promise<{ ok: boolean }>;
      quotaGetState: () => Promise<{ statusText: string; attachedQuotaId: string | null; attachedQuotaTitle: string | null; hasAttached: boolean }>;
      saveSyncPull: (req: SaveSyncRequest) => Promise<SaveSyncResult>;
      saveSyncPush: (req: SaveSyncRequest) => Promise<SaveSyncResult>;
    };
  }
}

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
};

const statusDot = document.querySelector<HTMLSpanElement>(".dot")!;
const statusText = $("status-text") as HTMLSpanElement;
const logEl = $("log") as HTMLPreElement;
const form = $("settings-form") as HTMLFormElement;
const connectBtn = $("connect") as HTMLButtonElement;
const disconnectBtn = $("disconnect") as HTMLButtonElement;
const shareCard = $("share-card") as HTMLElement;
const playerLinkInput = $("player-link") as HTMLInputElement;
const copyLinkBtn = $("copy-link") as HTMLButtonElement;
const libraryCard = $("library-card") as HTMLElement;
const libraryStatus = $("library-status") as HTMLParagraphElement;
const libraryList = $("library-list") as HTMLUListElement;
const refreshLibraryBtn = $("refresh-library") as HTMLButtonElement;
const gamePickerCard = $("game-picker-card") as HTMLElement;
const selectedGameSelect = $("selected-game-id") as HTMLSelectElement;
const confirmGameBtn = $("confirm-game") as HTMLButtonElement;
const cancelGamePickerBtn = $("cancel-game-picker") as HTMLButtonElement;

let pc: RTCPeerConnection | null = null;
let ws: WebSocket | null = null;
let captureStream: MediaStream | null = null;
let dataChannel: RTCDataChannel | null = null;
let currentSessionId: string | null = null;
let currentConfig: HostConfig | null = null;
// gameId of the session currently being streamed (from library or legacy).
let currentGameId: string | null = null;
// Active save-sync context for push on session teardown.
let activeSaveSyncContext: SaveSyncRequest | null = null;
// Guard: prevents accepting a second peer-joined while already streaming.
let isStreaming = false;
// One-time warning flag for gamepad input when ViGEm is not connected.
let gamepadWarnedOnce = false;

// ─── Preview state ────────────────────────────────────────────────────────────
// Separate WS + RTCPeerConnection used for 30-second preview streams.
// These are independent of the main session WS/PC so preview never interrupts
// or interferes with a live billed session.
let previewWs: WebSocket | null = null;
let previewPc: RTCPeerConnection | null = null;
// previewCaptureStream only set when we captured a NEW stream for preview.
// When preview reuses captureStream we do NOT stop it on preview teardown.
let previewOwnStream: MediaStream | null = null;
const previewIndicator = document.getElementById("preview-indicator") as HTMLSpanElement | null;

// Library state
let libraryEntries: LibraryEntry[] = [];
let libraryRefreshTimer: ReturnType<typeof setInterval> | null = null;

// Full path stored here; #appPath input shows only the basename.
let resolvedAppPath = "";

function pathBasename(p: string): string {
  return p.split(/[\\/]/).pop() ?? p;
}

function setAppPath(fullPath: string): void {
  resolvedAppPath = fullPath;
  ($("appPath") as HTMLInputElement).value = fullPath ? pathBasename(fullPath) : "";
}

const browseExeBtn = $("browse-exe") as HTMLButtonElement;
browseExeBtn.addEventListener("click", async () => {
  const picked = await window.agent.openFileDialog();
  if (picked) setAppPath(picked);
});

function setStatus(status: AgentStatus, message?: string): void {
  statusDot.dataset["status"] = status;
  statusText.textContent =
    message ??
    {
      idle: "Idle — waiting for player",
      connecting: "Connecting…",
      streaming: "Streaming",
      error: "Error",
    }[status];
  window.agent.setStatus(status, message);
}

// ─── Session pipeline panel ──────────────────────────────────────────────────
// Step-by-step status of the native stream flow:
//   Игра запущена → Окно найдено → Стрим начат → Игрок подключён
type PipelineStep = "saves" | "launch" | "window" | "stream" | "player";
type PipelineState = "pending" | "active" | "done" | "error";

const pipelineCard = document.getElementById("pipeline-card") as HTMLElement;

function setPipelineStep(step: PipelineStep, state: PipelineState, note = ""): void {
  pipelineCard.hidden = false;
  const li = document.getElementById(`step-${step}`);
  if (!li) return;
  li.dataset["state"] = state;
  const icon = li.querySelector<HTMLSpanElement>(".step-icon");
  if (icon) {
    icon.textContent =
      state === "done" ? "✅" : state === "active" ? "⏳" : state === "error" ? "❌" : "○";
  }
  const noteEl = li.querySelector<HTMLSpanElement>(".step-note");
  if (noteEl) noteEl.textContent = note ? ` — ${note}` : "";
}

function resetPipeline(show: boolean): void {
  for (const step of ["saves", "launch", "window", "stream", "player"] as PipelineStep[]) {
    setPipelineStep(step, "pending");
  }
  pipelineCard.hidden = !show;
}

function log(msg: string): void {
  const stamp = new Date().toLocaleTimeString();
  logEl.textContent = `[${stamp}] ${msg}\n` + logEl.textContent;
  if (logEl.textContent.length > 16_000) {
    logEl.textContent = logEl.textContent.slice(0, 16_000);
  }
  window.agent.log("info", msg);
}

async function loadFormFromConfig(): Promise<HostConfig> {
  const cfg = await window.agent.getConfig();
  ($("hostToken") as HTMLInputElement).value = cfg.hostToken;
  ($("apiBaseUrl") as HTMLInputElement).value = cfg.apiBaseUrl;
  ($("signalingUrl") as HTMLInputElement).value = cfg.signalingUrl;
  setAppPath(cfg.appPath);
  ($("boundUrl") as HTMLInputElement).value = cfg.boundUrl ?? "";
  ($("appArgs") as HTMLInputElement).value = cfg.appArgs ?? "";
  ($("appName") as HTMLInputElement).value = cfg.appName ?? "";
  await refreshCaptureSources(cfg.captureSourceName ?? "");
  ($("ratePerMinute") as HTMLInputElement).value = String(cfg.ratePerMinute);
  ($("commissionSplit") as HTMLInputElement).value = String(cfg.commissionSplit);
  ($("width") as HTMLInputElement).value = String(cfg.resolution.width);
  ($("height") as HTMLInputElement).value = String(cfg.resolution.height);
  ($("bitrateKbps") as HTMLInputElement).value = String(cfg.bitrateKbps);
  ($("audioMode") as HTMLSelectElement).value = cfg.audioMode ?? "off";
  ($("killAppOnDisconnect") as HTMLInputElement).checked = cfg.killAppOnDisconnect;
  ($("autoLaunchAtStartup") as HTMLInputElement).checked = cfg.autoLaunchAtStartup;
  ($("allowPreview") as HTMLInputElement).checked = cfg.allowPreview !== false;
  return cfg;
}

function readForm(): HostConfig {
  return {
    hostToken: ($("hostToken") as HTMLInputElement).value.trim(),
    apiBaseUrl: ($("apiBaseUrl") as HTMLInputElement).value.trim(),
    signalingUrl: ($("signalingUrl") as HTMLInputElement).value.trim(),
    appPath: resolvedAppPath,
    boundUrl: ($("boundUrl") as HTMLInputElement).value.trim(),
    appArgs: ($("appArgs") as HTMLInputElement).value.trim(),
    appName: ($("appName") as HTMLInputElement).value.trim(),
    captureSourceName: ($("captureSourceName") as HTMLSelectElement).value,
    ratePerMinute: Number(($("ratePerMinute") as HTMLInputElement).value) || 0,
    commissionSplit: Math.max(
      0,
      Math.min(1, Number(($("commissionSplit") as HTMLInputElement).value) || 0.7),
    ),
    resolution: {
      width: Number(($("width") as HTMLInputElement).value) || 1920,
      height: Number(($("height") as HTMLInputElement).value) || 1080,
    },
    bitrateKbps: Number(($("bitrateKbps") as HTMLInputElement).value) || 6000,
    audioMode: (($("audioMode") as HTMLSelectElement).value || "off") as "off" | "voice" | "standard" | "quality",
    killAppOnDisconnect: ($("killAppOnDisconnect") as HTMLInputElement).checked,
    autoLaunchAtStartup: ($("autoLaunchAtStartup") as HTMLInputElement).checked,
    allowPreview: ($("allowPreview") as HTMLInputElement).checked,
  };
}

function deriveSignalingUrl(cfg: HostConfig): string {
  if (cfg.signalingUrl) return cfg.signalingUrl;
  const base = new URL(cfg.apiBaseUrl);
  const wsProto = base.protocol === "https:" ? "wss:" : "ws:";
  return `${wsProto}//${base.host}${base.pathname.replace(/\/$/, "")}/api/signal`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Library management
// ─────────────────────────────────────────────────────────────────────────────

function renderLibraryEntry(entry: LibraryEntry): HTMLLIElement {
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
            headers: { "content-type": "application/json" },
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

function renderLibrary(entries: LibraryEntry[]): void {
  libraryList.innerHTML = "";
  if (entries.length === 0) {
    libraryStatus.textContent =
      "No games in library. Add games from the web dashboard.";
    return;
  }
  const enabled = entries.filter((e) => e.enabled);
  const disabled = entries.filter((e) => !e.enabled);
  libraryStatus.textContent = `${enabled.length} enabled game${enabled.length !== 1 ? "s" : ""} · ${disabled.length} disabled`;

  for (const entry of entries) {
    libraryList.appendChild(renderLibraryEntry(entry));
  }

  // Populate game picker dropdown
  selectedGameSelect.innerHTML = '<option value="">— choose a game —</option>';
  for (const entry of enabled) {
    const isBrowser = !!entry.boundUrl;
    const isAvail = isBrowser || entry.localAvailable;
    const opt = document.createElement("option");
    opt.value = entry.gameId;
    opt.textContent = `${entry.game.title} · 🔵${entry.pricePerMinuteLzt} LZT/min${isAvail ? "" : " ⚠️ not found"}`;
    opt.disabled = !isAvail;
    selectedGameSelect.appendChild(opt);
  }
}

async function loadLibrary(cfg: HostConfig): Promise<void> {
  if (!cfg.hostToken || !cfg.apiBaseUrl) return;
  libraryCard.hidden = false;
  libraryStatus.textContent = "Loading…";
  try {
    const entries = await window.agent.fetchLibrary(cfg.hostToken, cfg.apiBaseUrl);
    libraryEntries = entries;
    renderLibrary(entries);
    log(`Library loaded: ${entries.length} game(s).`);
  } catch (err) {
    libraryStatus.textContent = "Failed to load library.";
    log(`Library load error: ${String(err)}`);
  }
}

function startLibraryPolling(cfg: HostConfig): void {
  stopLibraryPolling();
  libraryRefreshTimer = setInterval(() => {
    void loadLibrary(cfg);
  }, 5 * 60 * 1000); // every 5 min
}

function stopLibraryPolling(): void {
  if (libraryRefreshTimer) {
    clearInterval(libraryRefreshTimer);
    libraryRefreshTimer = null;
  }
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings form
// ─────────────────────────────────────────────────────────────────────────────

// ─── Signed-in banner helpers ──────────────────────────────────────────────
const signinBanner = document.getElementById("signin-banner") as HTMLElement;
const signinDisplayName = document.getElementById("signin-display-name") as HTMLSpanElement;
const signinApiUrl = document.getElementById("signin-api-url") as HTMLSpanElement;
const switchAccountBtn = document.getElementById("switch-account-btn") as HTMLButtonElement;
const settingsSection = form.closest("section") as HTMLElement;

function showSigninBanner(displayName: string, apiBaseUrl: string): void {
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
  ($("hostToken") as HTMLInputElement).focus();
  log("Введи новый Host Token и нажми Save.");
});

// Validate a host token by calling GET /api/hosts/:token and return the display name.
async function validateHostToken(apiBaseUrl: string, hostToken: string): Promise<string | null> {
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
    saveBtn.textContent = "Save";
    if (!displayName) {
      log("Ошибка: токен не найден или платформа недоступна. Проверь Host Token и Platform URL.");
      return;
    }
    log(`Токен подтверждён: ${displayName}`);
  }

  await window.agent.setConfig(cfg);
  log("Settings saved.");

  if (cfg.hostToken && cfg.apiBaseUrl) {
    // Show the signed-in banner and collapse the form.
    const displayName = await validateHostToken(cfg.apiBaseUrl, cfg.hostToken);
    if (displayName) showSigninBanner(displayName, cfg.apiBaseUrl);

    showAutoQuotaCard();
    autoQuotaCheckbox.checked = !!cfg.autoQuotaEnabled;
    if (!cfg.autoQuotaEnabled) {
      applyQuotaStatus({ statusText: "Автоподбор выключен.", hasAttached: false });
    }
  }

  await loadLibrary(cfg);
  startLibraryPolling(cfg);
});

const pullBtn = $("pull-from-server") as HTMLButtonElement;
pullBtn.addEventListener("click", async () => {
  // Pulls connection credentials and pricing from the server profile.
  // Note: legacy game-binding fields (boundAppPath, boundUrl on the host row)
  // are intentionally NOT applied — the multi-game library is now authoritative.
  // Use the Library section above to manage games and their exe paths.
  const cfg = readForm();
  if (!cfg.hostToken || !cfg.apiBaseUrl) {
    log("Set host token and platform URL before pulling from the server.");
    return;
  }
  pullBtn.disabled = true;
  try {
    const url = `${cfg.apiBaseUrl.replace(/\/$/, "")}/api/hosts/${encodeURIComponent(cfg.hostToken)}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      log(`Pull failed (${resp.status}).`);
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
      ? `Pulled ${touched} field(s) from server. Click Save to persist.`
      : "No updateable fields returned from server. Manage games via the Library section.";
    log(note);
  } catch (err) {
    log(`Pull failed: ${String(err)}`);
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

async function refreshCaptureSources(selected: string): Promise<void> {
  const sel = $("captureSourceName") as HTMLSelectElement;
  let sources: { id: string; name: string }[] = [];
  try {
    sources = await window.agent.getCaptureSources();
  } catch (err) {
    log(`Could not enumerate capture sources: ${String(err)}`);
  }
  sel.innerHTML = "";
  const auto = document.createElement("option");
  auto.value = "";
  auto.textContent = "(auto — match launched app, else primary screen)";
  sel.appendChild(auto);
  for (const s of sources) {
    const opt = document.createElement("option");
    opt.value = s.name;
    opt.textContent = s.name;
    sel.appendChild(opt);
  }
  sel.value = selected;
}

// ─────────────────────────────────────────────────────────────────────────────
// "Go online" flow with game picker
// ─────────────────────────────────────────────────────────────────────────────

connectBtn.addEventListener("click", async () => {
  // One-session-at-a-time guard.
  if (currentSessionId) {
    log("Already online — disconnect first before starting a new session.");
    return;
  }

  const cfg = await window.agent.setConfig(readForm());
  if (!cfg.hostToken || !cfg.apiBaseUrl) {
    setStatus("error", "Host token and platform URL are required");
    return;
  }

  const enabledLibGames = libraryEntries.filter(
    (e) => e.enabled && (e.boundUrl || e.localAvailable),
  );

  if (enabledLibGames.length === 0) {
    // No library (or all games unavailable) — use legacy single-game path.
    currentGameId = null;
    await connect(cfg, null);
    return;
  }

  if (enabledLibGames.length === 1) {
    // Auto-select the only available game.
    const only = enabledLibGames[0]!;
    log(`Auto-selected game: ${only.game.title}`);
    currentGameId = only.gameId;
    await connect(cfg, only.gameId);
    return;
  }

  // Multiple games: show picker.
  gamePickerCard.hidden = false;
  connectBtn.disabled = true;
});

confirmGameBtn.addEventListener("click", async () => {
  const gameId = selectedGameSelect.value;
  if (!gameId) {
    log("Please choose a game from the list.");
    return;
  }
  gamePickerCard.hidden = true;
  connectBtn.disabled = false;
  const cfg = await window.agent.setConfig(readForm());
  currentGameId = gameId;
  await connect(cfg, gameId);
});

cancelGamePickerBtn.addEventListener("click", () => {
  gamePickerCard.hidden = true;
  connectBtn.disabled = false;
});

disconnectBtn.addEventListener("click", () => {
  teardown("Disconnected by host");
});

// ─────────────────────────────────────────────────────────────────────────────
// Session creation
// ─────────────────────────────────────────────────────────────────────────────

async function createSession(
  cfg: HostConfig,
  requestedGameId: string | null,
): Promise<{ sessionId: string; playerToken: string; gameId?: string }> {
  const url = `${cfg.apiBaseUrl.replace(/\/$/, "")}/api/sessions`;

  // Find game name for the session appName field.
  let appName = cfg.appName || "Streamed App";
  if (requestedGameId) {
    const entry = libraryEntries.find((e) => e.gameId === requestedGameId);
    if (entry) appName = entry.game.title;
  }

  const body: Record<string, unknown> = {
    hostToken: cfg.hostToken,
    appName,
    ratePerMinute: cfg.ratePerMinute,
  };
  if (requestedGameId) {
    body["requestedGameId"] = requestedGameId;
  }

  const resp = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = (await resp.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Session create failed (${resp.status})`);
  }
  const data = (await resp.json()) as {
    id: string;
    playerToken: string;
    gameId?: string;
  };
  return {
    sessionId: data.id,
    playerToken: data.playerToken,
    gameId: data.gameId ?? requestedGameId ?? undefined,
  };
}

function showPlayerLink(cfg: HostConfig, playerToken: string): void {
  const link = `${cfg.apiBaseUrl.replace(/\/$/, "")}/play/${encodeURIComponent(playerToken)}`;
  playerLinkInput.value = link;
  shareCard.hidden = false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Connect
// ─────────────────────────────────────────────────────────────────────────────

async function connect(cfg: HostConfig, gameId: string | null): Promise<void> {
  cancelDeferredTeardown();
  currentConfig = cfg;
  currentGameId = gameId;
  setStatus("connecting", "Creating session…");
  connectBtn.disabled = true;
  let session: { sessionId: string; playerToken: string; gameId?: string };
  try {
    session = await createSession(cfg, gameId);
    currentSessionId = session.sessionId;
    if (session.gameId) currentGameId = session.gameId;
    showPlayerLink(cfg, session.playerToken);
    log(`Session created: ${session.sessionId}`);
  } catch (err) {
    setStatus("error", `Could not create session: ${String(err)}`);
    connectBtn.disabled = false;
    return;
  }

  setStatus("connecting", "Connecting to signaling server…");
  let url: URL;
  try {
    url = new URL(deriveSignalingUrl(cfg));
  } catch (err) {
    setStatus("error", `Bad signaling URL: ${String(err)}`);
    connectBtn.disabled = false;
    return;
  }
  url.searchParams.set("role", "host");
  url.searchParams.set("hostToken", cfg.hostToken);
  url.searchParams.set("sessionId", session.sessionId);

  ws = new WebSocket(url.toString());

  ws.onopen = () => {
    log("Signaling connected. Waiting for the player to join…");
    setStatus("idle", "Online — share the player link");
    disconnectBtn.disabled = false;
    // Open the preview signaling channel alongside the main session.
    connectPreviewWs(cfg);
  };

  ws.onmessage = async (ev) => {
    let msg: { type: string; [k: string]: unknown };
    try {
      msg = JSON.parse(typeof ev.data === "string" ? ev.data : "");
    } catch {
      return;
    }
    if (msg.type === "welcome") {
      // Acknowledged by signaling.
    } else if (msg.type === "peer-joined" && msg["role"] === "player") {
      if (isStreaming) {
        // Same session player reconnecting after a brief WS drop.
        // The PC is still alive; cancel any deferred teardown and wait for
        // the player to send an ICE restart re-offer.
        log("[reconnect] Player re-joined signaling — cancelling deferred teardown");
        cancelDeferredTeardown();
      } else {
        await onPlayerJoined(cfg);
      }
    } else if (msg.type === "offer" && pc) {
      // ICE-restart re-offer from the player. Accept it and answer.
      log("[ice-restart] Received re-offer from player — renegotiating ICE");
      try {
        const sdp = msg["sdp"] as RTCSessionDescriptionInit | string;
        const desc: RTCSessionDescriptionInit =
          typeof sdp === "string" ? { type: "offer", sdp } : sdp;
        await pc.setRemoteDescription(desc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        ws!.send(
          JSON.stringify({ type: "answer", sdp: { type: answer.type, sdp: answer.sdp } }),
        );
        log("[ice-restart] Sent answer — awaiting ICE recovery");
      } catch (err) {
        log(`[ice-restart] Re-offer handling failed: ${String(err)}`);
      }
    } else if (msg.type === "answer" && pc) {
      const sdp = msg["sdp"] as RTCSessionDescriptionInit | string;
      const desc: RTCSessionDescriptionInit =
        typeof sdp === "string" ? { type: "answer", sdp } : sdp;
      await pc
        .setRemoteDescription(desc)
        .catch((err) => log(`setRemoteDescription failed: ${String(err)}`));
    } else if (msg.type === "ice-candidate" && pc) {
      try {
        await pc.addIceCandidate(msg["candidate"] as RTCIceCandidateInit);
      } catch (err) {
        log(`ICE add failed: ${String(err)}`);
      }
    } else if (msg.type === "input") {
      try {
        const fallback = msg["event"] as InputEvent | undefined;
        const event = fallback ?? mapPlayerInput(msg);
        if (event) window.agent.injectInput(event);
      } catch {
        /* ignore */
      }
    } else if (msg.type === "peer-left" && msg["role"] === "player") {
      // Player WS dropped — might be a transient reconnect; give 20s grace
      // before tearing down, in case the player's WS reconnects.
      log("[reconnect] Player left signaling — deferred teardown in 20s");
      teardownDeferred("Player left — no reconnect", 20_000);
    } else if (msg.type === "error") {
      log(`Signaling error: ${String(msg["error"])}`);
    }
  };

  ws.onerror = () => {
    setStatus("error", "Signaling connection error");
  };

  // Reconnect the WS with exponential backoff when streaming.
  // Without reconnect, a transient network blip kills the session even if ICE
  // would otherwise recover — the host needs WS alive to exchange re-offers.
  let wsReconnectDelay = 1000;
  ws.onclose = () => {
    log("Signaling closed.");
    if (!isStreaming) {
      teardownDeferred("Signaling closed", 8000);
      return;
    }
    const delay = wsReconnectDelay;
    wsReconnectDelay = Math.min(wsReconnectDelay * 2, 8000);
    log(`[ws] Reconnecting signaling in ${delay}ms…`);
    const closedUrl = ws!.url;
    setTimeout(() => {
      if (!isStreaming) return;
      const newWs = new WebSocket(closedUrl);
      ws = newWs;
      attachWsHandlers(newWs, cfg, wsReconnectDelay);
    }, delay);
  };
}

// Re-attach ws event handlers after a reconnect.
// Mirrors the ws.onmessage / onerror / onclose block inside connect() but
// references the module-level `ws` variable so ICE candidate sending always
// uses the live socket.
// `initialDelay` is the backoff delay already accumulated so far — passed in
// so the reconnect ladder (1→2→4→8s) continues across successive reconnects
// rather than resetting to 1s on every call.
function attachWsHandlers(newWs: WebSocket, cfg: HostConfig, initialDelay = 1000): void {
  let wsReconnectDelay = initialDelay;

  newWs.onopen = () => {
    ws = newWs;
    wsReconnectDelay = 1000; // reset backoff on successful open
    log("[ws] Signaling reconnected");
    // Cancel any deferred teardown scheduled during the WS outage.
    cancelDeferredTeardown();
    // The player's own reconnect loop will re-send an ICE restart offer;
    // we just need the WS to be alive to relay it.
  };

  newWs.onmessage = async (ev) => {
    let msg: { type: string; [k: string]: unknown };
    try {
      msg = JSON.parse(typeof ev.data === "string" ? ev.data : "");
    } catch {
      return;
    }
    if (msg.type === "offer" && pc) {
      log("[ice-restart] Received re-offer (reconnected WS) — renegotiating ICE");
      try {
        const sdp = msg["sdp"] as RTCSessionDescriptionInit | string;
        const desc: RTCSessionDescriptionInit =
          typeof sdp === "string" ? { type: "offer", sdp } : sdp;
        await pc.setRemoteDescription(desc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        newWs.send(
          JSON.stringify({ type: "answer", sdp: { type: answer.type, sdp: answer.sdp } }),
        );
      } catch (err) {
        log(`[ice-restart] Re-offer (reconnected) failed: ${String(err)}`);
      }
    } else if (msg.type === "answer" && pc) {
      const sdp = msg["sdp"] as RTCSessionDescriptionInit | string;
      const desc: RTCSessionDescriptionInit =
        typeof sdp === "string" ? { type: "answer", sdp } : sdp;
      await pc.setRemoteDescription(desc).catch((err) => log(`setRemoteDescription failed: ${String(err)}`));
    } else if (msg.type === "ice-candidate" && pc) {
      try {
        await pc.addIceCandidate(msg["candidate"] as RTCIceCandidateInit);
      } catch (err) {
        log(`ICE add failed: ${String(err)}`);
      }
    } else if (msg.type === "peer-left" && msg["role"] === "player") {
      // Grace period: player may be reconnecting their WS.
      log("[reconnect] Player left signaling (reconnected WS) — deferred teardown in 20s");
      teardownDeferred("Player left — no reconnect", 20_000);
    } else if (msg.type === "peer-joined" && msg["role"] === "player") {
      if (isStreaming) {
        // Same-session player reconnect — cancel deferred teardown, wait for re-offer.
        log("[reconnect] Player re-joined (reconnected WS) — cancelling deferred teardown");
        cancelDeferredTeardown();
      } else {
        await onPlayerJoined(cfg);
      }
    }
  };

  newWs.onerror = () => {
    log("[ws] Reconnected signaling error");
  };

  newWs.onclose = () => {
    if (!isStreaming) {
      teardownDeferred("Signaling closed", 8000);
      return;
    }
    const delay = wsReconnectDelay;
    wsReconnectDelay = Math.min(wsReconnectDelay * 2, 8000);
    log(`[ws] Reconnecting signaling in ${delay}ms…`);
    const closedUrl = newWs.url;
    setTimeout(() => {
      if (!isStreaming) return;
      const nextWs = new WebSocket(closedUrl);
      attachWsHandlers(nextWs, cfg, wsReconnectDelay);
    }, delay);
  };
}

// Send a structured control message to the player via the signaling relay.
// The signaling server forwards any "control" typed message from host → player.
// Used to explicitly communicate host_busy / game_unavailable before the host
// closes its WS or tears down the session.
function sendControlReject(reason: "host_busy" | "game_unavailable"): void {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({ type: "control", action: "reject", reason }),
    );
  }
}

// Fetch authoritative session fields from the server at join time.
async function fetchSessionContext(
  cfg: HostConfig,
  sessionId: string,
): Promise<{
  gameId: string | null;
  claimedByPlayerId: string | null;
  isTest: boolean;
} | null> {
  try {
    const url =
      `${cfg.apiBaseUrl.replace(/\/$/, "")}/api/sessions/${encodeURIComponent(sessionId)}` +
      `?hostToken=${encodeURIComponent(cfg.hostToken)}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = (await resp.json()) as {
      gameId?: string | null;
      claimedByPlayerId?: string | null;
      isTest?: boolean;
    };
    return {
      gameId: data.gameId ?? null,
      claimedByPlayerId: data.claimedByPlayerId ?? null,
      isTest: !!data.isTest,
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Player joined — launch game and start stream
// ─────────────────────────────────────────────────────────────────────────────

async function onPlayerJoined(cfg: HostConfig): Promise<void> {
  // One-active-session guard. If already streaming, the host machine is busy.
  // Send a structured rejection code so the player receives an explicit error.
  // IMPORTANT: Do NOT close ws here — that would destroy the active stream.
  if (isStreaming) {
    log("host_busy — already streaming. Sending rejection to duplicate peer.");
    sendControlReject("host_busy");
    return;
  }
  isStreaming = true;

  setStatus("connecting", "Player joined — preparing stream…");
  resetPipeline(true);

  // Fetch authoritative session context from the server before launching.
  let resolvedGameId = currentGameId;
  let claimedByPlayerId: string | null = null;
  let isTestSession = false;
  if (currentSessionId) {
    const sessionCtx = await fetchSessionContext(cfg, currentSessionId);
    if (sessionCtx?.gameId) {
      if (sessionCtx.gameId !== currentGameId) {
        log(`gameId corrected by server: ${currentGameId} → ${sessionCtx.gameId}`);
      }
      resolvedGameId = sessionCtx.gameId;
      currentGameId = sessionCtx.gameId;
    }
    claimedByPlayerId = sessionCtx?.claimedByPlayerId ?? null;
    isTestSession = sessionCtx?.isTest ?? false;
  }

  // Register exit callback BEFORE launching. When the game process exits,
  // main sends "app:game-exited" → we auto-end the session.
  window.agent.onGameExited(() => {
    log("Game process exited — ending session automatically.");
    void teardown("Game exited");
  });

  // Library-based launch
  if (resolvedGameId && libraryEntries.length > 0) {
    const entry = libraryEntries.find(
      (e) => e.gameId === resolvedGameId && e.enabled,
    );
    if (!entry) {
      log(`[game_unavailable] Game ${resolvedGameId} not in library or disabled.`);
      setPipelineStep("launch", "error", "игры нет в библиотеке или она выключена");
      setStatus("error", "Game unavailable");
      sendControlReject("game_unavailable");
      isStreaming = false;
      void teardown("game_unavailable");
      return;
    }
    const isBrowser = !!entry.boundUrl;
    if (!isBrowser && !entry.localAvailable) {
      log(
        `[game_unavailable] ${entry.game.title}: ${entry.lastError || "file not found"}`,
      );
      setPipelineStep("launch", "error", `файл игры не найден: ${entry.game.title}`);
      setStatus("error", `Game file not found: ${entry.game.title}`);
      sendControlReject("game_unavailable");
      isStreaming = false;
      void teardown("game_unavailable");
      return;
    }

    activeSaveSyncContext = null;
    if (
      currentSessionId &&
      claimedByPlayerId &&
      !isTestSession &&
      !isBrowser
    ) {
      setPipelineStep("saves", "active", "загрузка сейва…");
      const pullResult = await window.agent.saveSyncPull({
        hostToken: cfg.hostToken,
        apiBaseUrl: cfg.apiBaseUrl,
        sessionId: currentSessionId,
        gameId: resolvedGameId,
        appPath: entry.appPath,
        steamAppId: entry.game.steamAppId ?? null,
      });
      activeSaveSyncContext = {
        hostToken: cfg.hostToken,
        apiBaseUrl: cfg.apiBaseUrl,
        sessionId: currentSessionId,
        gameId: resolvedGameId,
        appPath: entry.appPath,
        steamAppId: entry.game.steamAppId ?? null,
      };
      if (!pullResult.ok) {
        log(`Save pull failed: ${pullResult.error ?? "unknown"}`);
        setPipelineStep("saves", "error", pullResult.error ?? "ошибка загрузки");
      } else if (pullResult.skipped) {
        const note =
          pullResult.reason === "no_cloud_save"
            ? "новая игра"
            : pullResult.reason === "no_save_paths"
              ? "пути не найдены"
              : "пропущено";
        setPipelineStep("saves", "done", note);
      } else {
        setPipelineStep("saves", "done", "сейв загружен");
      }
    } else {
      setPipelineStep("saves", "done", "не требуется");
    }

    setPipelineStep("launch", "active");
    const launchResult = await window.agent.launchEntry({
      appPath: entry.appPath,
      boundUrl: entry.boundUrl,
      launchArgs: entry.launchArgs,
    });
    if (!launchResult.ok) {
      // Hard-fail: do not start WebRTC capture when the game couldn't launch.
      log(`[game_unavailable] Launch failed for ${entry.game.title}: ${launchResult.error}`);
      setPipelineStep("launch", "error", `запуск не удался: ${launchResult.error}`);
      setStatus("error", `Launch failed: ${launchResult.error}`);
      sendControlReject("game_unavailable");
      isStreaming = false;
      void teardown("game_unavailable");
      return;
    }
    log(`Launched ${entry.game.title} (pid=${launchResult.pid ?? "browser"}).`);
    setPipelineStep("launch", "done", entry.game.title);
  } else {
    setPipelineStep("saves", "done", "не требуется");
    setPipelineStep("launch", "active");
    // Legacy path: launch from HostConfig.appPath / boundUrl
    const launchResult = await window.agent.launchApp();
    if (!launchResult.ok) {
      // Hard-fail: do not capture if legacy app couldn't launch.
      log(`[game_unavailable] Legacy launch failed: ${launchResult.error}`);
      setPipelineStep("launch", "error", `запуск не удался: ${launchResult.error}`);
      setStatus("error", `Launch failed: ${launchResult.error}`);
      sendControlReject("game_unavailable");
      isStreaming = false;
      void teardown("game_unavailable");
      return;
    }
    log(`App launched (pid=${launchResult.pid}).`);
    setPipelineStep("launch", "done");
  }

  setPipelineStep("window", "active", "ищем окно игры…");
  try {
    captureStream = await captureScreen(cfg);
  } catch (err) {
    setPipelineStep("window", "error", String(err));
    setStatus("error", `Capture failed: ${String(err)}`);
    sendControlReject("game_unavailable");
    isStreaming = false;
    void teardown("capture_failed");
    return;
  }
  setPipelineStep("stream", "active", "устанавливаем WebRTC-соединение…");

  // Fetch ICE server config (STUN + optional TURN) from the API.
  let iceServers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
  try {
    const cfgRes = await fetch(`${cfg.apiBaseUrl.replace(/\/$/, "")}/api/public/ice-config`);
    if (cfgRes.ok) {
      const cfgJson = (await cfgRes.json()) as { iceServers: RTCIceServer[] };
      if (Array.isArray(cfgJson.iceServers) && cfgJson.iceServers.length > 0) {
        iceServers = cfgJson.iceServers;
      }
    }
  } catch {
    log("[ice] Failed to fetch ICE config, using default STUN only");
  }

  pc = new RTCPeerConnection({ iceServers });

  pc.onicecandidate = (e) => {
    if (e.candidate && ws?.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "ice-candidate",
          candidate: e.candidate.toJSON(),
        }),
      );
    }
  };
  pc.onconnectionstatechange = () => {
    log(`Peer state: ${pc?.connectionState}`);
    if (pc?.connectionState === "connected") {
      setStatus("streaming", "Streaming to player");
      setPipelineStep("stream", "done");
      setPipelineStep("player", "done");
      // Log the ICE candidate type (relay / srflx / host) for diagnostics.
      void pc.getStats().then((stats) => {
        stats.forEach((report) => {
          if (report.type === "candidate-pair" && report.state === "succeeded") {
            const localId: string = (report as unknown as Record<string, string>)["localCandidateId"];
            stats.forEach((r) => {
              if (r.id === localId && r.type === "local-candidate") {
                const t = (r as unknown as Record<string, string>)["candidateType"] ?? "host";
                log(`[ice] connection type: ${t}`);
              }
            });
          }
        });
      });
    } else if (pc?.connectionState === "closed") {
      // Terminal state — clean up immediately.
      teardownPeer(cfg);
    } else if (pc?.connectionState === "failed") {
      // ICE negotiation failed; give 30s for ICE restart to recover before
      // tearing down.  The player side triggers restartIce() automatically.
      log("[ice] connectionState failed — deferred teardown in 30s");
      teardownDeferred("ICE failed — no recovery", 30_000);
    } else if (pc?.connectionState === "disconnected") {
      // Transient loss (e.g. Wi-Fi handover).  Give 30s for ICE restart.
      log("[ice] connectionState disconnected — deferred teardown in 30s");
      teardownDeferred("ICE disconnected — no recovery", 30_000);
    }
  };

  pc.ondatachannel = (ev) => {
    dataChannel = ev.channel;
    dataChannel.onmessage = (m) => {
      try {
        const raw = JSON.parse(m.data) as Record<string, unknown>;
        // E2E latency ping — reflect timestamp back to player immediately.
        if (raw["type"] === "dc-ping") {
          if (dataChannel?.readyState === "open") {
            dataChannel.send(JSON.stringify({ type: "dc-pong", t: raw["t"] }));
          }
          return;
        }
        // Adaptive-bitrate hint from the player: renegotiate the video sender's
        // maxBitrate live without a full re-offer.
        if (raw["type"] === "set-bitrate") {
          const kbps = Number(raw["kbps"]);
          if (Number.isFinite(kbps) && kbps > 0) {
            const clamped = Math.max(300, Math.min(20_000, Math.round(kbps)));
            const sender = pc?.getSenders().find((s) => s.track?.kind === "video");
            if (sender) {
              const p = sender.getParameters();
              p.encodings = p.encodings ?? [{}];
              p.encodings[0]!.maxBitrate = clamped * 1000;
              void sender.setParameters(p).catch(() => undefined);
            }
          }
          return;
        }
        // FPS cap hint from the player.
        if (raw["type"] === "set-fps") {
          const fps = Number(raw["fps"]);
          if (Number.isFinite(fps) && fps > 0) {
            const clamped = Math.max(15, Math.min(144, Math.round(fps)));
            const sender = pc?.getSenders().find((s) => s.track?.kind === "video");
            if (sender) {
              const p = sender.getParameters();
              p.encodings = p.encodings ?? [{}];
              p.encodings[0]!.maxFramerate = clamped;
              void sender.setParameters(p).catch(() => undefined);
            }
          }
          return;
        }
        // Gamepad input from the virtual touch overlay on mobile.
        if (raw["type"] === "gamepad") {
          // Validate payload shape and clamp to expected ranges.
          const rawAxes = Array.isArray(raw["axes"]) ? (raw["axes"] as unknown[]) : null;
          const rawBtns = Array.isArray(raw["buttons"]) ? (raw["buttons"] as unknown[]) : null;
          if (!rawAxes || !rawBtns) return; // malformed — discard
          // Clamp axes to [-1, 1]; buttons to {0, 1}.
          const axes = rawAxes.map((v) =>
            Math.max(-1, Math.min(1, typeof v === "number" ? v : 0)),
          );
          const buttons = rawBtns.map((v) => (v ? 1 : 0));
          // Forward to ViGEm/XInput injection layer when the IPC method is
          // available (added in a future task). Until then, warn once and skip.
          if (typeof (window.agent as Record<string, unknown>)["injectGamepad"] === "function") {
            (window.agent as unknown as { injectGamepad: (s: { axes: number[]; buttons: number[] }) => void }).injectGamepad({ axes, buttons });
          } else if (!gamepadWarnedOnce) {
            gamepadWarnedOnce = true;
            log("[gamepad] ViGEm/XInput backend not connected — overlay input received but not injected.");
          }
          return;
        }
        const event =
          typeof raw["kind"] === "string" &&
          (raw["kind"] === "mousemove" ||
            raw["kind"] === "mousedown" ||
            raw["kind"] === "mouseup" ||
            raw["kind"] === "wheel" ||
            raw["kind"] === "keydown" ||
            raw["kind"] === "keyup")
            ? (raw as unknown as InputEvent)
            : mapPlayerInput(raw);
        if (event) window.agent.injectInput(event);
      } catch {
        /* ignore */
      }
    };
  };

  for (const track of captureStream.getTracks()) {
    pc.addTrack(track, captureStream);
  }

  const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
  if (videoSender) {
    const params = videoSender.getParameters();
    params.encodings = params.encodings ?? [{}];
    params.encodings[0]!.maxBitrate = cfg.bitrateKbps * 1000;
    await videoSender.setParameters(params).catch(() => undefined);
  }

  // Set Opus audio bitrate based on selected audioMode.
  const audioModeBitrate: Record<string, number> = {
    voice: 12_000,
    standard: 32_000,
    quality: 64_000,
  };
  const selectedAudioMode = cfg.audioMode ?? "off";
  if (selectedAudioMode !== "off") {
    const audioBitrate = audioModeBitrate[selectedAudioMode];
    const audioSender = pc.getSenders().find((s) => s.track?.kind === "audio");
    if (audioSender && audioBitrate) {
      const audioParams = audioSender.getParameters();
      audioParams.encodings = audioParams.encodings ?? [{}];
      audioParams.encodings[0]!.maxBitrate = audioBitrate;
      await audioSender.setParameters(audioParams).catch(() => undefined);
      log(`[audio] Opus maxBitrate set to ${audioBitrate / 1000} kbps (mode=${selectedAudioMode})`);
    }
  }

  // Force H.264 via setCodecPreferences so NVENC is used wherever available.
  const videoTransceiver = pc.getTransceivers().find(
    (t) => t.sender.track?.kind === "video",
  );
  if (videoTransceiver) {
    const capabilities = RTCRtpSender.getCapabilities("video");
    if (capabilities) {
      const h264 = capabilities.codecs.filter(
        (c) => c.mimeType.toLowerCase() === "video/h264",
      );
      if (h264.length > 0) {
        try {
          videoTransceiver.setCodecPreferences(h264);
          log("[h264] setCodecPreferences applied — H.264 preferred");
        } catch {
          log("[h264] setCodecPreferences not supported in this runtime");
        }
      }
    }
  }

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  ws?.send(
    JSON.stringify({
      type: "offer",
      sdp: { type: offer.type, sdp: offer.sdp },
    }),
  );
  setPipelineStep("player", "active", "ждём подключения игрока…");
}

// ─────────────────────────────────────────────────────────────────────────────
// Input mapping
// ─────────────────────────────────────────────────────────────────────────────

function mapPlayerInput(raw: Record<string, unknown>): InputEvent | null {
  if (raw["type"] !== "input") return null;
  const kind = raw["kind"];
  const action = raw["action"];
  if (kind === "key" && (action === "down" || action === "up")) {
    const code = String(raw["key"] ?? "");
    return action === "down"
      ? { kind: "keydown", code, key: code }
      : { kind: "keyup", code, key: code };
  }
  if (kind === "mouse") {
    if (action === "move") {
      return {
        kind: "mousemove",
        x: Number(raw["movementX"] ?? 0),
        y: Number(raw["movementY"] ?? 0),
        mode: "relative",
      };
    }
    if (action === "down" || action === "up") {
      const buttonIdx = Number(raw["button"] ?? 0);
      const button: "left" | "right" | "middle" =
        buttonIdx === 2 ? "right" : buttonIdx === 1 ? "middle" : "left";
      return action === "down"
        ? { kind: "mousedown", button }
        : { kind: "mouseup", button };
    }
  }
  if (kind === "wheel") {
    return { kind: "wheel", deltaY: Number(raw["deltaY"] ?? 0) };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen capture
// ─────────────────────────────────────────────────────────────────────────────

function exeBasename(path: string | undefined | null): string | undefined {
  return path
    ?.split(/[\\/]/)
    .pop()
    ?.replace(/\.exe$/i, "")
    .toLowerCase();
}

function targetExeName(cfg: HostConfig): string | undefined {
  // Currently-selected library game's exe name takes priority.
  if (currentGameId) {
    const entry = libraryEntries.find((e) => e.gameId === currentGameId);
    const name = exeBasename(entry?.appPath);
    if (name) return name;
  }
  // Fall back to HostConfig appPath basename.
  return exeBasename(cfg.appPath);
}

// Manual window picker — shown when auto-matching the game window fails.
// Resolves with the chosen source, or the primary screen if the host clicks
// "Стримить весь экран".
function pickWindowManually(): Promise<{ id: string; name: string }> {
  const modal = document.getElementById("window-picker-modal") as HTMLElement;
  const list = document.getElementById("window-picker-list") as HTMLUListElement;
  const refreshBtn = document.getElementById("window-picker-refresh") as HTMLButtonElement;
  const screenBtn = document.getElementById("window-picker-screen") as HTMLButtonElement;

  return new Promise((resolve) => {
    const cleanup = () => {
      modal.hidden = true;
      refreshBtn.onclick = null;
      screenBtn.onclick = null;
      list.innerHTML = "";
    };

    const render = async () => {
      const sources = await window.agent.getCaptureSources();
      list.innerHTML = "";
      for (const source of sources) {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = source.id.startsWith("screen:")
          ? `🖥 ${source.name}`
          : `🪟 ${source.name}`;
        btn.style.width = "100%";
        btn.style.textAlign = "left";
        btn.onclick = () => {
          cleanup();
          resolve(source);
        };
        li.appendChild(btn);
        list.appendChild(li);
      }
    };

    refreshBtn.onclick = () => void render();
    screenBtn.onclick = async () => {
      const sources = await window.agent.getCaptureSources();
      const screen = sources.find((s) => s.id.startsWith("screen:")) ?? sources[0];
      cleanup();
      resolve(screen);
    };

    modal.hidden = false;
    void render();
  });
}

async function captureScreen(cfg: HostConfig): Promise<MediaStream> {
  let sources = await window.agent.getCaptureSources();
  if (sources.length === 0) {
    throw new Error("Нет доступных источников захвата экрана/окна");
  }
  let chosen: { id: string; name: string } | undefined;
  if (cfg.captureSourceName) {
    chosen = sources.find((s) => s.name === cfg.captureSourceName);
  }

  const targetName = targetExeName(cfg);
  if (!chosen && targetName) {
    // The game window may take a while to appear after launch — retry the
    // auto-match for ~10 seconds before bothering the host with the picker.
    const RETRY_MS = 2_000;
    const MAX_ATTEMPTS = 5;
    for (let attempt = 0; attempt < MAX_ATTEMPTS && !chosen; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, RETRY_MS));
        sources = await window.agent.getCaptureSources();
      }
      chosen = sources.find((s) => s.name.toLowerCase().includes(targetName));
      if (!chosen && attempt < MAX_ATTEMPTS - 1) {
        setPipelineStep("window", "active", `ищем окно «${targetName}»… (${attempt + 1}/${MAX_ATTEMPTS})`);
      }
    }
  }

  if (!chosen && targetName) {
    // Auto-match failed → ask the host to pick the window manually instead of
    // silently streaming the wrong screen.
    log(`Окно «${targetName}» не найдено автоматически — открываю ручной выбор.`);
    setPipelineStep("window", "active", "выбери окно вручную");
    chosen = await pickWindowManually();
  }

  if (!chosen) {
    chosen = sources.find((s) => s.id.startsWith("screen:"));
  }
  if (!chosen) {
    // List available windows so the user can diagnose what went wrong.
    const names = sources.map((s) => s.name).join(", ");
    throw new Error(
      `Окно игры не найдено автоматически. ` +
      `Зайди в Настройки → «Цель захвата» и выбери нужное окно из списка. ` +
      `Доступные окна: ${names || "(пусто — попробуй перезапустить игру)"}`,
    );
  }
  const sourceId = chosen.id;
  log(`Capturing source: ${chosen.name}`);
  setPipelineStep("window", "done", chosen.name);

  const audioMode = cfg.audioMode ?? "off";
  const constraints = {
    audio: audioMode !== "off"
      ? ({
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: sourceId,
          },
        } as unknown as MediaTrackConstraints)
      : false,
    video: {
      mandatory: {
        chromeMediaSource: "desktop",
        chromeMediaSourceId: sourceId,
        maxWidth: cfg.resolution.width,
        maxHeight: cfg.resolution.height,
        maxFrameRate: 60,
      },
    },
  } as unknown as MediaStreamConstraints;

  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  if (audioMode !== "off") {
    const audioTracks = stream.getAudioTracks();
    log(`[audio] ${audioTracks.length} audio track(s) captured (mode=${audioMode})`);
  }
  return stream;
}

// ─────────────────────────────────────────────────────────────────────────────
// Teardown
// ─────────────────────────────────────────────────────────────────────────────

function teardownPeer(cfg: HostConfig): void {
  isStreaming = false;
  try { dataChannel?.close(); } catch { /* */ }
  dataChannel = null;
  try { pc?.close(); } catch { /* */ }
  pc = null;
  captureStream?.getTracks().forEach((t) => t.stop());
  captureStream = null;
  if (cfg.killAppOnDisconnect) {
    window.agent.killApp();
  }
  setStatus("idle", "Player disconnected — waiting");
}

let pendingTeardown: ReturnType<typeof setTimeout> | null = null;

function cancelDeferredTeardown(): void {
  if (pendingTeardown) {
    clearTimeout(pendingTeardown);
    pendingTeardown = null;
  }
}

function teardownDeferred(reason: string, graceMs: number): void {
  cancelDeferredTeardown();
  const sidAtSchedule = currentSessionId;
  pendingTeardown = setTimeout(() => {
    pendingTeardown = null;
    if (currentSessionId && currentSessionId === sidAtSchedule) {
      void teardown(reason);
    }
  }, graceMs);
}

function teardown(reason: string): Promise<void> {
  return teardownAsync(reason);
}

async function teardownAsync(reason: string): Promise<void> {
  cancelDeferredTeardown();
  isStreaming = false;
  log(reason);

  const saveCtx = activeSaveSyncContext;
  activeSaveSyncContext = null;

  if (saveCtx) {
    setPipelineStep("saves", "active", "сохранение сейва…");
    try {
      const pushResult = await Promise.race([
        window.agent.saveSyncPush(saveCtx),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("timeout")), 30_000);
        }),
      ]);
      if (!pushResult.ok) {
        log(`Save push failed: ${pushResult.error ?? "unknown"}`);
        setPipelineStep("saves", "error", pushResult.error ?? "ошибка сохранения");
      } else if (pushResult.skipped) {
        log(`Save push skipped: ${pushResult.reason ?? "unknown"}`);
        setPipelineStep("saves", "done", "нечего сохранять");
      } else {
        log("Save uploaded to cloud.");
        setPipelineStep("saves", "done", "сейв сохранён");
      }
    } catch (err) {
      log(`Save push error: ${String(err)}`);
      setPipelineStep("saves", "error", "таймаут сохранения");
    }
  }

  if (currentSessionId && currentConfig?.hostToken && currentConfig.apiBaseUrl) {
    const sid = currentSessionId;
    const base = currentConfig.apiBaseUrl.replace(/\/$/, "");
    void fetch(`${base}/api/sessions/${encodeURIComponent(sid)}/end`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostToken: currentConfig.hostToken }),
    }).catch((err) => log(`Failed to end session on server: ${String(err)}`));
  }
  try { ws?.close(); } catch { /* */ }
  ws = null;
  try { pc?.close(); } catch { /* */ }
  pc = null;
  captureStream?.getTracks().forEach((t) => t.stop());
  captureStream = null;
  if (currentConfig?.killAppOnDisconnect) {
    window.agent.killApp();
  }
  currentSessionId = null;
  currentGameId = null;
  shareCard.hidden = true;
  setStatus("idle", reason);
  connectBtn.disabled = false;
  disconnectBtn.disabled = true;
  // Close the preview WS so players don't get an orphaned preview connection.
  teardownPreview();
}

// ─────────────────────────────────────────────────────────────────────────────
// Preview stream — host side
// ─────────────────────────────────────────────────────────────────────────────

function teardownPreview(): void {
  try { previewPc?.close(); } catch { /* */ }
  previewPc = null;
  previewOwnStream?.getTracks().forEach((t) => t.stop());
  previewOwnStream = null;
  if (previewIndicator) previewIndicator.hidden = true;
  // Keep previewWs open — it stays connected while the main session is alive
  // so the host is ready to serve the next preview request.
}

function closePreviewWs(): void {
  teardownPreview();
  try { previewWs?.close(); } catch { /* */ }
  previewWs = null;
}

async function onPreviewPlayerJoined(cfg: HostConfig): Promise<void> {
  log("[preview] Player joined preview room — starting preview stream.");
  if (previewIndicator) previewIndicator.hidden = false;

  // Reuse the existing capture stream if the host is actively streaming.
  // Otherwise capture a fresh stream (shows whatever is on screen right now).
  let stream = captureStream;
  if (!stream) {
    try {
      stream = await captureScreen(cfg);
      previewOwnStream = stream; // we own this — clean up on teardown
    } catch (err) {
      log(`[preview] Could not capture screen: ${String(err)}`);
      if (previewIndicator) previewIndicator.hidden = true;
      return;
    }
  }

  // Fetch ICE config.
  let iceServers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
  try {
    const cfgRes = await fetch(`${cfg.apiBaseUrl.replace(/\/$/, "")}/api/public/ice-config`);
    if (cfgRes.ok) {
      const cfgJson = (await cfgRes.json()) as { iceServers: RTCIceServer[] };
      if (Array.isArray(cfgJson.iceServers) && cfgJson.iceServers.length > 0) {
        iceServers = cfgJson.iceServers;
      }
    }
  } catch { /* use default */ }

  const ppc = new RTCPeerConnection({ iceServers });
  previewPc = ppc;

  ppc.onicecandidate = (e) => {
    if (e.candidate && previewWs?.readyState === WebSocket.OPEN) {
      previewWs.send(JSON.stringify({ type: "ice-candidate", candidate: e.candidate.toJSON() }));
    }
  };

  ppc.onconnectionstatechange = () => {
    log(`[preview] Peer state: ${ppc.connectionState}`);
    if (ppc.connectionState === "closed" || ppc.connectionState === "failed" || ppc.connectionState === "disconnected") {
      if (previewPc === ppc) teardownPreview();
    }
  };

  // Add only video tracks — preview is always muted.
  for (const track of stream.getVideoTracks()) {
    ppc.addTrack(track, stream);
  }

  try {
    const offer = await ppc.createOffer();
    await ppc.setLocalDescription(offer);
    previewWs?.send(JSON.stringify({ type: "offer", sdp: { type: offer.type, sdp: offer.sdp } }));
    log("[preview] Offer sent to preview player.");
  } catch (err) {
    log(`[preview] Failed to create/send offer: ${String(err)}`);
    teardownPreview();
  }
}

function connectPreviewWs(cfg: HostConfig): void {
  if (cfg.allowPreview === false) {
    log("[preview] Preview disabled in settings — skipping preview WS.");
    return;
  }
  if (!cfg.hostToken || !cfg.apiBaseUrl) return;

  // Close any existing preview WS first.
  closePreviewWs();

  let sigUrl: URL;
  try {
    sigUrl = new URL(deriveSignalingUrl(cfg));
  } catch {
    return;
  }
  sigUrl.searchParams.set("type", "preview");
  sigUrl.searchParams.set("hostToken", cfg.hostToken);

  const pws = new WebSocket(sigUrl.toString());
  previewWs = pws;

  pws.onopen = () => {
    log("[preview] Preview signaling connected — ready to accept preview requests.");
  };

  pws.onmessage = async (ev) => {
    let msg: { type: string; [k: string]: unknown };
    try {
      msg = JSON.parse(typeof ev.data === "string" ? ev.data : "");
    } catch {
      return;
    }

    if (msg.type === "peer-joined" && msg["role"] === "player") {
      if (previewPc) {
        // Already in a preview — ignore additional player
        log("[preview] Already in a preview, ignoring duplicate peer-joined.");
        return;
      }
      const currentCfg = currentConfig ?? cfg;
      await onPreviewPlayerJoined(currentCfg);
    } else if (msg.type === "answer" && previewPc) {
      const sdp = msg["sdp"] as RTCSessionDescriptionInit | string;
      const desc: RTCSessionDescriptionInit = typeof sdp === "string" ? { type: "answer", sdp } : sdp;
      await previewPc.setRemoteDescription(desc).catch((err) => log(`[preview] setRemoteDescription failed: ${String(err)}`));
    } else if (msg.type === "ice-candidate" && previewPc) {
      try {
        await previewPc.addIceCandidate(msg["candidate"] as RTCIceCandidateInit);
      } catch (err) {
        log(`[preview] ICE add failed: ${String(err)}`);
      }
    } else if (msg.type === "peer-left") {
      log("[preview] Preview player left.");
      teardownPreview();
    } else if (msg.type === "preview-ended") {
      log("[preview] Preview ended by server.");
      teardownPreview();
    }
  };

  pws.onerror = () => {
    log("[preview] Preview signaling error.");
  };

  pws.onclose = () => {
    log("[preview] Preview signaling closed.");
    if (previewWs === pws) {
      previewWs = null;
      teardownPreview();
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Steam library scanner
// ─────────────────────────────────────────────────────────────────────────────

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
let currentSteamTab: SteamTab = "catalog";
// Whether this is the first ever scan (seenAppIds was empty before this scan).
let steamIsFirstScan = true;
let steamGames: SteamScanGame[] = [];
// Map from appId → checkbox element (for visible items).
const steamCheckboxMap = new Map<string, HTMLInputElement>();

// When delta mode is on, only show games that are newly discovered this scan.
function isDeltaActive(): boolean {
  return !steamIsFirstScan && steamDeltaMode.checked;
}

function steamGamesForTab(tab: SteamTab): SteamScanGame[] {
  const delta = isDeltaActive();
  if (tab === "added") return steamGames.filter((g) => g.alreadyInLibrary && (!delta || g.isNewDiscovery));
  if (tab === "catalog") return steamGames.filter((g) => !g.alreadyInLibrary && g.catalogGame !== null && (!delta || g.isNewDiscovery));
  return steamGames.filter((g) => !g.alreadyInLibrary && g.catalogGame === null && (!delta || g.isNewDiscovery));
}

function renderSteamTab(tab: SteamTab): void {
  currentSteamTab = tab;
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
  const games = steamGamesForTab(currentSteamTab);
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
  renderSteamTab(currentSteamTab);
  // Update badge counts to reflect the active filter.
  const delta = isDeltaActive();
  const inCatalog = steamGames.filter((g) => !g.alreadyInLibrary && g.catalogGame !== null && (!delta || g.isNewDiscovery)).length;
  const isNew = steamGames.filter((g) => !g.alreadyInLibrary && g.catalogGame === null && (!delta || g.isNewDiscovery)).length;
  const added = steamGames.filter((g) => g.alreadyInLibrary && (!delta || g.isNewDiscovery)).length;
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

scanSteamBtn.addEventListener("click", async () => {
  const cfg = readForm();
  if (!cfg.hostToken || !cfg.apiBaseUrl) {
    log("Set host token and platform URL before scanning Steam library.");
    return;
  }
  showSteamModal();
  scanSteamBtn.disabled = true;
  try {
    const result = await window.agent.scanSteam(cfg.hostToken, cfg.apiBaseUrl);
    steamScanProgress.hidden = true;

    if (result.error && result.games.length === 0) {
      steamScanError.hidden = false;
      steamScanErrorText.textContent = result.error;
      return;
    }

    steamGames = result.games;

    // Determine if this was the first scan: if all games are new discoveries,
    // the seenAppIds set was empty before (first run).
    steamIsFirstScan = steamGames.every((g) => g.isNewDiscovery);
    // On re-scans default to delta mode (show new only).
    if (!steamIsFirstScan) {
      steamDeltaMode.checked = true;
    } else {
      steamDeltaMode.checked = false;
    }

    const newCount = steamGames.filter((g) => g.isNewDiscovery).length;
    const inCatalog = steamGames.filter((g) => !g.alreadyInLibrary && g.catalogGame !== null).length;
    const isNew = steamGames.filter((g) => !g.alreadyInLibrary && g.catalogGame === null).length;
    const added = steamGames.filter((g) => g.alreadyInLibrary).length;

    badgeCatalog.textContent = String(inCatalog);
    badgeNew.textContent = String(isNew);
    badgeAdded.textContent = String(added);

    const isReScan = !steamIsFirstScan;
    steamScanSummary.textContent = isReScan
      ? `Re-scan: ${newCount} new game${newCount !== 1 ? "s" : ""} since last scan (${steamGames.length} total installed).` +
        (result.error ? `  ⚠️ ${result.error}` : "")
      : `Found ${steamGames.length} installed Steam game${steamGames.length !== 1 ? "s" : ""}.` +
        (result.error ? `  ⚠️ ${result.error}` : "");

    steamScanResults.hidden = false;

    // Auto-pick best starting tab.
    const startTab: SteamTab = inCatalog > 0 ? "catalog" : isNew > 0 ? "new" : "added";
    renderSteamTab(startTab);
    log(`Steam scan: ${steamGames.length} game(s) found.`);
  } catch (err) {
    steamScanProgress.hidden = true;
    steamScanError.hidden = false;
    steamScanErrorText.textContent = `Scan failed: ${String(err)}`;
    log(`Steam scan error: ${String(err)}`);
  } finally {
    scanSteamBtn.disabled = false;
  }
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
          headers: { "content-type": "application/json" },
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
        const g = steamGames.find((g) => g.appId === game.appId);
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
  const inCatalog = steamGames.filter((g) => !g.alreadyInLibrary && g.catalogGame !== null).length;
  const isNew = steamGames.filter((g) => !g.alreadyInLibrary && g.catalogGame === null).length;
  const added = steamGames.filter((g) => g.alreadyInLibrary).length;
  badgeCatalog.textContent = String(inCatalog);
  badgeNew.textContent = String(isNew);
  badgeAdded.textContent = String(added);
  renderSteamTab(currentSteamTab);

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
        headers: { "content-type": "application/json" },
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
            headers: { "content-type": "application/json" },
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

// ─────────────────────────────────────────────────────────────────────────────
// Auto-quota matching
// The 60s polling scheduler runs in the main process (survives renderer reloads).
// The renderer just subscribes to "quota:status" push events via IPC and
// updates the UI accordingly.
// ─────────────────────────────────────────────────────────────────────────────

const autoQuotaCard = document.getElementById("auto-quota-card") as HTMLElement;
const autoQuotaCheckbox = document.getElementById("autoQuotaEnabled") as HTMLInputElement;
const autoQuotaStatusEl = document.getElementById("auto-quota-status") as HTMLDivElement;
const autoQuotaActionsEl = document.getElementById("auto-quota-actions") as HTMLDivElement;
const detachQuotaBtn = document.getElementById("detach-quota-btn") as HTMLButtonElement;

function showAutoQuotaCard(): void {
  autoQuotaCard.hidden = false;
}

function applyQuotaStatus(ev: { statusText: string; hasAttached: boolean }): void {
  autoQuotaStatusEl.textContent = ev.statusText;
  autoQuotaActionsEl.style.display = ev.hasAttached ? "block" : "none";
}

// Subscribe to push events from the main-process scheduler.
window.agent.onQuotaStatus((ev) => {
  applyQuotaStatus(ev);
});

autoQuotaCheckbox.addEventListener("change", async () => {
  const cfg = currentConfig ?? (await window.agent.getConfig());
  const enabled = autoQuotaCheckbox.checked;
  const saved = await window.agent.setConfig({ ...cfg, autoQuotaEnabled: enabled });
  currentConfig = saved;
  if (enabled) {
    log("Автоподбор квот включён.");
    applyQuotaStatus({ statusText: "Ищу подходящие квоты…", hasAttached: false });
    // Ask main process to run a match cycle immediately (instead of waiting 60s).
    window.agent.quotaRunCycle();
  } else {
    log("Автоподбор квот выключен.");
    applyQuotaStatus({ statusText: "Автоподбор выключен.", hasAttached: false });
  }
});

detachQuotaBtn.addEventListener("click", async () => {
  detachQuotaBtn.disabled = true;
  try {
    const result = await window.agent.quotaDetach();
    if (result.ok) {
      log("Квота отвязана. Ищу следующую…");
      applyQuotaStatus({ statusText: "Квота отвязана. Ищу следующую…", hasAttached: false });
    } else {
      log("Не удалось отвязать квоту.");
    }
  } finally {
    detachQuotaBtn.disabled = false;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Agent key & PC binding UI
// ─────────────────────────────────────────────────────────────────────────────

const agentKeyStatusEl = document.getElementById("agent-key-status") as HTMLParagraphElement;
const bindKeyBtn = document.getElementById("bind-agent-key") as HTMLButtonElement;
const agentLoginBtn = document.getElementById("agent-login") as HTMLButtonElement;
const updatePcSpecsBtn = document.getElementById("update-pc-specs") as HTMLButtonElement;
const pcSpecsInfoEl = document.getElementById("pc-specs-info") as HTMLParagraphElement;

async function initAgentKey(): Promise<void> {
  try {
    const pubkey = await window.agent.getAgentPubkey();
    if (pubkey) {
      agentKeyStatusEl.textContent = `Ключ: ${pubkey.slice(0, 16)}…${pubkey.slice(-8)} (готов к привязке)`;
    } else {
      agentKeyStatusEl.textContent = "Ключ не найден. Перезапустите агент.";
    }
  } catch {
    agentKeyStatusEl.textContent = "Ошибка загрузки ключа.";
  }

  try {
    const specs = await window.agent.getPcSpecs();
    pcSpecsInfoEl.textContent = `CPU: ${specs.cpu} · GPU: ${specs.gpu} · RAM: ${specs.ramGb} GB`;
  } catch {
    pcSpecsInfoEl.textContent = "";
  }

  bindKeyBtn.disabled = false;
  agentLoginBtn.disabled = false;
  updatePcSpecsBtn.disabled = false;

  // Run upload speed test silently in the background on every startup so that
  // pcSpecs.uploadMbps is always up-to-date for quota matching.
  try {
    const cfg = await window.agent.getConfig();
    if (cfg.hostToken && cfg.apiBaseUrl) {
      void runUploadSpeedtest(cfg.apiBaseUrl, cfg.hostToken);
    }
  } catch {
    // Non-fatal — do not block startup
  }
}

bindKeyBtn.addEventListener("click", async () => {
  const cfg = currentConfig ?? (await window.agent.getConfig());
  if (!cfg.hostToken || !cfg.apiBaseUrl) {
    log("Bind key: сначала сохрани Host Token и Platform URL.");
    return;
  }
  bindKeyBtn.disabled = true;
  agentKeyStatusEl.textContent = "Привязываем ключ…";
  const result = await window.agent.bindAgentKey(cfg.hostToken, cfg.apiBaseUrl);
  bindKeyBtn.disabled = false;
  if (result.ok) {
    agentKeyStatusEl.textContent = "Ключ успешно привязан к аккаунту.";
    log("Ключ агента привязан к аккаунту.");
  } else {
    agentKeyStatusEl.textContent = `Ошибка привязки: ${result.error ?? "Unknown error"}`;
    log(`Bind key error: ${result.error ?? "Unknown"}`);
  }
});

agentLoginBtn.addEventListener("click", async () => {
  const cfg = currentConfig ?? (await window.agent.getConfig());
  if (!cfg.apiBaseUrl) {
    log("Login: сначала сохрани Platform URL.");
    return;
  }
  agentLoginBtn.disabled = true;
  agentKeyStatusEl.textContent = "Авторизуемся…";
  const result = await window.agent.agentLogin(cfg.apiBaseUrl);
  agentLoginBtn.disabled = false;
  if (result.ok) {
    agentKeyStatusEl.textContent = "Браузер открыт — дашборд загружается.";
    log("Открыт браузер с дашбордом (agent login).");
  } else {
    agentKeyStatusEl.textContent = `Ошибка входа: ${result.error ?? "Unknown error"}`;
    log(`Agent login error: ${result.error ?? "Unknown"}`);
  }
});

async function runUploadSpeedtest(apiBaseUrl: string, hostToken: string): Promise<void> {
  try {
    const MB = 1 * 1024 * 1024;
    const payload = new Uint8Array(MB);
    crypto.getRandomValues(payload.slice(0, Math.min(65536, MB)));
    const resp = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/api/hosts/me/speedtest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(MB),
        "X-Host-Token": hostToken,
      },
      body: payload,
    });
    if (resp.ok) {
      const data = (await resp.json()) as { uploadMbps?: number };
      if (data.uploadMbps != null) {
        log(`Скорость аплоада: ${data.uploadMbps} Мбит/с`);
      }
    }
  } catch {
    // Non-fatal — don't block the agent on speedtest failures
  }
}

updatePcSpecsBtn.addEventListener("click", async () => {
  const cfg = currentConfig ?? (await window.agent.getConfig());
  if (!cfg.hostToken || !cfg.apiBaseUrl) {
    log("Update specs: сначала сохрани Host Token и Platform URL.");
    return;
  }
  updatePcSpecsBtn.disabled = true;
  log("Измеряем скорость аплоада…");
  await runUploadSpeedtest(cfg.apiBaseUrl, cfg.hostToken);
  const result = await window.agent.updatePcSpecs(cfg.hostToken, cfg.apiBaseUrl);
  updatePcSpecsBtn.disabled = false;
  if (result.ok && result.pcSpecs) {
    const s = result.pcSpecs;
    pcSpecsInfoEl.textContent = `CPU: ${s.cpu} · GPU: ${s.gpu} · RAM: ${s.ramGb} GB`;
    log(`PC-спецификации обновлены. GPU: ${s.gpu}, RAM: ${s.ramGb}GB`);
  } else {
    log(`Update PC specs error: ${result.error ?? "Unknown"}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────────────────────

void loadFormFromConfig().then(async (cfg) => {
  log("Agent UI loaded.");
  void initAgentKey();
  // Input injector health — warn the host up-front if player control won't work.
  void window.agent.getInjectorStatus().then((st) => {
    if (!st.ok && st.platform === "win32") {
      log(`⚠ ${st.error}`);
    }
  }).catch(() => { /* older main without the handler */ });
  if (cfg.hostToken && cfg.apiBaseUrl) {
    log("Stored credentials detected. Loading library…");

    // Auto-login: validate the saved token and show the signed-in banner so the
    // user doesn't have to re-enter credentials on every launch.
    const displayName = await validateHostToken(cfg.apiBaseUrl, cfg.hostToken);
    if (displayName) {
      showSigninBanner(displayName, cfg.apiBaseUrl);
      log(`Вход выполнен как: ${displayName}`);
    } else {
      // Token is stale or platform unreachable — show the form so user can fix it.
      log("Не удалось проверить токен. Введи заново или проверь Platform URL.");
    }

    await loadLibrary(cfg);
    startLibraryPolling(cfg);
    showAutoQuotaCard();
    autoQuotaCheckbox.checked = !!cfg.autoQuotaEnabled;
    // Get the current quota state from the main process (persists across
    // renderer reloads since the scheduler lives in the main process).
    window.agent.quotaGetState().then((ev) => {
      if (cfg.autoQuotaEnabled) {
        applyQuotaStatus(ev);
      } else {
        applyQuotaStatus({ statusText: "Автоподбор выключен.", hasAttached: false });
      }
    }).catch(() => {
      applyQuotaStatus({ statusText: cfg.autoQuotaEnabled ? "Ищу подходящие квоты…" : "Автоподбор выключен.", hasAttached: false });
    });
  } else {
    log("First launch — paste your host token from the web dashboard.");
  }
});
