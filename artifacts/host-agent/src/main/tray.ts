import {
  Tray,
  Menu,
  nativeImage,
  app,
  Notification,
  shell,
  type NativeImage,
} from "electron";
import fs from "node:fs";
import path from "node:path";
import type { AgentStatus } from "../shared/messages";
import { log, getLogPath } from "./logger";

let tray: Tray | null = null;
let openSettingsCb: (() => void) | null = null;
let lastStatus: AgentStatus = "idle";
let lastMessage = "Ожидание игрока";

/** Minimal 16×16 blue circle PNG — last-resort visible tray icon. */
const FALLBACK_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAPElEQVQ4T2NkYGD4z0BTYMQgQDVXwMjIyMiwZs0aRlI0MYyCpassMIoBDDQ3gJGRgWHNmjWMpGhiGAWjLjcAAK0oAxG8cQZ2AAAAAElFUkSuQmCC";

function statusLabel(s: AgentStatus): string {
  switch (s) {
    case "idle":
      return "Ожидание игрока";
    case "connecting":
      return "Подключение…";
    case "streaming":
      return "Стрим идёт";
    case "error":
      return "Ошибка";
  }
}

function candidateIconPaths(): string[] {
  const names =
    process.platform === "win32"
      ? ["icon.ico", "icon.png"]
      : ["icon.png", "icon.ico"];
  const bases = [
    // Unpacked asar resources (preferred for createFromPath)
    path.join(process.resourcesPath, "app.asar.unpacked", "assets"),
    path.join(process.resourcesPath, "assets"),
    // Dev / non-asar: relative to compiled main (__dirname = dist/main/main)
    path.join(__dirname, "..", "..", "..", "assets"),
    path.join(app.getAppPath(), "assets"),
  ];
  const out: string[] = [];
  for (const base of bases) {
    for (const name of names) {
      out.push(path.join(base, name));
    }
  }
  return out;
}

function loadTrayImage(): { image: NativeImage; source: string } {
  for (const iconPath of candidateIconPaths()) {
    try {
      if (!fs.existsSync(iconPath)) continue;
      const image = nativeImage.createFromPath(iconPath);
      if (!image.isEmpty()) {
        const sized =
          process.platform === "win32"
            ? image.resize({ width: 16, height: 16 })
            : image;
        if (!sized.isEmpty()) {
          return { image: sized, source: iconPath };
        }
      }
    } catch (err) {
      log("warn", `[tray] Failed to load ${iconPath}: ${String(err)}`);
    }
  }
  const fallback = nativeImage.createFromBuffer(
    Buffer.from(FALLBACK_PNG_BASE64, "base64"),
  );
  log(
    "warn",
    "[tray] No icon file found — using embedded fallback PNG so the tray stays visible",
  );
  return { image: fallback, source: "embedded-fallback" };
}

function invokeOpenSettings(): void {
  if (openSettingsCb) {
    openSettingsCb();
    return;
  }
  log("warn", "[tray] openSettings callback missing");
}

function rebuildMenu(): void {
  if (!tray) return;
  const menu = Menu.buildFromTemplate([
    { label: `Статус: ${statusLabel(lastStatus)}`, enabled: false },
    { label: lastMessage, enabled: false },
    { type: "separator" },
    { label: "Открыть настройки", click: () => invokeOpenSettings() },
    {
      label: "Открыть лог",
      click: () => {
        try {
          void shell.openPath(getLogPath());
        } catch (err) {
          log("warn", `[tray] open log failed: ${String(err)}`);
        }
      },
    },
    { type: "separator" },
    {
      label: "Выход",
      click: () => {
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
}

export function createTray(openSettings: () => void): Tray {
  openSettingsCb = openSettings;
  const { image, source } = loadTrayImage();
  log(
    "info",
    `[tray] icon source=${source} empty=${image.isEmpty()} packaged=${app.isPackaged}`,
  );
  tray = new Tray(image);
  tray.setToolTip("Агент DecentralHub");
  rebuildMenu();
  tray.on("click", () => invokeOpenSettings());
  tray.on("double-click", () => invokeOpenSettings());
  return tray;
}

export function setStatus(status: AgentStatus, message?: string): void {
  lastStatus = status;
  lastMessage = message ?? statusLabel(status);
  if (!tray) return;
  tray.setToolTip(`Агент DecentralHub — ${lastMessage}`);
  // Always rebuild with the stored openSettings callback — never replace it
  // with getAllWindows()[0]?.show(), which no-ops when started hidden in tray.
  rebuildMenu();
  if (status === "error" && Notification.isSupported()) {
    new Notification({
      title: "Ошибка агента",
      body: message ?? "Произошла ошибка.",
    }).show();
  }
}

export function destroyTray(): void {
  if (!tray) return;
  try {
    tray.destroy();
  } catch {
    /* ignore */
  }
  tray = null;
  openSettingsCb = null;
}
