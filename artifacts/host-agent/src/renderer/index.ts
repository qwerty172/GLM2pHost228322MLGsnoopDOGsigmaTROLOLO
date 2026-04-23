import type { AgentStatus, HostConfig, InputEvent } from "../shared/messages";

// The preload script (src/preload/index.ts) exposes this API on `window.agent`
// via contextBridge. Re-declare the surface here so the renderer typechecks
// without depending on the preload's CommonJS module graph.
declare global {
  interface Window {
    agent: {
      getConfig: () => Promise<HostConfig>;
      setConfig: (next: HostConfig) => Promise<HostConfig>;
      setStatus: (status: AgentStatus, message?: string) => void;
      injectInput: (event: InputEvent) => void;
      launchApp: () => Promise<{
        ok: boolean;
        pid?: number;
        error?: string;
      }>;
      getCaptureSources: () => Promise<{ id: string; name: string }[]>;
      killApp: () => void;
      log: (level: "info" | "warn" | "error", message: string) => void;
    };
  }
}

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
};

const statusDot = document.querySelector<HTMLSpanElement>(".dot")!;
const statusText = $("status-text") as HTMLSpanElement;
const logEl = $("log") as HTMLPreElement;
const form = $("settings-form") as HTMLFormElement;
const connectBtn = $("connect") as HTMLButtonElement;
const disconnectBtn = $("disconnect") as HTMLButtonElement;
const shareCard = $("share-card") as HTMLElement;
const playerLinkInput = $("player-link") as HTMLInputElement;
const copyLinkBtn = $("copy-link") as HTMLButtonElement;

let pc: RTCPeerConnection | null = null;
let ws: WebSocket | null = null;
let captureStream: MediaStream | null = null;
let dataChannel: RTCDataChannel | null = null;
let currentSessionId: string | null = null;
let currentConfig: HostConfig | null = null;

function setStatus(status: AgentStatus, message?: string): void {
  statusDot.dataset["status"] = status;
  statusText.textContent =
    message ??
    {
      idle: "Idle — waiting for player",
      connecting: "Connecting…",
      streaming: "Streaming",
      error: "Error",
    }[status];
  window.agent.setStatus(status, message);
}

function log(msg: string): void {
  const stamp = new Date().toLocaleTimeString();
  logEl.textContent = `[${stamp}] ${msg}\n` + logEl.textContent;
  if (logEl.textContent.length > 16_000) {
    logEl.textContent = logEl.textContent.slice(0, 16_000);
  }
  window.agent.log("info", msg);
}

async function loadFormFromConfig(): Promise<HostConfig> {
  const cfg = await window.agent.getConfig();
  ($("hostToken") as HTMLInputElement).value = cfg.hostToken;
  ($("apiBaseUrl") as HTMLInputElement).value = cfg.apiBaseUrl;
  ($("signalingUrl") as HTMLInputElement).value = cfg.signalingUrl;
  ($("appPath") as HTMLInputElement).value = cfg.appPath;
  ($("appArgs") as HTMLInputElement).value = cfg.appArgs ?? "";
  ($("appName") as HTMLInputElement).value = cfg.appName ?? "";
  await refreshCaptureSources(cfg.captureSourceName ?? "");
  ($("ratePerMinute") as HTMLInputElement).value = String(cfg.ratePerMinute);
  ($("commissionSplit") as HTMLInputElement).value = String(
    cfg.commissionSplit,
  );
  ($("width") as HTMLInputElement).value = String(cfg.resolution.width);
  ($("height") as HTMLInputElement).value = String(cfg.resolution.height);
  ($("bitrateKbps") as HTMLInputElement).value = String(cfg.bitrateKbps);
  ($("killAppOnDisconnect") as HTMLInputElement).checked =
    cfg.killAppOnDisconnect;
  ($("autoLaunchAtStartup") as HTMLInputElement).checked =
    cfg.autoLaunchAtStartup;
  return cfg;
}

function readForm(): HostConfig {
  return {
    hostToken: ($("hostToken") as HTMLInputElement).value.trim(),
    apiBaseUrl: ($("apiBaseUrl") as HTMLInputElement).value.trim(),
    signalingUrl: ($("signalingUrl") as HTMLInputElement).value.trim(),
    appPath: ($("appPath") as HTMLInputElement).value.trim(),
    appArgs: ($("appArgs") as HTMLInputElement).value.trim(),
    appName: ($("appName") as HTMLInputElement).value.trim(),
    captureSourceName: ($("captureSourceName") as HTMLSelectElement).value,
    ratePerMinute:
      Number(($("ratePerMinute") as HTMLInputElement).value) || 0,
    commissionSplit: Math.max(
      0,
      Math.min(
        1,
        Number(($("commissionSplit") as HTMLInputElement).value) || 0.7,
      ),
    ),
    resolution: {
      width: Number(($("width") as HTMLInputElement).value) || 1920,
      height: Number(($("height") as HTMLInputElement).value) || 1080,
    },
    bitrateKbps:
      Number(($("bitrateKbps") as HTMLInputElement).value) || 6000,
    killAppOnDisconnect: ($("killAppOnDisconnect") as HTMLInputElement)
      .checked,
    autoLaunchAtStartup: ($("autoLaunchAtStartup") as HTMLInputElement)
      .checked,
  };
}

function deriveSignalingUrl(cfg: HostConfig): string {
  if (cfg.signalingUrl) return cfg.signalingUrl;
  const base = new URL(cfg.apiBaseUrl);
  const wsProto = base.protocol === "https:" ? "wss:" : "ws:";
  return `${wsProto}//${base.host}${base.pathname.replace(/\/$/, "")}/api/signal`;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const cfg = readForm();
  await window.agent.setConfig(cfg);
  log("Settings saved.");
});

copyLinkBtn.addEventListener("click", () => {
  playerLinkInput.select();
  document.execCommand("copy");
});

const refreshSourcesBtn = $("refresh-sources") as HTMLButtonElement;
refreshSourcesBtn.addEventListener("click", () => {
  void refreshCaptureSources(
    ($("captureSourceName") as HTMLSelectElement).value,
  );
});

async function refreshCaptureSources(selected: string): Promise<void> {
  const sel = $("captureSourceName") as HTMLSelectElement;
  let sources: { id: string; name: string }[] = [];
  try {
    sources = await window.agent.getCaptureSources();
  } catch (err) {
    log(`Could not enumerate capture sources: ${String(err)}`);
  }
  // Reset options
  sel.innerHTML = "";
  const auto = document.createElement("option");
  auto.value = "";
  auto.textContent =
    "(auto — match launched app, else primary screen)";
  sel.appendChild(auto);
  for (const s of sources) {
    const opt = document.createElement("option");
    opt.value = s.name;
    opt.textContent = s.name;
    sel.appendChild(opt);
  }
  sel.value = selected;
}

connectBtn.addEventListener("click", async () => {
  const cfg = await window.agent.setConfig(readForm());
  if (!cfg.hostToken || !cfg.apiBaseUrl) {
    setStatus("error", "Host token and platform URL are required");
    return;
  }
  await connect(cfg);
});

disconnectBtn.addEventListener("click", () => {
  teardown("Disconnected by host");
});

async function createSession(cfg: HostConfig): Promise<{
  sessionId: string;
  playerToken: string;
}> {
  const url = `${cfg.apiBaseUrl.replace(/\/$/, "")}/api/sessions`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      hostToken: cfg.hostToken,
      appName: cfg.appName || "Streamed App",
      // Effective rate to bill the player. The host's commission split is
      // applied locally to the configured per-minute price (the platform's
      // own commission is taken at deposit-time, not per-minute).
      ratePerMinute: cfg.ratePerMinute,
    }),
  });
  if (!resp.ok) {
    throw new Error(`Session create failed (${resp.status})`);
  }
  const data = (await resp.json()) as {
    id: string;
    playerToken: string;
  };
  return { sessionId: data.id, playerToken: data.playerToken };
}

function showPlayerLink(cfg: HostConfig, playerToken: string): void {
  const link = `${cfg.apiBaseUrl.replace(/\/$/, "")}/play?token=${encodeURIComponent(playerToken)}`;
  playerLinkInput.value = link;
  shareCard.hidden = false;
}

async function connect(cfg: HostConfig): Promise<void> {
  currentConfig = cfg;
  setStatus("connecting", "Creating session…");
  connectBtn.disabled = true;
  let session: { sessionId: string; playerToken: string };
  try {
    session = await createSession(cfg);
    currentSessionId = session.sessionId;
    showPlayerLink(cfg, session.playerToken);
    log(`Session created: ${session.sessionId}`);
  } catch (err) {
    setStatus("error", `Could not create session: ${String(err)}`);
    connectBtn.disabled = false;
    return;
  }

  setStatus("connecting", "Connecting to signaling server…");
  let url: URL;
  try {
    url = new URL(deriveSignalingUrl(cfg));
  } catch (err) {
    setStatus("error", `Bad signaling URL: ${String(err)}`);
    connectBtn.disabled = false;
    return;
  }
  url.searchParams.set("role", "host");
  url.searchParams.set("hostToken", cfg.hostToken);
  url.searchParams.set("sessionId", session.sessionId);

  ws = new WebSocket(url.toString());

  ws.onopen = () => {
    log("Signaling connected. Waiting for the player to join…");
    setStatus("idle", "Online — share the player link");
    disconnectBtn.disabled = false;
  };

  ws.onmessage = async (ev) => {
    let msg: { type: string; [k: string]: unknown };
    try {
      msg = JSON.parse(typeof ev.data === "string" ? ev.data : "");
    } catch {
      return;
    }
    if (msg.type === "welcome") {
      // Acknowledged by signaling.
    } else if (msg.type === "peer-joined" && msg["role"] === "player") {
      await onPlayerJoined(cfg);
    } else if (msg.type === "answer" && pc) {
      await pc
        .setRemoteDescription({
          type: "answer",
          sdp: msg["sdp"] as string,
        })
        .catch((err) => log(`setRemoteDescription failed: ${String(err)}`));
    } else if (msg.type === "ice-candidate" && pc) {
      try {
        await pc.addIceCandidate(
          msg["candidate"] as RTCIceCandidateInit,
        );
      } catch (err) {
        log(`ICE add failed: ${String(err)}`);
      }
    } else if (msg.type === "input") {
      // Fallback path: input arrived via signaling, not data channel.
      try {
        const event = msg["event"] as InputEvent;
        if (event && typeof event === "object") {
          window.agent.injectInput(event);
        }
      } catch {
        /* ignore */
      }
    } else if (msg.type === "peer-left" && msg["role"] === "player") {
      log("Player disconnected.");
      teardownPeer(cfg);
    } else if (msg.type === "error") {
      log(`Signaling error: ${String(msg["error"])}`);
    }
  };

  ws.onerror = () => {
    setStatus("error", "Signaling connection error");
  };

  ws.onclose = () => {
    log("Signaling closed.");
    teardown("Signaling closed");
  };
}

async function onPlayerJoined(cfg: HostConfig): Promise<void> {
  setStatus("connecting", "Player joined — preparing stream…");
  const launchResult = await window.agent.launchApp();
  if (!launchResult.ok) {
    log(`Failed to launch app: ${launchResult.error}`);
  } else {
    log(`App launched (pid=${launchResult.pid}).`);
  }

  captureStream = await captureScreen(cfg);
  pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });

  pc.onicecandidate = (e) => {
    if (e.candidate && ws?.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "ice-candidate",
          candidate: e.candidate.toJSON(),
        }),
      );
    }
  };
  pc.onconnectionstatechange = () => {
    log(`Peer state: ${pc?.connectionState}`);
    if (pc?.connectionState === "connected") {
      setStatus("streaming", "Streaming to player");
    } else if (
      pc?.connectionState === "failed" ||
      pc?.connectionState === "disconnected" ||
      pc?.connectionState === "closed"
    ) {
      teardownPeer(cfg);
    }
  };

  pc.ondatachannel = (ev) => {
    dataChannel = ev.channel;
    dataChannel.onmessage = (m) => {
      try {
        const event = JSON.parse(m.data) as InputEvent;
        window.agent.injectInput(event);
      } catch {
        /* ignore */
      }
    };
  };

  for (const track of captureStream.getTracks()) {
    pc.addTrack(track, captureStream);
  }

  const sender = pc.getSenders().find((s) => s.track?.kind === "video");
  if (sender) {
    const params = sender.getParameters();
    params.encodings = params.encodings ?? [{}];
    params.encodings[0]!.maxBitrate = cfg.bitrateKbps * 1000;
    await sender.setParameters(params).catch(() => undefined);
  }

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  ws?.send(JSON.stringify({ type: "offer", sdp: offer.sdp }));
}

async function captureScreen(cfg: HostConfig): Promise<MediaStream> {
  // Source enumeration happens in the main process via Electron's
  // desktopCapturer (exposed through the preload bridge). We pick the source
  // whose name matches the configured app's basename, falling back to the
  // primary screen.
  const sources = await window.agent.getCaptureSources();
  if (sources.length === 0) {
    throw new Error("No screen/window capture sources available");
  }
  // Selection order:
  //   1. Explicit captureSourceName from config (host picked from dropdown).
  //   2. First source whose window title contains the launched .exe basename
  //      (best-effort heuristic — Electron's desktopCapturer does not expose
  //      PIDs, so true PID-based matching is not available here).
  //   3. First "screen" source (whole monitor) so we never silently capture
  //      an unrelated window.
  let chosen: { id: string; name: string } | undefined;
  if (cfg.captureSourceName) {
    chosen = sources.find((s) => s.name === cfg.captureSourceName);
  }
  if (!chosen) {
    const targetName = cfg.appPath
      .split(/[\\/]/)
      .pop()
      ?.replace(/\.exe$/i, "")
      .toLowerCase();
    if (targetName) {
      chosen = sources.find((s) =>
        s.name.toLowerCase().includes(targetName),
      );
    }
  }
  if (!chosen) {
    chosen =
      sources.find((s) => s.id.startsWith("screen:")) ?? sources[0];
  }
  const sourceId = chosen!.id;
  log(`Capturing source: ${chosen!.name}`);

  const constraints = {
    audio: false,
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

  return navigator.mediaDevices.getUserMedia(constraints);
}

function teardownPeer(cfg: HostConfig): void {
  try {
    dataChannel?.close();
  } catch {
    /* */
  }
  dataChannel = null;
  try {
    pc?.close();
  } catch {
    /* */
  }
  pc = null;
  captureStream?.getTracks().forEach((t) => t.stop());
  captureStream = null;
  if (cfg.killAppOnDisconnect) {
    window.agent.killApp();
  }
  setStatus("idle", "Player disconnected — waiting");
}

function teardown(reason: string): void {
  log(reason);
  try {
    ws?.close();
  } catch {
    /* */
  }
  ws = null;
  try {
    pc?.close();
  } catch {
    /* */
  }
  pc = null;
  captureStream?.getTracks().forEach((t) => t.stop());
  captureStream = null;
  if (currentConfig?.killAppOnDisconnect) {
    window.agent.killApp();
  }
  currentSessionId = null;
  setStatus("idle", reason);
  connectBtn.disabled = false;
  disconnectBtn.disabled = true;
}

void loadFormFromConfig().then((cfg) => {
  log("Agent UI loaded.");
  if (cfg.hostToken && cfg.apiBaseUrl) {
    log("Stored credentials detected. Click Go online to create a session.");
  } else {
    log("First launch — paste your host token from the web dashboard.");
  }
});
