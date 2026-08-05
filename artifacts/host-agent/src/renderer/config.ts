import type { HostConfig } from "../shared/messages";
import { $ } from "./dom.js";
import { log } from "./ui.js";
let resolvedAppPath = "";

export function pathBasename(p: string): string {
  return p.split(/[\\/]/).pop() ?? p;
}

export function setAppPath(fullPath: string): void {
  resolvedAppPath = fullPath;
  ($("appPath") as HTMLInputElement).value = fullPath ? pathBasename(fullPath) : "";
}

export function deriveSignalingUrl(cfg: HostConfig): string {
  if (cfg.signalingUrl) return cfg.signalingUrl;
  const base = new URL(cfg.apiBaseUrl);
  const wsProto = base.protocol === "https:" ? "wss:" : "ws:";
  return `${wsProto}//${base.host}${base.pathname.replace(/\/$/, "")}/api/signal`;
}

export async function refreshCaptureSources(selected: string): Promise<void> {
  const sel = $("captureSourceName") as HTMLSelectElement;
  let sources: { id: string; name: string }[] = [];
  try {
    sources = await window.agent.getCaptureSources();
  } catch (err) {
    log(`Не удалось получить список источников захвата: ${String(err)}`);
  }
  sel.innerHTML = "";
  const auto = document.createElement("option");
  auto.value = "";
  auto.textContent = "(авто — окно запущенной игры, иначе основной экран)";
  sel.appendChild(auto);
  for (const s of sources) {
    const opt = document.createElement("option");
    opt.value = s.name;
    opt.textContent = s.name;
    sel.appendChild(opt);
  }
  sel.value = selected;
}

export async function loadFormFromConfig(): Promise<HostConfig> {
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

export function readForm(): HostConfig {
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

const browseExeBtn = $("browse-exe") as HTMLButtonElement;
browseExeBtn.addEventListener("click", async () => {
  const picked = await window.agent.openFileDialog();
  if (picked) setAppPath(picked);
});
