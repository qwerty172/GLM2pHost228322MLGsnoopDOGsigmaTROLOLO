#!/usr/bin/env node
/**
 * Фаза 3: signaling relay без WebRTC media.
 * Регистрация → test session → claim → 2× WS → offer/answer/ICE → peer-joined.
 */
import { createRequire } from "node:module";
import { getHostToken, getPlayerWalletToken, api as smokeApi } from "./smoke-api.mjs";
const require = createRequire(import.meta.url);
const { WebSocket } = require("../artifacts/api-server/node_modules/ws/index.js");

const BASE = process.env.API_BASE ?? "http://localhost:8080";
const WS_BASE = BASE.replace(/^http/, "ws");

async function api(method, path, body, headers = {}) {
  const { ok, json, text } = await smokeApi(method, path, body, headers);
  if (!ok) throw new Error(`${method} ${path} -> ${text}`);
  return json;
}

function waitForMessage(ws, predicate, label, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off("message", onMessage);
      reject(new Error(`Timeout waiting for ${label}`));
    }, timeoutMs);

    function onMessage(raw) {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (predicate(msg)) {
        clearTimeout(timer);
        ws.off("message", onMessage);
        resolve(msg);
      }
    }

    ws.on("message", onMessage);
  });
}

function connectWs(url, onOpen) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    if (onOpen) onOpen(ws);
    ws.once("open", () => resolve(ws));
    ws.once("error", reject);
  });
}

function closeWs(ws) {
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }
    ws.once("close", () => resolve());
    ws.close();
  });
}

async function main() {
  console.log(`Signaling smoke: ${BASE}`);

  const playerWalletToken = await getPlayerWalletToken();
  console.log("OK  player registered");

  const hostToken = await getHostToken();
  console.log("OK  host ready");

  const testResp = await api("POST", "/api/sessions/test", {}, {
    "X-Host-Token": hostToken,
  });
  const sessionId = testResp.session?.id ?? testResp.id;
  const playerToken = testResp.session?.playerToken ?? testResp.playerToken;
  if (!sessionId || !playerToken) {
    throw new Error("Test session response missing id/playerToken");
  }
  console.log(`OK  test session ${sessionId}`);

  await api(
    "POST",
    `/api/sessions/by-player-token/${playerToken}/claim`,
    { playerWalletToken },
  );
  console.log("OK  session claimed");

  const hostWsUrl =
    `${WS_BASE}/api/signal?role=host&hostToken=${encodeURIComponent(hostToken)}` +
    `&sessionId=${encodeURIComponent(sessionId)}`;
  const playerWsUrl =
    `${WS_BASE}/api/signal?role=player&playerToken=${encodeURIComponent(playerToken)}` +
    `&playerWalletToken=${encodeURIComponent(playerWalletToken)}`;

  let hostWelcomePromise;
  let playerWelcomePromise;
  let playerPeerJoinedPromise;

  const hostWs = await connectWs(hostWsUrl, (ws) => {
    hostWelcomePromise = waitForMessage(
      ws,
      (m) => m.type === "welcome" && m.role === "host",
      "host welcome",
    );
  });
  const hostPeerJoinedPromise = waitForMessage(
    hostWs,
    (m) => m.type === "peer-joined" && m.role === "player",
    "host peer-joined",
  );
  const hostWelcome = await hostWelcomePromise;
  if (hostWelcome.sessionId !== sessionId) {
    throw new Error("Host welcome sessionId mismatch");
  }
  console.log("OK  host WS connected");

  const playerWs = await connectWs(playerWsUrl, (ws) => {
    playerWelcomePromise = waitForMessage(
      ws,
      (m) => m.type === "welcome" && m.role === "player",
      "player welcome",
    );
    playerPeerJoinedPromise = waitForMessage(
      ws,
      (m) => m.type === "peer-joined" && m.role === "host",
      "player peer-joined",
    );
  });

  const [playerWelcome] = await Promise.all([
    playerWelcomePromise,
    hostPeerJoinedPromise,
    playerPeerJoinedPromise,
  ]);
  if (playerWelcome.sessionId !== sessionId) {
    throw new Error("Player welcome sessionId mismatch");
  }
  console.log("OK  player WS connected");
  console.log("OK  peer-joined both sides");

  const fakeSdp =
    "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n";

  const playerOfferPromise = waitForMessage(
    playerWs,
    (m) => m.type === "offer" && m.fromRole === "host",
    "player received offer",
  );
  hostWs.send(JSON.stringify({ type: "offer", sdp: fakeSdp }));
  const relayedOffer = await playerOfferPromise;
  if (!relayedOffer.sdp) throw new Error("Offer relay missing sdp");
  console.log("OK  offer relayed host → player");

  const hostAnswerPromise = waitForMessage(
    hostWs,
    (m) => m.type === "answer" && m.fromRole === "player",
    "host received answer",
  );
  playerWs.send(JSON.stringify({ type: "answer", sdp: fakeSdp }));
  const relayedAnswer = await hostAnswerPromise;
  if (!relayedAnswer.sdp) throw new Error("Answer relay missing sdp");
  console.log("OK  answer relayed player → host");

  const playerIcePromise = waitForMessage(
    playerWs,
    (m) => m.type === "ice-candidate" && m.fromRole === "host",
    "player received ICE",
  );
  hostWs.send(
    JSON.stringify({
      type: "ice-candidate",
      candidate: { candidate: "candidate:1 1 UDP 2130706431 127.0.0.1 9 typ host", sdpMid: "0", sdpMLineIndex: 0 },
    }),
  );
  await playerIcePromise;
  console.log("OK  ICE relayed host → player");

  await api("PATCH", `/api/sessions/${sessionId}/end`, {
    hostToken,
    reason: "smoke_test",
  });
  console.log("OK  session ended");

  await Promise.all([closeWs(hostWs), closeWs(playerWs)]);
  console.log("Done — signaling smoke passed.");
}

main().catch((err) => {
  console.error("FAIL signaling-smoke:", err.message);
  process.exit(1);
});
