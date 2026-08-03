/** Minimal DOM/window mocks so renderer modules can load under node --test. */

const ELEMENT_IDS = [
  "pipeline-card",
  "step-saves",
  "step-launch",
  "step-window",
  "step-stream",
  "step-player",
  "status-text",
  "log",
  "settings-form",
  "connect",
  "disconnect",
  "share-card",
  "player-link",
  "copy-link",
  "library-card",
  "library-status",
  "library-list",
  "refresh-library",
  "game-picker-card",
  "selected-game-id",
  "confirm-game",
  "cancel-game-picker",
  "game-picker-hint",
  "game-picker-steam",
  "game-picker-steam-title",
  "game-picker-steam-list",
  "preview-indicator",
  "input-guard-badge",
  "hostToken",
  "apiBaseUrl",
  "signalingUrl",
  "appPath",
  "boundUrl",
  "appArgs",
  "appName",
  "captureSourceName",
  "ratePerMinute",
  "commissionSplit",
  "width",
  "height",
  "bitrateKbps",
  "audioMode",
  "killAppOnDisconnect",
  "autoLaunchAtStartup",
  "allowPreview",
  "browse-exe",
  "scan-steam",
  "steam-modal",
  "steam-modal-close",
  "steam-scan-progress",
  "steam-scan-error",
  "steam-scan-error-text",
  "steam-scan-results",
  "steam-scan-summary",
  "steam-game-list",
  "steam-add-library",
  "steam-submit-review",
  "steam-select-all",
  "steam-delta-mode",
  "badge-catalog",
  "badge-new",
  "badge-added",
  "steam-recommend-card",
  "steam-recommend-status",
  "steam-recommend-list",
  "steam-recommend-add",
  "steam-recommend-open",
  "auto-steam-card",
  "auto-steam-status",
  "auto-steam-publish",
  "auto-quota-card",
  "autoQuotaEnabled",
  "auto-quota-status",
  "auto-quota-actions",
  "detach-quota-btn",
  "pairing-code",
  "pairing-submit",
  "pairing-status",
  "pairing-card",
  "signin-banner",
  "signin-display-name",
  "signin-api-url",
  "switch-account-btn",
  "agent-key-status",
  "bind-agent-key",
  "agent-login",
  "update-pc-specs",
  "pc-specs-info",
  "agentBindCode",
  "window-picker-modal",
  "window-picker-list",
  "window-picker-refresh",
  "window-picker-screen",
  "window-picker-cancel",
  "save",
  "pull-from-server",
  "refresh-sources",
];

function makeEl(tag = "div", id = "") {
  const children = [];
  const el = {
    tagName: tag.toUpperCase(),
    id,
    hidden: false,
    textContent: "",
    value: "",
    checked: false,
    disabled: false,
    innerHTML: "",
    style: {},
    dataset: {},
    className: "",
    children,
    addEventListener() {},
    removeEventListener() {},
    appendChild(child) {
      children.push(child);
      return child;
    },
    querySelector(sel) {
      if (sel === ".step-icon") return makeEl("span");
      if (sel === ".step-note") return makeEl("span");
      if (sel === ".library-entry-actions") return makeEl("div");
      return null;
    },
    querySelectorAll() {
      return [];
    },
    closest() {
      return elements.get("settings-form");
    },
    focus() {},
    setAttribute() {},
    click() {},
    onclick: null,
    onchange: null,
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null,
    onconnectionstatechange: null,
    onicecandidate: null,
    readyState: 1,
    send() {},
    close() {},
  };
  if (id) elements.set(id, el);
  return el;
}

const elements = new Map();

export function installRendererDom() {
  elements.clear();
  for (const id of ELEMENT_IDS) {
    const tag =
      id.includes("list") || id === "library-list" || id === "game-picker-steam-list"
        ? "ul"
        : id.includes("select") || id === "selected-game-id" || id === "captureSourceName" || id === "audioMode"
          ? "select"
          : id.includes("checkbox") || id.endsWith("Enabled") || id.startsWith("kill") || id.startsWith("autoLaunch") || id.startsWith("allow")
            ? "input"
            : "div";
    makeEl(tag, id);
  }

  const dot = makeEl("span");
  dot.className = "dot";
  const steamTabs = [makeEl("button"), makeEl("button")];
  steamTabs.forEach((t) => {
    t.className = "steam-tab";
  });

  const body = makeEl("body");
  globalThis.document = {
    getElementById(id) {
      return elements.get(id) ?? makeEl("div", id);
    },
    querySelector(sel) {
      if (sel === ".dot") return dot;
      return null;
    },
    querySelectorAll(sel) {
      if (sel === ".steam-tab") return steamTabs;
      return [];
    },
    createElement(tag) {
      return makeEl(tag);
    },
    body,
    execCommand() {
      return true;
    },
  };

  class MockWebSocket {
    static OPEN = 1;
    readyState = MockWebSocket.OPEN;
    send = () => {};
    close = () => {};
  }

  class MockRTCPeerConnection {
    connectionState = "new";
    onicecandidate = null;
    onconnectionstatechange = null;
    close = () => {};
    addTrack = () => {};
    createOffer = async () => ({ type: "offer", sdp: "v=0" });
    setLocalDescription = async () => {};
    setRemoteDescription = async () => {};
    addIceCandidate = async () => {};
  }

  const mockNavigator = {
    mediaDevices: {
      getUserMedia: async () => new MediaStream(),
    },
  };

  const mockWindow = {
    agent: {
      setStatus() {},
      log() {},
      injectInput() {},
      getInputGuardStatus: async () => ({
        foregroundAllowed: true,
        inputBlocked: false,
        guardDisabled: false,
        active: false,
      }),
      getConfig: async () => ({
        hostToken: "tok",
        apiBaseUrl: "https://api.example.com",
        signalingUrl: "",
        appPath: "",
        boundUrl: "",
        appArgs: "",
        appName: "",
        captureSourceName: "",
        ratePerMinute: 0,
        commissionSplit: 0.7,
        resolution: { width: 1920, height: 1080 },
        bitrateKbps: 6000,
        audioMode: "off",
        killAppOnDisconnect: false,
        autoLaunchAtStartup: false,
        allowPreview: true,
      }),
      setConfig: async (c) => c,
      getCaptureSources: async () => [
        { id: "screen:0", name: "Entire Screen" },
        { id: "window:1", name: "Game Window" },
      ],
      openFileDialog: async () => null,
      setCaptureSource() {},
      platform: "win32",
      onQuotaStatus() {},
      quotaRunCycle() {},
      quotaDetach: async () => ({ ok: true }),
      getAgentPubkey: async () => "pubkey1234567890abcdef",
      openExplorer() {},
      killApp() {},
    },
    addEventListener() {},
    document: globalThis.document,
    navigator: mockNavigator,
  };

  globalThis.WebSocket = MockWebSocket;
  globalThis.RTCPeerConnection = MockRTCPeerConnection;
  globalThis.MediaStream = class {
    getVideoTracks() {
      return [];
    }
    getAudioTracks() {
      return [];
    }
    getTracks() {
      return [];
    }
  };

  Object.defineProperty(globalThis, "window", {
    value: mockWindow,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, "navigator", {
    value: mockNavigator,
    configurable: true,
    writable: true,
  });

  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({}),
  });

  globalThis.setInterval = () => 0;
  globalThis.clearInterval = () => {};
  globalThis.setTimeout = (fn) => {
    fn();
    return 0;
  };
  globalThis.clearTimeout = () => {};
}
