import type { HostConfig, InputEvent } from "../shared/messages";
import { captureScreen } from "./capture.js";
import { injectPlayerInput } from "./input-mapping.js";
import { startGuardPolling, stopGuardPolling } from "./input-guard.js";
import { deriveSignalingUrl } from "./config.js";
import { shareCard, playerLinkInput, connectBtn, disconnectBtn } from "./dom.js";
import { log, resetPipeline, setPipelineStep, setStatus } from "./ui.js";
import { connectPreviewWs, teardownPreview } from "./preview.js";
import { session } from "./state.js";

export async function createSession(
  cfg: HostConfig,
  requestedGameId: string | null,
): Promise<{ sessionId: string; playerToken: string; gameId?: string }> {
  const url = `${cfg.apiBaseUrl.replace(/\/$/, "")}/api/sessions`;

  // Find game name for the session appName field.
  let appName = cfg.appName || "Streamed App";
  if (requestedGameId) {
    const entry = session.libraryEntries.find((e) => e.gameId === requestedGameId);
    if (entry) appName = entry.game.title;
  }

  const body: Record<string, unknown> = {
    hostToken: cfg.hostToken,
    appName,
    ratePerMinute: cfg.ratePerMinute,
  };
  if (requestedGameId) {
    body["requestedGameId"] = requestedGameId;
  }

  const resp = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = (await resp.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Session create failed (${resp.status})`);
  }
  const data = (await resp.json()) as {
    id: string;
    playerToken: string;
    gameId?: string;
  };
  return {
    sessionId: data.id,
    playerToken: data.playerToken,
    gameId: data.gameId ?? requestedGameId ?? undefined,
  };
}

export function showPlayerLink(cfg: HostConfig, playerToken: string): void {
  const link = `${cfg.apiBaseUrl.replace(/\/$/, "")}/play/${encodeURIComponent(playerToken)}`;
  playerLinkInput.value = link;
  shareCard.hidden = false;
}

export async function connect(cfg: HostConfig, gameId: string | null): Promise<void> {
  cancelDeferredTeardown();
  session.currentConfig = cfg;
  session.currentGameId = gameId;
  setStatus("connecting", "Creating session…");
  connectBtn.disabled = true;
  let created: { sessionId: string; playerToken: string; gameId?: string };
  try {
    created = await createSession(cfg, gameId);
    session.currentSessionId = created.sessionId;
    if (created.gameId) session.currentGameId = created.gameId;
    showPlayerLink(cfg, created.playerToken);
    log(`Session created: ${created.sessionId}`);
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
  url.searchParams.set("sessionId", created.sessionId);

  session.ws = new WebSocket(url.toString());

  session.ws.onopen = () => {
    log("Signaling connected. Waiting for the player to join…");
    setStatus("idle", "Online — share the player link");
    disconnectBtn.disabled = false;
    // Open the preview signaling channel alongside the main session.
    connectPreviewWs(cfg);
  };

  session.ws.onmessage = async (ev) => {
    let msg: { type: string; [k: string]: unknown };
    try {
      msg = JSON.parse(typeof ev.data === "string" ? ev.data : "");
    } catch {
      return;
    }
    if (msg.type === "welcome") {
      // Acknowledged by signaling.
    } else if (msg.type === "peer-joined" && msg["role"] === "player") {
      if (session.isStreaming) {
        // Same session player reconnecting after a brief WS drop.
        // The PC is still alive; cancel any deferred teardown and wait for
        // the player to send an ICE restart re-offer.
        log("[reconnect] Player re-joined signaling — cancelling deferred teardown");
        cancelDeferredTeardown();
      } else {
        await onPlayerJoined(cfg);
      }
    } else if (msg.type === "offer" && session.pc) {
      // ICE-restart re-offer from the player. Accept it and answer.
      log("[ice-restart] Received re-offer from player — renegotiating ICE");
      try {
        const sdp = msg["sdp"] as RTCSessionDescriptionInit | string;
        const desc: RTCSessionDescriptionInit =
          typeof sdp === "string" ? { type: "offer", sdp } : sdp;
        await session.pc.setRemoteDescription(desc);
        const answer = await session.pc.createAnswer();
        await session.pc.setLocalDescription(answer);
        session.ws!.send(
          JSON.stringify({ type: "answer", sdp: { type: answer.type, sdp: answer.sdp } }),
        );
        log("[ice-restart] Sent answer — awaiting ICE recovery");
      } catch (err) {
        log(`[ice-restart] Re-offer handling failed: ${String(err)}`);
      }
    } else if (msg.type === "answer" && session.pc) {
      const sdp = msg["sdp"] as RTCSessionDescriptionInit | string;
      const desc: RTCSessionDescriptionInit =
        typeof sdp === "string" ? { type: "answer", sdp } : sdp;
      await session.pc
        .setRemoteDescription(desc)
        .catch((err) => log(`setRemoteDescription failed: ${String(err)}`));
    } else if (msg.type === "ice-candidate" && session.pc) {
      try {
        await session.pc.addIceCandidate(msg["candidate"] as RTCIceCandidateInit);
      } catch (err) {
        log(`ICE add failed: ${String(err)}`);
      }
    } else if (msg.type === "input") {
      try {
        injectPlayerInput(msg as Record<string, unknown>);
      } catch {
        /* ignore */
      }
    } else if (msg.type === "peer-left" && msg["role"] === "player") {
      // Player WS dropped — might be a transient reconnect; give 20s grace
      // before tearing down, in case the player's WS reconnects.
      log("[reconnect] Player left signaling — deferred teardown in 20s");
      teardownDeferred("Player left — no reconnect", 20_000);
    } else if (msg.type === "error") {
      log(`Signaling error: ${String(msg["error"])}`);
    }
  };

  session.ws.onerror = () => {
    setStatus("error", "Signaling connection error");
  };

  // Reconnect the WS with exponential backoff when streaming.
  // Without reconnect, a transient network blip kills the session even if ICE
  // would otherwise recover — the host needs WS alive to exchange re-offers.
  let wsReconnectDelay = 1000;
  session.ws.onclose = () => {
    log("Signaling closed.");
    if (!session.isStreaming) {
      teardownDeferred("Signaling closed", 8000);
      return;
    }
    const delay = wsReconnectDelay;
    wsReconnectDelay = Math.min(wsReconnectDelay * 2, 8000);
    log(`[session.ws] Reconnecting signaling in ${delay}ms…`);
    const closedUrl = session.ws!.url;
    if (session.wsReconnectTimer) clearTimeout(session.wsReconnectTimer);
    session.wsReconnectTimer = setTimeout(() => {
      session.wsReconnectTimer = null;
      if (!session.isStreaming) return;
      const newWs = new WebSocket(closedUrl);
      session.ws = newWs;
      attachWsHandlers(newWs, cfg, wsReconnectDelay);
    }, delay);
  };
}

// Re-attach session.ws event handlers after a reconnect.
// Mirrors the session.ws.onmessage / onerror / onclose block inside connect() but
// references the module-level `session.ws` variable so ICE candidate sending always
// uses the live socket.
// `initialDelay` is the backoff delay already accumulated so far — passed in
// so the reconnect ladder (1→2→4→8s) continues across successive reconnects
// rather than resetting to 1s on every call.
export function attachWsHandlers(newWs: WebSocket, cfg: HostConfig, initialDelay = 1000): void {
  let wsReconnectDelay = initialDelay;

  newWs.onopen = () => {
    session.ws = newWs;
    wsReconnectDelay = 1000; // reset backoff on successful open
    log("[session.ws] Signaling reconnected");
    // Cancel any deferred teardown scheduled during the WS outage.
    cancelDeferredTeardown();
    // The player's own reconnect loop will re-send an ICE restart offer;
    // we just need the WS to be alive to relay it.
  };

  newWs.onmessage = async (ev) => {
    let msg: { type: string; [k: string]: unknown };
    try {
      msg = JSON.parse(typeof ev.data === "string" ? ev.data : "");
    } catch {
      return;
    }
    if (msg.type === "offer" && session.pc) {
      log("[ice-restart] Received re-offer (reconnected WS) — renegotiating ICE");
      try {
        const sdp = msg["sdp"] as RTCSessionDescriptionInit | string;
        const desc: RTCSessionDescriptionInit =
          typeof sdp === "string" ? { type: "offer", sdp } : sdp;
        await session.pc.setRemoteDescription(desc);
        const answer = await session.pc.createAnswer();
        await session.pc.setLocalDescription(answer);
        newWs.send(
          JSON.stringify({ type: "answer", sdp: { type: answer.type, sdp: answer.sdp } }),
        );
      } catch (err) {
        log(`[ice-restart] Re-offer (reconnected) failed: ${String(err)}`);
      }
    } else if (msg.type === "answer" && session.pc) {
      const sdp = msg["sdp"] as RTCSessionDescriptionInit | string;
      const desc: RTCSessionDescriptionInit =
        typeof sdp === "string" ? { type: "answer", sdp } : sdp;
      await session.pc.setRemoteDescription(desc).catch((err) => log(`setRemoteDescription failed: ${String(err)}`));
    } else if (msg.type === "ice-candidate" && session.pc) {
      try {
        await session.pc.addIceCandidate(msg["candidate"] as RTCIceCandidateInit);
      } catch (err) {
        log(`ICE add failed: ${String(err)}`);
      }
    } else if (msg.type === "peer-left" && msg["role"] === "player") {
      // Grace period: player may be reconnecting their WS.
      log("[reconnect] Player left signaling (reconnected WS) — deferred teardown in 20s");
      teardownDeferred("Player left — no reconnect", 20_000);
    } else if (msg.type === "peer-joined" && msg["role"] === "player") {
      if (session.isStreaming) {
        // Same-session player reconnect — cancel deferred teardown, wait for re-offer.
        log("[reconnect] Player re-joined (reconnected WS) — cancelling deferred teardown");
        cancelDeferredTeardown();
      } else {
        await onPlayerJoined(cfg);
      }
    }
  };

  newWs.onerror = () => {
    log("[session.ws] Reconnected signaling error");
  };

  newWs.onclose = () => {
    if (!session.isStreaming) {
      teardownDeferred("Signaling closed", 8000);
      return;
    }
    const delay = wsReconnectDelay;
    wsReconnectDelay = Math.min(wsReconnectDelay * 2, 8000);
    log(`[session.ws] Reconnecting signaling in ${delay}ms…`);
    const closedUrl = newWs.url;
    if (session.wsReconnectTimer) clearTimeout(session.wsReconnectTimer);
    session.wsReconnectTimer = setTimeout(() => {
      session.wsReconnectTimer = null;
      if (!session.isStreaming) return;
      const nextWs = new WebSocket(closedUrl);
      session.ws = nextWs;
      attachWsHandlers(nextWs, cfg, wsReconnectDelay);
    }, delay);
  };
}

// Send a structured control message to the player via the signaling relay.
// The signaling server forwards any "control" typed message from host → player.
// Used to explicitly communicate host_busy / game_unavailable before the host
// closes its WS or tears down the session.
export function sendControlReject(reason: "host_busy" | "game_unavailable"): void {
  if (session.ws?.readyState === WebSocket.OPEN) {
    session.ws.send(
      JSON.stringify({ type: "control", action: "reject", reason }),
    );
  }
}

// Fetch authoritative session fields from the server at join time.
export async function fetchSessionContext(
  cfg: HostConfig,
  sessionId: string,
): Promise<{
  gameId: string | null;
  claimedByPlayerId: string | null;
  isTest: boolean;
} | null> {
  try {
    const url =
      `${cfg.apiBaseUrl.replace(/\/$/, "")}/api/sessions/${encodeURIComponent(sessionId)}` +
      `?hostToken=${encodeURIComponent(cfg.hostToken)}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = (await resp.json()) as {
      gameId?: string | null;
      claimedByPlayerId?: string | null;
      isTest?: boolean;
    };
    return {
      gameId: data.gameId ?? null,
      claimedByPlayerId: data.claimedByPlayerId ?? null,
      isTest: !!data.isTest,
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Player joined — launch game and start stream
// ─────────────────────────────────────────────────────────────────────────────

export async function onPlayerJoined(cfg: HostConfig): Promise<void> {
  // One-active-session guard. If already streaming, the host machine is busy.
  // Send a structured rejection code so the player receives an explicit error.
  // IMPORTANT: Do NOT close session.ws here — that would destroy the active stream.
  if (session.isStreaming) {
    log("host_busy — already streaming. Sending rejection to duplicate peer.");
    sendControlReject("host_busy");
    return;
  }
  session.isStreaming = true;
  window.agent.connectGamepad();
  startGuardPolling();
  void window.agent.getGamepadInjectorStatus().then((st) => {
    if (!st.ok && !session.gamepadWarnedOnce) {
      session.gamepadWarnedOnce = true;
      log(`[gamepad] ${st.error}`);
    }
  });

  setStatus("connecting", "Player joined — preparing stream…");
  resetPipeline(true);

  // Fetch authoritative session context from the server before launching.
  let resolvedGameId = session.currentGameId;
  let claimedByPlayerId: string | null = null;
  let isTestSession = false;
  if (session.currentSessionId) {
    const sessionCtx = await fetchSessionContext(cfg, session.currentSessionId);
    if (sessionCtx?.gameId) {
      if (sessionCtx.gameId !== session.currentGameId) {
        log(`gameId corrected by server: ${session.currentGameId} → ${sessionCtx.gameId}`);
      }
      resolvedGameId = sessionCtx.gameId;
      session.currentGameId = sessionCtx.gameId;
    }
    claimedByPlayerId = sessionCtx?.claimedByPlayerId ?? null;
    isTestSession = sessionCtx?.isTest ?? false;
  }

  // Register exit callback BEFORE launching. When the game process exits,
  // main sends "app:game-exited" → we auto-end the session.
  window.agent.onGameExited(() => {
    log("Game process exited — ending session automatically.");
    void teardown("Game exited");
  });

  // Library-based launch
  if (resolvedGameId && session.libraryEntries.length > 0) {
    const entry = session.libraryEntries.find(
      (e) => e.gameId === resolvedGameId && e.enabled,
    );
    if (!entry) {
      log(`[game_unavailable] Game ${resolvedGameId} not in library or disabled.`);
      setPipelineStep("launch", "error", "игры нет в библиотеке или она выключена");
      setStatus("error", "Game unavailable");
      sendControlReject("game_unavailable");
      session.isStreaming = false;
      void teardown("game_unavailable");
      return;
    }
    const isBrowser = !!entry.boundUrl;
    if (!isBrowser && !entry.localAvailable) {
      log(
        `[game_unavailable] ${entry.game.title}: ${entry.lastError || "file not found"}`,
      );
      setPipelineStep("launch", "error", `файл игры не найден: ${entry.game.title}`);
      setStatus("error", `Game file not found: ${entry.game.title}`);
      sendControlReject("game_unavailable");
      session.isStreaming = false;
      void teardown("game_unavailable");
      return;
    }

    session.activeSaveSyncContext = null;
    if (
      session.currentSessionId &&
      claimedByPlayerId &&
      !isTestSession &&
      !isBrowser
    ) {
      setPipelineStep("saves", "active", "загрузка сейва…");
      const pullResult = await window.agent.saveSyncPull({
        hostToken: cfg.hostToken,
        apiBaseUrl: cfg.apiBaseUrl,
        sessionId: session.currentSessionId,
        gameId: resolvedGameId,
        appPath: entry.appPath,
        steamAppId: entry.game.steamAppId ?? null,
      });
      session.activeSaveSyncContext = {
        hostToken: cfg.hostToken,
        apiBaseUrl: cfg.apiBaseUrl,
        sessionId: session.currentSessionId,
        gameId: resolvedGameId,
        appPath: entry.appPath,
        steamAppId: entry.game.steamAppId ?? null,
      };
      if (!pullResult.ok) {
        log(`Save pull failed: ${pullResult.error ?? "unknown"}`);
        setPipelineStep("saves", "error", pullResult.error ?? "ошибка загрузки");
      } else if (pullResult.skipped) {
        const note =
          pullResult.reason === "no_cloud_save"
            ? "новая игра"
            : pullResult.reason === "no_save_paths"
              ? "пути не найдены"
              : "пропущено";
        setPipelineStep("saves", "done", note);
      } else {
        setPipelineStep("saves", "done", "сейв загружен");
      }
    } else {
      setPipelineStep("saves", "done", "не требуется");
    }

    setPipelineStep("launch", "active");
    const launchResult = await window.agent.launchEntry({
      appPath: entry.appPath,
      boundUrl: entry.boundUrl,
      launchArgs: entry.launchArgs,
    });
    if (!launchResult.ok) {
      // Hard-fail: do not start WebRTC capture when the game couldn't launch.
      log(`[game_unavailable] Launch failed for ${entry.game.title}: ${launchResult.error}`);
      setPipelineStep("launch", "error", `запуск не удался: ${launchResult.error}`);
      setStatus("error", `Launch failed: ${launchResult.error}`);
      sendControlReject("game_unavailable");
      session.isStreaming = false;
      void teardown("game_unavailable");
      return;
    }
    log(`Launched ${entry.game.title} (pid=${launchResult.pid ?? "browser"}).`);
    setPipelineStep("launch", "done", entry.game.title);
  } else {
    setPipelineStep("saves", "done", "не требуется");
    setPipelineStep("launch", "active");
    // Legacy path: launch from HostConfig.appPath / boundUrl
    const launchResult = await window.agent.launchApp();
    if (!launchResult.ok) {
      // Hard-fail: do not capture if legacy app couldn't launch.
      log(`[game_unavailable] Legacy launch failed: ${launchResult.error}`);
      setPipelineStep("launch", "error", `запуск не удался: ${launchResult.error}`);
      setStatus("error", `Launch failed: ${launchResult.error}`);
      sendControlReject("game_unavailable");
      session.isStreaming = false;
      void teardown("game_unavailable");
      return;
    }
    log(`App launched (pid=${launchResult.pid}).`);
    setPipelineStep("launch", "done");
  }

  setPipelineStep("window", "active", "ищем окно игры…");
  try {
    session.captureStream = await captureScreen(cfg);
  } catch (err) {
    setPipelineStep("window", "error", String(err));
    setStatus("error", `Capture failed: ${String(err)}`);
    sendControlReject("game_unavailable");
    session.isStreaming = false;
    void teardown("capture_failed");
    return;
  }
  setPipelineStep("stream", "active", "устанавливаем WebRTC-соединение…");
  const captureMode = cfg.captureMode ?? "chromium";
  log(`[capture] mode=${captureMode}${captureMode === "native" ? " (fallback to chromium if native unavailable)" : ""}`);

  // Fetch ICE server config (STUN + optional TURN) from the API.
  let iceServers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
  try {
    const cfgRes = await fetch(`${cfg.apiBaseUrl.replace(/\/$/, "")}/api/public/ice-config`);
    if (cfgRes.ok) {
      const cfgJson = (await cfgRes.json()) as { iceServers: RTCIceServer[] };
      if (Array.isArray(cfgJson.iceServers) && cfgJson.iceServers.length > 0) {
        iceServers = cfgJson.iceServers;
      }
    }
  } catch {
    log("[ice] Failed to fetch ICE config, using default STUN only");
  }

  session.pc = new RTCPeerConnection({ iceServers });

  session.pc.onicecandidate = (e) => {
    if (e.candidate && session.ws?.readyState === WebSocket.OPEN) {
      session.ws.send(
        JSON.stringify({
          type: "ice-candidate",
          candidate: e.candidate.toJSON(),
        }),
      );
    }
  };
  session.pc.onconnectionstatechange = () => {
    log(`Peer state: ${session.pc?.connectionState}`);
    if (session.pc?.connectionState === "connected") {
      setStatus("streaming", "Streaming to player");
      setPipelineStep("stream", "done");
      setPipelineStep("player", "done");
      if (session.hostStatsTimer) clearInterval(session.hostStatsTimer);
      session.hostStatsTimer = setInterval(() => {
        void uploadHostStats(cfg);
      }, 10_000);
      // Log the ICE candidate type (relay / srflx / host) for diagnostics.
      void session.pc.getStats().then((stats) => {
        stats.forEach((report) => {
          if (report.type === "candidate-pair" && report.state === "succeeded") {
            const localId: string = (report as unknown as Record<string, string>)["localCandidateId"];
            stats.forEach((r) => {
              if (r.id === localId && r.type === "local-candidate") {
                const t = (r as unknown as Record<string, string>)["candidateType"] ?? "host";
                log(`[ice] connection type: ${t}`);
              }
            });
          }
        });
      });
    } else if (session.pc?.connectionState === "closed") {
      // Terminal state — end billing session (teardownPeer alone left billing running).
      teardown("Peer connection closed");
    } else if (session.pc?.connectionState === "failed") {
      // ICE negotiation failed; give 30s for ICE restart to recover before
      // tearing down.  The player side triggers restartIce() automatically.
      log("[ice] connectionState failed — deferred teardown in 30s");
      teardownDeferred("ICE failed — no recovery", 30_000);
    } else if (session.pc?.connectionState === "disconnected") {
      // Transient loss (e.g. Wi-Fi handover).  Give 30s for ICE restart.
      log("[ice] connectionState disconnected — deferred teardown in 30s");
      teardownDeferred("ICE disconnected — no recovery", 30_000);
    }
  };

  session.pc.ondatachannel = (ev) => {
    session.dataChannel = ev.channel;
    session.dataChannel.onmessage = (m) => {
      try {
        const raw = JSON.parse(m.data) as Record<string, unknown>;
        // E2E latency ping — reflect timestamp back to player immediately.
        if (raw["type"] === "dc-ping") {
          if (session.dataChannel?.readyState === "open") {
            session.dataChannel.send(JSON.stringify({ type: "dc-pong", t: raw["t"] }));
          }
          return;
        }
        // Adaptive-bitrate hint from the player: renegotiate the video sender's
        // maxBitrate live without a full re-offer.
        if (raw["type"] === "set-bitrate") {
          const kbps = Number(raw["kbps"]);
          if (Number.isFinite(kbps) && kbps > 0) {
            const clamped = Math.max(300, Math.min(20_000, Math.round(kbps)));
            const sender = session.pc?.getSenders().find((s) => s.track?.kind === "video");
            if (sender) {
              const p = sender.getParameters();
              p.encodings = p.encodings ?? [{}];
              p.encodings[0]!.maxBitrate = clamped * 1000;
              void sender.setParameters(p).catch(() => undefined);
            }
          }
          return;
        }
        // FPS cap hint from the player.
        if (raw["type"] === "set-fps") {
          const fps = Number(raw["fps"]);
          if (Number.isFinite(fps) && fps > 0) {
            const clamped = Math.max(15, Math.min(144, Math.round(fps)));
            const sender = session.pc?.getSenders().find((s) => s.track?.kind === "video");
            if (sender) {
              const p = sender.getParameters();
              p.encodings = p.encodings ?? [{}];
              p.encodings[0]!.maxFramerate = clamped;
              void sender.setParameters(p).catch(() => undefined);
            }
          }
          return;
        }
        if (raw["type"] === "set-resolution") {
          const width = Number(raw["width"]);
          const height = Number(raw["height"]);
          if (Number.isFinite(width) && Number.isFinite(height) && width >= 640 && height >= 360) {
            session.captureWidth = Math.round(width);
            session.captureHeight = Math.round(height);
            log(`[adaptive] capture resolution → ${session.captureWidth}x${session.captureHeight}`);
          }
          return;
        }
        // Gamepad input from the virtual touch overlay on mobile.
        if (raw["type"] === "gamepad") {
          // Validate payload shape and clamp to expected ranges.
          const rawAxes = Array.isArray(raw["axes"]) ? (raw["axes"] as unknown[]) : null;
          const rawBtns = Array.isArray(raw["buttons"]) ? (raw["buttons"] as unknown[]) : null;
          if (!rawAxes || !rawBtns) return; // malformed — discard
          if (rawAxes.length > 16 || rawBtns.length > 32) return;
          // Clamp axes to [-1, 1]; buttons to {0, 1}.
          const axes = rawAxes.map((v) =>
            Math.max(-1, Math.min(1, typeof v === "number" ? v : 0)),
          );
          const buttons = rawBtns.map((v) => (v ? 1 : 0));
          if (typeof window.agent.injectGamepad === "function") {
            window.agent.injectGamepad({ axes, buttons });
          } else if (!session.gamepadWarnedOnce) {
            session.gamepadWarnedOnce = true;
            log("[gamepad] ViGEm/XInput backend not connected — overlay input received but not injected.");
          }
          return;
        }
        if (typeof raw["kind"] === "string" &&
          (raw["kind"] === "mousemove" ||
            raw["kind"] === "mousedown" ||
            raw["kind"] === "mouseup" ||
            raw["kind"] === "wheel" ||
            raw["kind"] === "keydown" ||
            raw["kind"] === "keyup")) {
          window.agent.injectInput(raw as unknown as InputEvent);
        } else if (raw["type"] === "input") {
          injectPlayerInput(raw);
        }
      } catch {
        /* ignore */
      }
    };
  };

  for (const track of session.captureStream.getTracks()) {
    session.pc.addTrack(track, session.captureStream);
  }

  const videoSender = session.pc.getSenders().find((s) => s.track?.kind === "video");
  if (videoSender) {
    const params = videoSender.getParameters();
    params.encodings = params.encodings ?? [{}];
    params.encodings[0]!.maxBitrate = cfg.bitrateKbps * 1000;
    params.degradationPreference = "maintain-framerate";
    await videoSender.setParameters(params).catch(() => undefined);
  }

  // Set Opus audio bitrate based on selected audioMode.
  const audioModeBitrate: Record<string, number> = {
    voice: 12_000,
    standard: 32_000,
    quality: 64_000,
  };
  const selectedAudioMode = cfg.audioMode ?? "off";
  if (selectedAudioMode !== "off") {
    const audioBitrate = audioModeBitrate[selectedAudioMode];
    const audioSender = session.pc.getSenders().find((s) => s.track?.kind === "audio");
    if (audioSender && audioBitrate) {
      const audioParams = audioSender.getParameters();
      audioParams.encodings = audioParams.encodings ?? [{}];
      audioParams.encodings[0]!.maxBitrate = audioBitrate;
      await audioSender.setParameters(audioParams).catch(() => undefined);
      log(`[audio] Opus maxBitrate set to ${audioBitrate / 1000} kbps (mode=${selectedAudioMode})`);
    }
  }

  // Force H.264 via setCodecPreferences so NVENC is used wherever available.
  const videoTransceiver = session.pc.getTransceivers().find(
    (t) => t.sender.track?.kind === "video",
  );
  if (videoTransceiver) {
    const capabilities = RTCRtpSender.getCapabilities("video");
    if (capabilities) {
      const h264 = capabilities.codecs.filter(
        (c) => c.mimeType.toLowerCase() === "video/h264",
      );
      if (h264.length > 0) {
        try {
          videoTransceiver.setCodecPreferences(h264);
          log("[h264] setCodecPreferences applied — H.264 preferred");
        } catch {
          log("[h264] setCodecPreferences not supported in this runtime");
        }
      }
    }
  }

  const offer = await session.pc.createOffer();
  const sdp = offer.sdp ?? "";
  if (/a=rtcp-fb:.* nack/i.test(sdp)) {
    log("[webrtc] RTX/NACK feedback present in SDP");
  }
  await session.pc.setLocalDescription(offer);
  session.ws?.send(
    JSON.stringify({
      type: "offer",
      sdp: { type: offer.type, sdp: offer.sdp },
    }),
  );
  setPipelineStep("player", "active", "ждём подключения игрока…");
}

export async function uploadHostStats(cfg: HostConfig): Promise<void> {
  if (!session.pc || !session.currentSessionId || !cfg.hostToken) return;
  try {
    const stats = await session.pc.getStats();
    let kbps = 0;
    let fps = 0;
    let packetsLost = 0;
    let packetsSent = 0;
    let framesDropped = 0;
    let iceType = "host";
    stats.forEach((r) => {
      if (r.type === "outbound-rtp" && (r as { kind?: string }).kind === "video") {
        const rr = r as unknown as Record<string, number>;
        kbps = Math.round(((rr["bytesSent"] ?? 0) * 8) / 10_000);
        fps = Math.round(rr["framesPerSecond"] ?? 0);
        packetsLost = rr["packetsLost"] ?? 0;
        packetsSent = rr["packetsSent"] ?? 0;
        framesDropped = rr["framesDropped"] ?? 0;
      }
      if (r.type === "candidate-pair" && (r as { state?: string }).state === "succeeded") {
        const localId = (r as unknown as Record<string, string>)["localCandidateId"];
        stats.forEach((c) => {
          if (c.id === localId && c.type === "local-candidate") {
            iceType = (c as unknown as Record<string, string>)["candidateType"] ?? "host";
          }
        });
      }
    });
    const lossPct = packetsSent > 0 ? Math.round((packetsLost / (packetsSent + packetsLost)) * 1000) / 10 : 0;
    if (session.dataChannel?.readyState === "open") {
      session.dataChannel.send(JSON.stringify({
        type: "host-stats",
        kbps,
        fps,
        lossPct,
        framesDropped,
        iceCandidateType: iceType,
      }));
    }
    await fetch(`${cfg.apiBaseUrl.replace(/\/$/, "")}/api/sessions/${session.currentSessionId}/metrics`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.hostToken}`,
      },
      body: JSON.stringify({
        samples: [{
          role: "host",
          bitrateKbps: kbps,
          fps,
          packetLossPct: lossPct,
          framesDropped,
          iceCandidateType: iceType,
        }],
      }),
    });
  } catch {
    /* stats not ready */
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Teardown
// ─────────────────────────────────────────────────────────────────────────────

export function teardownPeer(cfg: HostConfig): void {
  session.isStreaming = false;
  stopGuardPolling();
  void window.agent.clearInputGuard();
  window.agent.disconnectGamepad();
  session.gamepadWarnedOnce = false;
  if (session.hostStatsTimer) {
    clearInterval(session.hostStatsTimer);
    session.hostStatsTimer = null;
  }
  try { session.dataChannel?.close(); } catch { /* */ }
  session.dataChannel = null;
  try { session.pc?.close(); } catch { /* */ }
  session.pc = null;
  session.captureStream?.getTracks().forEach((t) => t.stop());
  session.captureStream = null;
  if (cfg.killAppOnDisconnect) {
    window.agent.killApp();
  }
  setStatus("idle", "Player disconnected — waiting");
}


export function cancelDeferredTeardown(): void {
  if (session.pendingTeardown) {
    clearTimeout(session.pendingTeardown);
    session.pendingTeardown = null;
  }
}

export function teardownDeferred(reason: string, graceMs: number): void {
  cancelDeferredTeardown();
  const sidAtSchedule = session.currentSessionId;
  session.pendingTeardown = setTimeout(() => {
    session.pendingTeardown = null;
    if (session.currentSessionId && session.currentSessionId === sidAtSchedule) {
      void teardown(reason);
    }
  }, graceMs);
}

export function teardown(reason: string): Promise<void> {
  return teardownAsync(reason);
}

export async function teardownAsync(reason: string): Promise<void> {
  cancelDeferredTeardown();
  if (session.wsReconnectTimer) {
    clearTimeout(session.wsReconnectTimer);
    session.wsReconnectTimer = null;
  }
  stopGuardPolling();
  void window.agent.clearInputGuard();
  window.agent.clearInputBlock();
  log(reason);

  const saveCtx = session.activeSaveSyncContext;
  session.activeSaveSyncContext = null;

  if (saveCtx) {
    setPipelineStep("saves", "active", "сохранение сейва…");
    try {
      const pushResult = await window.agent.saveSyncPush(saveCtx);
      if (!pushResult.ok) {
        log(`Save push failed: ${pushResult.error ?? "unknown"}`);
        setPipelineStep("saves", "error", pushResult.error ?? "ошибка сохранения");
      } else if (pushResult.skipped) {
        log(`Save push skipped: ${pushResult.reason ?? "unknown"}`);
        setPipelineStep("saves", "done", "нечего сохранять");
      } else {
        log("Save uploaded to cloud.");
        setPipelineStep("saves", "done", "сейв сохранён");
      }
    } catch (err) {
      log(`Save push error: ${String(err)}`);
      setPipelineStep("saves", "error", "ошибка сохранения");
    }
  }

  session.isStreaming = false;

  if (session.currentSessionId && session.currentConfig?.hostToken && session.currentConfig.apiBaseUrl) {
    const sid = session.currentSessionId;
    const base = session.currentConfig.apiBaseUrl.replace(/\/$/, "");
    void fetch(`${base}/api/sessions/${encodeURIComponent(sid)}/end`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostToken: session.currentConfig.hostToken }),
    }).catch((err) => log(`Failed to end session on server: ${String(err)}`));
  }
  try { session.dataChannel?.close(); } catch { /* */ }
  session.dataChannel = null;
  try { session.ws?.close(); } catch { /* */ }
  session.ws = null;
  try { session.pc?.close(); } catch { /* */ }
  session.pc = null;
  session.captureStream?.getTracks().forEach((t) => t.stop());
  session.captureStream = null;
  session.currentCaptureSourceName = "";
  window.agent.setCaptureSource("");
  if (session.currentConfig?.killAppOnDisconnect) {
    window.agent.killApp();
  }
  session.currentSessionId = null;
  session.currentGameId = null;
  shareCard.hidden = true;
  setStatus("idle", reason);
  connectBtn.disabled = false;
  disconnectBtn.disabled = true;
  // Close the preview WS so players don't get an orphaned preview connection.
  teardownPreview();
}