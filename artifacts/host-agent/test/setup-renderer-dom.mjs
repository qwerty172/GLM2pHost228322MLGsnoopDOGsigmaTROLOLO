/** Minimal DOM/window mocks so renderer modules can be imported in node:test. */
const elements = new Map();

function makeClassList() {
  const classes = new Set();
  return {
    add: (...c) => c.forEach((x) => classes.add(x)),
    remove: (...c) => c.forEach((x) => classes.delete(x)),
    toggle: (c, force) => {
      if (force === true) classes.add(c);
      else if (force === false) classes.delete(c);
      else if (classes.has(c)) classes.delete(c);
      else classes.add(c);
    },
    contains: (c) => classes.has(c),
  };
}

function createElement(tag, id = "") {
  const children = [];
  const el = {
    tagName: tag.toUpperCase(),
    id,
    type: tag === "button" ? "button" : tag === "input" ? "text" : "",
    hidden: false,
    disabled: false,
    checked: false,
    value: "",
    textContent: "",
    innerHTML: "",
    style: { display: "" },
    dataset: {},
    classList: makeClassList(),
    children,
    childNodes: children,
    appendChild(child) {
      children.push(child);
      return child;
    },
    removeChild(child) {
      const i = children.indexOf(child);
      if (i >= 0) children.splice(i, 1);
      return child;
    },
    addEventListener() {},
    removeEventListener() {},
    querySelector(sel) {
      if (sel === ".step-icon") return { textContent: "" };
      if (sel === ".step-note") return { textContent: "" };
      if (sel === ".library-entry-actions") return createElement("div");
      if (sel === ".library-entry-header") return createElement("div");
      return null;
    },
    querySelectorAll() {
      return [];
    },
    closest(sel) {
      if (sel === "section") return createElement("section", "settings-section");
      return null;
    },
    select() {},
    focus() {},
    get onclick() {
      return this._onclick;
    },
    set onclick(fn) {
      this._onclick = fn;
    },
    setAttribute() {},
    getAttribute: () => null,
  };
  if (id) elements.set(id, el);
  return el;
}

const REQUIRED_IDS = [
  "status-text", "log", "settings-form", "connect", "disconnect", "share-card",
  "player-link", "copy-link", "library-card", "library-status", "library-list",
  "refresh-library", "game-picker-card", "selected-game-id", "confirm-game",
  "cancel-game-picker", "game-picker-hint", "game-picker-steam", "game-picker-steam-title",
  "game-picker-steam-list", "preview-indicator", "input-guard-badge", "pipeline-card",
  "step-saves", "step-launch", "step-window", "step-stream", "step-player",
  "window-picker-modal", "window-picker-list", "window-picker-refresh",
  "window-picker-cancel", "window-picker-screen", "auto-quota-card", "autoQuotaEnabled",
  "auto-quota-status", "auto-quota-actions", "detach-quota-btn", "signin-banner",
  "signin-display-name", "signin-api-url", "switch-account-btn", "agent-key-status",
  "agentBindCode", "bind-agent-key", "agent-login", "update-pc-specs", "pc-specs-info",
  "steam-recommend-card", "steam-recommend-status", "steam-recommend-list",
  "steam-recommend-add", "steam-recommend-open", "scan-steam", "steam-modal",
  "steam-modal-close", "steam-scan-progress", "steam-scan-error", "steam-scan-error-text",
  "steam-scan-results", "steam-scan-summary", "steam-game-list", "steam-add-library",
  "steam-submit-review", "steam-select-all", "steam-delta-mode", "badge-catalog",
  "badge-new", "badge-added", "pairing-code", "pairing-submit", "pairing-status",
  "pairing-card", "auto-steam-card", "auto-steam-status", "auto-steam-publish",
  "hostToken", "apiBaseUrl", "signalingUrl", "appPath", "browse-exe", "boundUrl",
  "appArgs", "appName", "captureSourceName", "refresh-sources", "ratePerMinute",
  "commissionSplit", "bitrateKbps", "audioMode", "width", "height",
  "killAppOnDisconnect", "autoLaunchAtStartup", "allowPreview", "save",
  "pull-from-server",
];

for (const id of REQUIRED_IDS) createElement("div", id);

const statusDot = createElement("span", "status-dot");
statusDot.classList.add("dot");

const document = {
  getElementById: (id) => elements.get(id) ?? createElement("div", id),
  querySelector: (sel) => {
    if (sel === ".dot") return statusDot;
    if (sel.startsWith(".steam-tab")) return createElement("button");
    return null;
  },
  querySelectorAll: (sel) => {
    if (sel === ".steam-tab") return [];
    return [];
  },
  createElement: (tag) => createElement(tag),
  execCommand: () => true,
};

const agentStub = {
  platform: "win32",
  setStatus: () => {},
  log: () => {},
  onQuotaStatus: () => {},
  injectInput: () => {},
  getConfig: async () => ({
    hostToken: "",
    apiBaseUrl: "https://api.example.com",
    signalingUrl: "",
    appPath: "",
    ratePerMinute: 1,
    commissionSplit: 0.7,
    resolution: { width: 1920, height: 1080 },
    bitrateKbps: 6000,
    audioMode: "off",
    killAppOnDisconnect: false,
    autoLaunchAtStartup: false,
    allowPreview: true,
  }),
  setConfig: async (cfg) => cfg,
  getInputGuardStatus: async () => ({
    foregroundAllowed: true,
    inputBlocked: false,
    guardDisabled: false,
    active: false,
  }),
};

globalThis.MediaStream = class {
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
globalThis.WebSocket = class {
  static OPEN = 1;
  readyState = 1;
  send() {}
  close() {}
};
globalThis.RTCPeerConnection = class {
  connectionState = "new";
  onicecandidate = null;
  onconnectionstatechange = null;
  addTrack() {}
  async createOffer() {
    return { type: "offer", sdp: "v=0" };
  }
  async setLocalDescription() {}
  async setRemoteDescription() {}
  async addIceCandidate() {}
};

globalThis.window = {
  agent: agentStub,
  location: { hash: "" },
  crypto: globalThis.crypto,
  document,
  navigator: {
    mediaDevices: {
      getUserMedia: async () => new MediaStream(),
    },
  },
};
globalThis.document = document;

export { elements, agentStub, createElement };
