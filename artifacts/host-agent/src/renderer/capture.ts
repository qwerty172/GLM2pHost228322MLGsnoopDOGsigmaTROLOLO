import type { HostConfig } from "../shared/messages";
import {
  exeBasename,
  findBrowserCaptureSource,
  findCaptureSourceByTitle,
  findNativeCaptureSource,
} from "../shared/window-match.js";
import { session } from "./state.js";
import { log, setPipelineStep } from "./ui.js";

export { exeBasename } from "../shared/window-match.js";

function targetExeName(cfg: HostConfig): string | undefined {
  // Currently-selected library game's exe name takes priority.
  if (session.currentGameId) {
    const entry = session.libraryEntries.find((e) => e.gameId === session.currentGameId);
    const name = exeBasename(entry?.appPath);
    if (name) return name;
  }
  // Fall back to HostConfig appPath basename.
  return exeBasename(cfg.appPath);
}

function currentBoundUrl(cfg: HostConfig): string {
  if (session.currentGameId) {
    const entry = session.libraryEntries.find((e) => e.gameId === session.currentGameId);
    if (entry?.boundUrl?.trim()) return entry.boundUrl.trim();
  }
  return (cfg.boundUrl ?? "").trim();
}

function isBrowserGameSession(cfg: HostConfig): boolean {
  return currentBoundUrl(cfg).length > 0;
}

// Manual window picker — shown when auto-matching the game window fails.
// Resolves with the chosen source, or rejects if the host clicks «Отмена».
function pickWindowManually(): Promise<{ id: string; name: string }> {
  const modal = document.getElementById("window-picker-modal") as HTMLElement;
  const list = document.getElementById("window-picker-list") as HTMLUListElement;
  const refreshBtn = document.getElementById("window-picker-refresh") as HTMLButtonElement;
  const screenBtn = document.getElementById("window-picker-screen") as HTMLButtonElement;
  const cancelBtn = document.getElementById("window-picker-cancel") as HTMLButtonElement | null;

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      modal.hidden = true;
      refreshBtn.onclick = null;
      screenBtn.onclick = null;
      if (cancelBtn) cancelBtn.onclick = null;
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
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        cleanup();
        reject(new Error("Выбор окна отменён"));
      };
    }

    modal.hidden = false;
    void render();
  });
}

export async function captureScreen(cfg: HostConfig): Promise<MediaStream> {
  let sources = await window.agent.getCaptureSources();
  if (sources.length === 0) {
    throw new Error("Нет доступных источников захвата экрана/окна");
  }
  let chosen: { id: string; name: string } | undefined;
  if (cfg.captureSourceName) {
    chosen = findCaptureSourceByTitle(sources, cfg.captureSourceName);
  }

  const boundUrl = currentBoundUrl(cfg);
  const browserGame = isBrowserGameSession(cfg);

  if (!chosen && browserGame) {
    // Browser games: capture the browser window, not the whole desktop.
    const RETRY_MS = 2_000;
    const MAX_ATTEMPTS = 5;
    for (let attempt = 0; attempt < MAX_ATTEMPTS && !chosen; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, RETRY_MS));
        sources = await window.agent.getCaptureSources();
      }
      chosen = findBrowserCaptureSource(sources, boundUrl);
      if (!chosen && attempt < MAX_ATTEMPTS - 1) {
        setPipelineStep(
          "window",
          "active",
          `ищем окно браузера… (${attempt + 1}/${MAX_ATTEMPTS})`,
        );
      }
    }
    if (!chosen) {
      log("Окно браузера не найдено автоматически — открываю ручной выбор.");
      setPipelineStep("window", "active", "выбери окно браузера вручную");
      chosen = await pickWindowManually();
    }
  }

  const targetName = browserGame ? undefined : targetExeName(cfg);
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
      chosen = findNativeCaptureSource(sources, targetName);
      if (!chosen && attempt < MAX_ATTEMPTS - 1) {
        setPipelineStep("window", "active", `ищем окно «${targetName}»… (${attempt + 1}/${MAX_ATTEMPTS})`);
      }
    }
  }

  if (!chosen && targetName) {
    // Auto-match failed: for a single known game, fall back to primary screen
    // instead of blocking on the window picker (host can fix capture later).
    const enabledCount = session.libraryEntries.filter(
      (e) => e.enabled && (e.boundUrl || e.localAvailable),
    ).length;
    if (enabledCount <= 1) {
      chosen = sources.find((s) => s.id.startsWith("screen:"));
      if (chosen) {
        log(
          `Окно «${targetName}» не найдено — стримим весь экран (одна игра в библиотеке).`,
        );
      }
    }
    if (!chosen) {
      log(`Окно «${targetName}» не найдено автоматически — открываю ручной выбор.`);
      setPipelineStep("window", "active", "выбери окно вручную");
      chosen = await pickWindowManually();
    }
  }

  if (!chosen && !browserGame) {
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
  session.currentCaptureSourceName = chosen.name;
  window.agent.setCaptureSource(chosen.name);
  setPipelineStep("window", "done", chosen.name);

  const audioMode = cfg.audioMode ?? "off";
  // Electron desktop capture: prefer non-deprecated constraint shape.
  // getDisplayMedia() cannot target a specific chromeMediaSourceId, so we
  // still use getUserMedia with chromeMediaSource + source id.
  const constraints = {
    audio:
      audioMode !== "off"
        ? ({
            chromeMediaSource: "desktop",
            chromeMediaSourceId: sourceId,
          } as unknown as MediaTrackConstraints)
        : false,
    video: {
      mandatory: {
        chromeMediaSource: "desktop",
        chromeMediaSourceId: sourceId,
        maxWidth: session.captureWidth || cfg.resolution.width,
        maxHeight: session.captureHeight || cfg.resolution.height,
        maxFrameRate: 60,
      },
    },
  } as unknown as MediaStreamConstraints;

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    // Fallback for older Electron builds that still require `mandatory`.
    log(`[capture] modern constraints failed (${String(err)}) — retrying with mandatory`);
    const legacy = {
      audio:
        audioMode !== "off"
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
    stream = await navigator.mediaDevices.getUserMedia(legacy);
  }
  if (audioMode !== "off") {
    const audioTracks = stream.getAudioTracks();
    log(`[audio] ${audioTracks.length} audio track(s) captured (mode=${audioMode})`);
  }
  return stream;
}
