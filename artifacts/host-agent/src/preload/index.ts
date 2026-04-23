import { contextBridge, ipcRenderer } from "electron";
import type { AgentStatus, HostConfig, InputEvent } from "../shared/messages";

const api = {
  getConfig: (): Promise<HostConfig> => ipcRenderer.invoke("config:get"),
  setConfig: (next: HostConfig): Promise<HostConfig> =>
    ipcRenderer.invoke("config:set", next),
  setStatus: (status: AgentStatus, message?: string): void => {
    ipcRenderer.send("status:set", status, message);
  },
  injectInput: (event: InputEvent): void => {
    ipcRenderer.send("input:inject", event);
  },
  launchApp: (): Promise<{ ok: boolean; pid?: number; error?: string }> =>
    ipcRenderer.invoke("app:launch"),
  killApp: (): void => {
    ipcRenderer.send("app:kill");
  },
  log: (level: "info" | "warn" | "error", message: string): void => {
    ipcRenderer.send("log", level, message);
  },
};

contextBridge.exposeInMainWorld("agent", api);

declare global {
  // Mirror the API on window for renderer TypeScript.
  interface Window {
    agent: typeof api;
  }
}
