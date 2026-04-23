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
let lastMessage = "Idle";

function statusLabel(s: AgentStatus): string {
  switch (s) {
    case "idle":
      return "Idle — waiting for player";
    case "connecting":
      return "Connecting…";
    case "streaming":
      return "Streaming";
    case "error":
      return "Error";
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
  tray.setToolTip("Cloud Gaming Host Agent");
  rebuildMenu(openSettings);
  tray.on("click", () => openSettings());
  return tray;
}

export function setStatus(status: AgentStatus, message?: string): void {
  lastStatus = status;
  lastMessage = message ?? statusLabel(status);
  if (!tray) return;
  tray.setToolTip(`Cloud Gaming Host Agent — ${lastMessage}`);
  rebuildMenu(() => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) win.show();
  });
  if (status === "error" && Notification.isSupported()) {
    new Notification({
      title: "Host Agent error",
      body: message ?? "An error occurred.",
    }).show();
  }
}

function rebuildMenu(openSettings: () => void): void {
  if (!tray) return;
  const menu = Menu.buildFromTemplate([
    { label: `Status: ${statusLabel(lastStatus)}`, enabled: false },
    { label: lastMessage, enabled: false },
    { type: "separator" },
    { label: "Open settings", click: openSettings },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
}
