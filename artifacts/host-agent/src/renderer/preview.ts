import type { HostConfig } from "../shared/messages";
import { captureScreen } from "./capture.js";
import { deriveSignalingUrl } from "./config.js";
import { previewIndicator } from "./dom.js";
import { session } from "./state.js";
import { log } from "./ui.js";

export function teardownPreview(): void {
  try { session.previewPc?.close(); } catch { /* */ }
  session.previewPc = null;
  session.previewOwnStream?.getTracks().forEach((t) => t.stop());
  session.previewOwnStream = null;
  if (previewIndicator) previewIndicator.hidden = true;
  // Keep session.previewWs open — it stays connected while the main session is alive
  // so the host is ready to serve the next preview request.
}

function closePreviewWs(): void {
  teardownPreview();
  try { session.previewWs?.close(); } catch { /* */ }
  session.previewWs = null;
}

async function onPreviewPlayerJoined(cfg: HostConfig): Promise<void> {
  log("[preview] Player joined preview room — starting preview stream.");
  if (previewIndicator) previewIndicator.hidden = false;

  // Reuse the existing capture stream if the host is actively streaming.
  // Otherwise match a game/browser window only — never fall back to full desktop
  // (preview is public and unauthenticated; screen capture would leak the host desktop).
  let stream = session.captureStream;
  if (!stream) {
    try {
      stream = await captureScreen(cfg, { allowScreenFallback: false });
      session.previewOwnStream = stream; // we own this — clean up on teardown
    } catch (err) {
      log(`[preview] Could not capture game window: ${String(err)}`);
      if (previewIndicator) previewIndicator.hidden = true;
      try {
        session.previewWs?.send(
          JSON.stringify({ type: "preview-error", reason: "no_game_window" }),
        );
      } catch {
        /* ignore */
      }
      return;
    }
  }

  // Fetch ICE config.
  let iceServers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
  try {
    const cfgRes = await fetch(`${cfg.apiBaseUrl.replace(/\/$/, "")}/api/public/ice-config`);
    if (cfgRes.ok) {
      const cfgJson = (await cfgRes.json()) as { iceServers: RTCIceServer[] };
      if (Array.isArray(cfgJson.iceServers) && cfgJson.iceServers.length > 0) {
        iceServers = cfgJson.iceServers;
      }
    }
  } catch { /* use default */ }

  const ppc = new RTCPeerConnection({ iceServers });
  session.previewPc = ppc;

  ppc.onicecandidate = (e) => {
    if (e.candidate && session.previewWs?.readyState === WebSocket.OPEN) {
      session.previewWs.send(JSON.stringify({ type: "ice-candidate", candidate: e.candidate.toJSON() }));
    }
  };

  ppc.onconnectionstatechange = () => {
    log(`[preview] Peer state: ${ppc.connectionState}`);
    if (ppc.connectionState === "closed" || ppc.connectionState === "failed" || ppc.connectionState === "disconnected") {
      if (session.previewPc === ppc) teardownPreview();
    }
  };

  // Add only video tracks — preview is always muted.
  for (const track of stream.getVideoTracks()) {
    ppc.addTrack(track, stream);
  }

  try {
    const offer = await ppc.createOffer();
    await ppc.setLocalDescription(offer);
    session.previewWs?.send(JSON.stringify({ type: "offer", sdp: { type: offer.type, sdp: offer.sdp } }));
    log("[preview] Offer sent to preview player.");
  } catch (err) {
    log(`[preview] Failed to create/send offer: ${String(err)}`);
    teardownPreview();
  }
}

export function connectPreviewWs(cfg: HostConfig): void {
  if (cfg.allowPreview === false) {
    log("[preview] Preview disabled in settings — skipping preview WS.");
    return;
  }
  if (!cfg.hostToken || !cfg.apiBaseUrl) return;

  // Close any existing preview WS first.
  closePreviewWs();

  let sigUrl: URL;
  try {
    sigUrl = new URL(deriveSignalingUrl(cfg));
  } catch {
    return;
  }
  sigUrl.searchParams.set("type", "preview");
  sigUrl.searchParams.set("hostToken", cfg.hostToken);

  const pws = new WebSocket(sigUrl.toString());
  session.previewWs = pws;

  pws.onopen = () => {
    log("[preview] Preview signaling connected — ready to accept preview requests.");
  };

  pws.onmessage = async (ev) => {
    let msg: { type: string; [k: string]: unknown };
    try {
      msg = JSON.parse(typeof ev.data === "string" ? ev.data : "");
    } catch {
      return;
    }

    if (msg.type === "peer-joined" && msg["role"] === "player") {
      if (session.previewPc) {
        // Already in a preview — ignore additional player
        log("[preview] Already in a preview, ignoring duplicate peer-joined.");
        return;
      }
      const currentCfg = session.currentConfig ?? cfg;
      await onPreviewPlayerJoined(currentCfg);
    } else if (msg.type === "answer" && session.previewPc) {
      const sdp = msg["sdp"] as RTCSessionDescriptionInit | string;
      const desc: RTCSessionDescriptionInit = typeof sdp === "string" ? { type: "answer", sdp } : sdp;
      await session.previewPc.setRemoteDescription(desc).catch((err) => log(`[preview] setRemoteDescription failed: ${String(err)}`));
    } else if (msg.type === "ice-candidate" && session.previewPc) {
      try {
        await session.previewPc.addIceCandidate(msg["candidate"] as RTCIceCandidateInit);
      } catch (err) {
        log(`[preview] ICE add failed: ${String(err)}`);
      }
    } else if (msg.type === "peer-left") {
      log("[preview] Preview player left.");
      teardownPreview();
    } else if (msg.type === "preview-ended") {
      log("[preview] Preview ended by server.");
      teardownPreview();
    }
  };

  pws.onerror = () => {
    log("[preview] Preview signaling error.");
  };

  pws.onclose = () => {
    log("[preview] Preview signaling closed.");
    if (session.previewWs === pws) {
      session.previewWs = null;
      teardownPreview();
    }
  };
}