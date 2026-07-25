import {
  Tray,
  Menu,
  nativeImage,
  app,
  BrowserWindow,
  Notification,
} from "electron";
import path from "node:path";
import type { AgentStatus } from "../shared/messages";

let tray: Tray | null = null;
let lastStatus: AgentStatus = "idle";
let lastMessage = "Ожидание игрока";

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

export function createTray(openSettings: () => void): Tray {
  const iconPath = path.join(
    app.getAppPath(),
    "assets",
    process.platform === "win32" ? "icon.ico" : "icon.png",
  );
  const image = nativeImage
    .createFromPath(iconPath)
    .resize({ width: 16, height: 16 });
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
  tray.setToolTip("Агент DecentralHub");
  rebuildMenu(openSettings);
  tray.on("click", () => openSettings());
  return tray;
}

export function setStatus(status: AgentStatus, message?: string): void {
  lastStatus = status;
  lastMessage = message ?? statusLabel(status);
  if (!tray) return;
  tray.setToolTip(`Агент DecentralHub — ${lastMessage}`);
  rebuildMenu(() => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) win.show();
  });
  if (status === "error" && Notification.isSupported()) {
    new Notification({
      title: "Ошибка агента",
      body: message ?? "Произошла ошибка.",
    }).show();
  }
}

function rebuildMenu(openSettings: () => void): void {
  if (!tray) return;
  const menu = Menu.buildFromTemplate([
    { label: `Статус: ${statusLabel(lastStatus)}`, enabled: false },
    { label: lastMessage, enabled: false },
    { type: "separator" },
    { label: "Открыть настройки", click: openSettings },
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
