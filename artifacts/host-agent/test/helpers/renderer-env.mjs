// Minimal browser-like environment for renderer unit tests (linkedom + agent mock).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseHTML } from "linkedom";

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(__dirname, "../../src/renderer/index.html");

/** @type {import("../shared/messages.js").HostConfig} */
export const defaultHostConfig = {
  hostToken: "test-host-token",
  apiBaseUrl: "https://platform.example.com",
  signalingUrl: "",
  appPath: "C:\\Games\\Test\\game.exe",
  appArgs: "",
  appName: "Test Game",
  boundUrl: "",
  captureSourceName: "",
  ratePerMinute: 0.05,
  commissionSplit: 0.7,
  resolution: { width: 1920, height: 1080 },
  bitrateKbps: 6000,
  killAppOnDisconnect: false,
  autoLaunchAtStartup: false,
  allowPreview: true,
  audioMode: "off",
};

let envReady = false;

/** Install DOM + window.agent stubs. Safe to call multiple times. */
export function setupRendererEnv() {
  if (envReady) return;

  const html = readFileSync(htmlPath, "utf8");
  const { document, window: domWindow } = parseHTML(html);

  const g = globalThis;
  g.document = document;
  g.window = domWindow;
  g.HTMLElement = domWindow.HTMLElement;
  g.HTMLInputElement = domWindow.HTMLInputElement;
  g.HTMLButtonElement = domWindow.HTMLButtonElement;
  g.HTMLSelectElement = domWindow.HTMLSelectElement;
  g.HTMLFormElement = domWindow.HTMLFormElement;
  g.Node = domWindow.Node;
  g.Event = domWindow.Event;
  g.CustomEvent = domWindow.CustomEvent;

  const agent = {
    platform: "win32",
    getConfig: async () => ({ ...defaultHostConfig }),
    setConfig: async (cfg) => {
      Object.assign(defaultHostConfig, cfg);
      return { ...defaultHostConfig };
    },
    setStatus: () => {},
    log: () => {},
    getCaptureSources: async () => [
      { id: "screen:0", name: "Primary Screen" },
      { id: "window:1", name: "Google Chrome — example.com" },
      { id: "window:2", name: "game" },
    ],
    setCaptureSource: () => {},
    openFileDialog: async () => null,
    openExplorer: () => {},
    injectInput: () => {},
    fetchLibrary: async () => [],
    patchLibraryAvailability: async () => {},
    getInputGuardStatus: async () => ({
      foregroundAllowed: true,
      inputBlocked: false,
      guardDisabled: false,
      active: false,
    }),
    onQuotaStatus: () => {},
    quotaRunCycle: () => {},
    quotaDetach: async () => ({ ok: true }),
    getAgentPubkey: async () => "a".repeat(64),
    getPcSpecs: async () => ({ cpu: "Test CPU", gpu: "Test GPU", ramGb: 16 }),
    consumePendingBindCode: async () => null,
    bindAgentKey: async () => ({ ok: true }),
    markSteamGamesAdded: async () => {},
    scanSteamLibrary: async () => ({ games: [] }),
    matchSteamCatalog: async () => ({ games: [] }),
  };

  domWindow.agent = agent;
  g.window.agent = agent;

  domWindow.location = {
    hash: "",
    hostname: "localhost",
    href: "http://localhost/",
  };

  // Stub Web APIs used by session/preview modules when imported.
  domWindow.RTCPeerConnection = class {
    constructor() {
      this.connectionState = "new";
      this.onicecandidate = null;
      this.onconnectionstatechange = null;
    }
    close() {}
    getTransceivers() {
      return [];
    }
    async createOffer() {
      return { type: "offer", sdp: "v=0\r\n" };
    }
    async setLocalDescription() {}
    addTrack() {}
    async getStats() {
      return new Map();
    }
  };
  domWindow.RTCRtpSender = { getCapabilities: () => ({ codecs: [] }) };
  domWindow.WebSocket = class {
    static OPEN = 1;
    readyState = 1;
    send() {}
    close() {}
  };
  domWindow.MediaStream = class {
    getTracks() {
      return [];
    }
    getVideoTracks() {
      return [];
    }
    getAudioTracks() {
      return [];
    }
  };
  Object.defineProperty(domWindow.navigator, "mediaDevices", {
    value: {
      getUserMedia: async () => new domWindow.MediaStream(),
    },
    configurable: true,
  });

  envReady = true;
}

/** Reset mutable session-related agent state between tests. */
export function resetAgentConfig() {
  Object.assign(defaultHostConfig, {
    hostToken: "test-host-token",
    apiBaseUrl: "https://platform.example.com",
    signalingUrl: "",
    appPath: "C:\\Games\\Test\\game.exe",
    ratePerMinute: 0.05,
    commissionSplit: 0.7,
  });
}
