// Minimal browser env for renderer unit tests (linkedom + WebRTC/WebSocket stubs).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseHTML } from "linkedom";

let installed = false;

export const defaultHostConfig = {
  hostToken: "test-host-token",
  apiBaseUrl: "https://api.example.com",
  signalingUrl: "",
  appPath: "C:\\Games\\game.exe",
  boundUrl: "",
  appArgs: "",
  appName: "Test Game",
  captureSourceName: "",
  ratePerMinute: 10,
  commissionSplit: 0.7,
  resolution: { width: 1920, height: 1080 },
  bitrateKbps: 6000,
  audioMode: "off",
  killAppOnDisconnect: false,
  autoLaunchAtStartup: false,
  allowPreview: true,
};

export const agentStub = {
  platform: "win32",
  getConfig: async () => ({ ...defaultHostConfig }),
  setConfig: async (cfg) => cfg,
  setStatus: () => {},
  log: () => {},
  injectInput: () => {},
  injectGamepad: () => {},
  getCaptureSources: async () => [
    { id: "screen:0", name: "Entire Screen" },
    { id: "window:1", name: "Google Chrome - example.com" },
    { id: "window:2", name: "game.exe" },
  ],
  setCaptureSource: () => {},
  openFileDialog: async () => null,
  openExplorer: () => {},
  onQuotaStatus: () => {},
  quotaRunCycle: () => {},
  quotaDetach: async () => ({ ok: true }),
  getAgentPubkey: async () => "pubkey1234567890abcdef",
  getPcSpecs: async () => ({ cpu: "Test CPU", gpu: "Test GPU", ramGb: 16 }),
  consumePendingBindCode: async () => null,
  bindAgentKey: async () => ({ ok: true }),
  agentLogin: async () => ({ ok: true }),
  updatePcSpecs: async () => ({
    ok: true,
    pcSpecs: { cpu: "Test CPU", gpu: "Test GPU", ramGb: 16 },
  }),
  scanSteam: async () => ({ games: [], error: null }),
  markSteamGamesAdded: async () => {},
  connectGamepad: () => {},
  disconnectGamepad: () => {},
  getGamepadInjectorStatus: async () => ({ ok: true }),
  getInputGuardStatus: async () => ({
    foregroundAllowed: true,
    inputBlocked: false,
    guardDisabled: false,
    active: false,
  }),
  clearInputGuard: async () => {},
  clearInputBlock: () => {},
  killApp: () => {},
  onGameExited: () => {},
  launchApp: async () => ({ ok: true, pid: 1 }),
  launchEntry: async () => ({ ok: true, pid: 1 }),
  saveSyncPull: async () => ({ ok: true, skipped: true, reason: "no_cloud_save" }),
  saveSyncPush: async () => ({ ok: true, skipped: true }),
};

export function installRendererEnv() {
  if (installed) return;
  installed = true;

  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const html = readFileSync(join(root, "src/renderer/index.html"), "utf8");
  const { document, window } = parseHTML(html);

  class MockWebSocket {
    static OPEN = 1;
    readyState = MockWebSocket.OPEN;
    url = "ws://localhost/api/signal";
    send() {}
    close() {}
    onopen = null;
    onmessage = null;
    onerror = null;
    onclose = null;
  }

  class MockRTCPeerConnection {
    connectionState = "new";
    onicecandidate = null;
    onconnectionstatechange = null;
    ondatachannel = null;
    close() {}
    getSenders() {
      return [];
    }
    getTransceivers() {
      return [];
    }
    addTrack() {}
    async setRemoteDescription() {}
    async createAnswer() {
      return { type: "answer", sdp: "v=0" };
    }
    async setLocalDescription() {}
    async createOffer() {
      return { type: "offer", sdp: "v=0" };
    }
    async getStats() {
      return new Map();
    }
  }

  class MockMediaStream {
    getTracks() {
      return [];
    }
    getVideoTracks() {
      return [];
    }
    getAudioTracks() {
      return [];
    }
  }

  window.WebSocket = MockWebSocket;
  window.RTCPeerConnection = MockRTCPeerConnection;
  window.RTCRtpSender = { getCapabilities: () => null };
  window.MediaStream = MockMediaStream;

  Object.defineProperty(window.navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: async () => new MockMediaStream(),
    },
  });

  window.agent = agentStub;
  document.execCommand = () => true;

  Object.defineProperty(window, "location", {
    configurable: true,
    value: { hash: "", href: "http://localhost/" },
  });

  globalThis.document = document;
  globalThis.window = window;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.Node = window.Node;
  globalThis.Event = window.Event;
  globalThis.MediaStream = MockMediaStream;
}

export const RENDERER_DIST = new URL("../../dist/renderer/renderer/", import.meta.url).href;
