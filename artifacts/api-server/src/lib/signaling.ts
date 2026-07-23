import type { Server as HttpServer, IncomingMessage } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { eq, and, isNull } from "drizzle-orm";
import { db, hostsTable, sessionsTable, playersTable } from "@workspace/db";
import { logger } from "./logger";
import { pickPlayerBucket } from "./lzt";
import { getRedis, getRedisSubscriber, isRedisAvailable } from "./redis";
import { verifyWsTicket } from "./jwt";

type Role = "host" | "player";

interface RoomPeer {
  socket: WebSocket;
  role: Role;
}

interface Room {
  peers: Map<string, RoomPeer>;
}

const rooms = new Map<string, Room>();

const INSTANCE_ID = `${process.pid}-${Date.now().toString(36)}`;
const subscribedChannels = new Set<string>();

function signalChannel(sessionId: string): string {
  return `signal:${sessionId}`;
}

async function ensureSignalSubscription(sessionId: string): Promise<void> {
  const channel = signalChannel(sessionId);
  if (subscribedChannels.has(channel)) return;
  const sub = getRedisSubscriber();
  if (!sub) return;
  await sub.subscribe(channel);
  subscribedChannels.add(channel);
}

function initSignalPubSub(): void {
  const sub = getRedisSubscriber();
  if (!sub) return;
  sub.on("message", (channel: unknown, message: unknown) => {
    if (typeof channel !== "string" || typeof message !== "string") return;
    if (!channel.startsWith("signal:")) return;
    const sessionId = channel.slice("signal:".length);
    let parsed: { fromInstance?: string; fromRole?: Role; payload?: unknown };
    try {
      parsed = JSON.parse(message) as typeof parsed;
    } catch {
      return;
    }
    if (parsed.fromInstance === INSTANCE_ID) return;
    const room = rooms.get(sessionId);
    if (!room || !parsed.fromRole) return;
    broadcastToOther(room, parsed.fromRole, parsed.payload);
  });
}

async function relaySignal(
  sessionId: string,
  fromRole: Role,
  payload: unknown,
): Promise<void> {
  const redis = getRedis();
  if (isRedisAvailable() && redis) {
    await ensureSignalSubscription(sessionId);
    await redis.publish(
      signalChannel(sessionId),
      JSON.stringify({ fromInstance: INSTANCE_ID, fromRole, payload }),
    );
    return;
  }
  const room = rooms.get(sessionId);
  if (room) broadcastToOther(room, fromRole, payload);
}

function getRoom(sessionId: string): Room {
  let room = rooms.get(sessionId);
  if (!room) {
    room = { peers: new Map() };
    rooms.set(sessionId, room);
  }
  return room;
}

function send(socket: WebSocket, payload: unknown): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function broadcastToOther(
  room: Room,
  fromRole: Role,
  payload: unknown,
): void {
  for (const peer of room.peers.values()) {
    if (peer.role !== fromRole) {
      send(peer.socket, payload);
    }
  }
}

// ─── Preview rooms ────────────────────────────────────────────────────────────
// Short-lived tokens minted by POST /api/public/preview-session.
// Stored in Redis (preferred) or in-memory — 60-second TTL.
const previewTokens = new Map<string, { hostId: string; expiresAt: number }>();

const PREVIEW_TTL_SEC = 60;

async function storePreviewToken(token: string, hostId: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.setex(`preview:${token}`, PREVIEW_TTL_SEC, hostId);
    return;
  }
  previewTokens.set(token, { hostId, expiresAt: Date.now() + PREVIEW_TTL_SEC * 1000 });
}

async function consumePreviewToken(
  token: string,
): Promise<{ hostId: string } | null> {
  const redis = getRedis();
  if (redis) {
    const hostId = await redis.get(`preview:${token}`);
    if (!hostId) return null;
    await redis.del(`preview:${token}`);
    return { hostId };
  }
  const entry = previewTokens.get(token);
  if (!entry) return null;
  previewTokens.delete(token);
  if (entry.expiresAt < Date.now()) return null;
  return { hostId: entry.hostId };
}

/** Mint a new preview token for the given hostId (60-second TTL). */
export function mintPreviewToken(hostId: string): string {
  const now = Date.now();
  for (const [tok, e] of previewTokens) {
    if (e.expiresAt < now) previewTokens.delete(tok);
  }
  const token = `prev_${Math.random().toString(36).slice(2, 14)}_${now.toString(36)}`;
  void storePreviewToken(token, hostId);
  return token;
}

// Separate signaling rooms for preview, keyed by hostId.
const previewRooms = new Map<string, Room>();

function getPreviewRoom(hostId: string): Room {
  let room = previewRooms.get(hostId);
  if (!room) {
    room = { peers: new Map() };
    previewRooms.set(hostId, room);
  }
  return room;
}

// ─── Session auth ─────────────────────────────────────────────────────────────

interface AuthResult {
  sessionId: string;
  role: Role;
}

async function authenticate(
  url: URL,
): Promise<{ ok: true; result: AuthResult } | { ok: false; reason: string }> {
  const role = url.searchParams.get("role");
  if (role !== "host" && role !== "player") {
    return { ok: false, reason: "role must be host or player" };
  }

  const wsTicket = url.searchParams.get("wsTicket");
  if (wsTicket && process.env["JWT_SECRET"]?.trim()) {
    const claims = await verifyWsTicket(wsTicket);
    if (!claims?.sub || claims.typ !== role) {
      return { ok: false, reason: "invalid ws ticket" };
    }
    const sessionId = claims.sessionId ?? url.searchParams.get("sessionId");
    if (!sessionId) {
      return { ok: false, reason: "sessionId required with ws ticket" };
    }
    const [session] = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, sessionId));
    if (!session || session.status === "ended") {
      return { ok: false, reason: "session not found or ended" };
    }
    if (role === "host") {
      const [host] = await db
        .select()
        .from(hostsTable)
        .where(eq(hostsTable.id, claims.sub));
      if (!host || session.hostId !== host.id) {
        return { ok: false, reason: "ws ticket host mismatch" };
      }
    }
    return { ok: true, result: { sessionId, role } };
  }

  if (role === "host") {
    const hostToken = url.searchParams.get("hostToken");
    const sessionId = url.searchParams.get("sessionId");
    if (!hostToken || !sessionId) {
      return { ok: false, reason: "hostToken and sessionId required" };
    }
    const [host] = await db
      .select()
      .from(hostsTable)
      .where(eq(hostsTable.hostToken, hostToken));
    if (!host) {
      return { ok: false, reason: "invalid host token" };
    }
    const [session] = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, sessionId));
    if (!session || session.hostId !== host.id) {
      return { ok: false, reason: "session not found for this host" };
    }
    if (session.status === "ended") {
      return { ok: false, reason: "session has ended" };
    }
    return { ok: true, result: { sessionId, role } };
  }

  // player
  const playerToken = url.searchParams.get("playerToken");
  if (!playerToken) {
    return { ok: false, reason: "playerToken required" };
  }
  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.playerToken, playerToken));
  if (!session) {
    return { ok: false, reason: "invalid player token" };
  }
  if (session.status === "ended") {
    return { ok: false, reason: "session has ended" };
  }
  // Embed/dev-key sessions (task-125) are funded directly from the dev key's
  // own balance and never go through the claim flow — no player wallet to
  // validate here. The API-side balance check happens in the embed route
  // (and per-tick in the billing worker), not at connect time.
  if (session.devKeyId) {
    return { ok: true, result: { sessionId: session.id, role } };
  }
  const playerWalletToken = url.searchParams.get("playerWalletToken");
  if (!playerWalletToken) {
    return { ok: false, reason: "playerWalletToken required" };
  }
  if (!session.claimedByPlayerId) {
    return { ok: false, reason: "session not claimed — wallet required" };
  }
  const [wallet] = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.playerToken, playerWalletToken));
  if (!wallet) {
    return { ok: false, reason: "invalid wallet token" };
  }
  if (wallet.id !== session.claimedByPlayerId) {
    return { ok: false, reason: "wallet does not match session claimant" };
  }
  const rateLzt = Math.round(Number(session.ratePerMinute) * 200);
  if (rateLzt > 0) {
    const picked = pickPlayerBucket(
      session.paymentSource,
      rateLzt,
      wallet.withdrawableBalanceLzt,
      wallet.internalBalanceLzt,
    );
    if (picked === null) {
      return { ok: false, reason: "insufficient balance to start" };
    }
  }
  return { ok: true, result: { sessionId: session.id, role } };
}

// ─── Preview auth ─────────────────────────────────────────────────────────────

interface PreviewAuthResult {
  hostId: string;
  role: Role;
}

async function authenticatePreview(
  url: URL,
): Promise<{ ok: true; result: PreviewAuthResult } | { ok: false; reason: string }> {
  const hostToken = url.searchParams.get("hostToken");
  const previewToken = url.searchParams.get("previewToken");

  if (hostToken) {
    // Host side: validate hostToken
    const [host] = await db
      .select({ id: hostsTable.id })
      .from(hostsTable)
      .where(eq(hostsTable.hostToken, hostToken));
    if (!host) {
      return { ok: false, reason: "invalid host token" };
    }
    return { ok: true, result: { hostId: host.id, role: "host" } };
  }

  if (previewToken) {
    const entry = await consumePreviewToken(previewToken);
    if (!entry) {
      return { ok: false, reason: "invalid or expired preview token" };
    }
    return { ok: true, result: { hostId: entry.hostId, role: "player" } };
  }

  return { ok: false, reason: "hostToken or previewToken required for preview" };
}

// ─── Session lifecycle helpers ────────────────────────────────────────────────

async function markSessionActive(sessionId: string): Promise<void> {
  const now = new Date();
  await db
    .update(sessionsTable)
    .set({ status: "active", startedAt: now, lastBilledAt: now })
    .where(
      and(eq(sessionsTable.id, sessionId), isNull(sessionsTable.startedAt)),
    );
  await db
    .update(sessionsTable)
    .set({ status: "active" })
    .where(eq(sessionsTable.id, sessionId));
}

async function markHostSeen(hostId: string): Promise<void> {
  await db
    .update(hostsTable)
    .set({ lastSeenAt: new Date() })
    .where(eq(hostsTable.id, hostId));
}

// ─── WS server ────────────────────────────────────────────────────────────────
// Send a message to all players in a session room. Used by the billing worker
// to deliver block-warning and block-expired events without a HTTP round-trip.
export function sendSignalingMessage(sessionId: string, payload: unknown): void {
  const room = rooms.get(sessionId);
  if (!room) return;
  for (const peer of room.peers.values()) {
    if (peer.role === "player") {
      send(peer.socket, payload);
    }
  }
}

export function attachSignaling(server: HttpServer): void {
  initSignalPubSub();
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req: IncomingMessage, socket, head): void => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname !== "/api/signal") {
      return;
    }

    const isPreview = url.searchParams.get("type") === "preview";

    if (isPreview) {
      void authenticatePreview(url)
        .then((auth) => {
          if (!auth.ok) {
            logger.warn({ reason: auth.reason }, "Preview signaling auth rejected");
            socket.write(
              `HTTP/1.1 401 Unauthorized\r\nContent-Length: ${auth.reason.length}\r\n\r\n${auth.reason}`,
            );
            socket.destroy();
            return;
          }
          wss.handleUpgrade(req, socket, head, (ws) => {
            handlePreviewConnection(ws, auth.result);
          });
        })
        .catch((err) => {
          logger.error({ err }, "Preview signaling upgrade error");
          socket.destroy();
        });
      return;
    }

    void authenticate(url)
      .then((auth) => {
        if (!auth.ok) {
          logger.warn({ reason: auth.reason }, "Signaling auth rejected");
          socket.write(
            `HTTP/1.1 401 Unauthorized\r\nContent-Length: ${auth.reason.length}\r\n\r\n${auth.reason}`,
          );
          socket.destroy();
          return;
        }
        wss.handleUpgrade(req, socket, head, (ws) => {
          handleConnection(ws, auth.result);
        });
      })
      .catch((err) => {
        logger.error({ err }, "Signaling upgrade error");
        socket.destroy();
      });
  });
}

// ─── Preview connection handler ───────────────────────────────────────────────

const PREVIEW_TIMEOUT_MS = 35_000;

function handlePreviewConnection(ws: WebSocket, auth: PreviewAuthResult): void {
  const { hostId, role } = auth;
  const room = getPreviewRoom(hostId);
  const peerId = `${role}-prev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // For preview players, enforce a hard 35-second server-side timeout.
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  if (role === "player") {
    timeoutHandle = setTimeout(() => {
      timeoutHandle = null;
      logger.info({ hostId, peerId }, "Preview timeout — closing player WS");
      send(ws, { type: "preview-ended", reason: "timeout" });
      try { ws.close(4001, "preview ended"); } catch { /* noop */ }
    }, PREVIEW_TIMEOUT_MS);
  }

  // Allow multiple players in preview room but only one host.
  // For hosts: replace any existing host peer (reconnect).
  if (role === "host") {
    for (const [id, peer] of room.peers) {
      if (peer.role === "host") {
        try { peer.socket.close(4000, "replaced by new connection"); } catch { /* noop */ }
        room.peers.delete(id);
      }
    }
  }

  room.peers.set(peerId, { socket: ws, role });

  logger.info({ hostId, role, peerId }, "Preview signaling peer connected");

  send(ws, {
    type: "welcome",
    hostId,
    role,
    peerCount: room.peers.size,
  });

  broadcastToOther(room, role, { type: "peer-joined", role, preview: true });

  ws.on("message", (raw) => {
    let msg: unknown;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      send(ws, { type: "error", error: "invalid json" });
      return;
    }

    if (
      typeof msg !== "object" ||
      msg === null ||
      typeof (msg as { type?: unknown }).type !== "string"
    ) {
      send(ws, { type: "error", error: "missing type" });
      return;
    }

    const message = msg as { type: string };

    switch (message.type) {
      case "offer":
      case "answer":
      case "ice-candidate":
        broadcastToOther(room, role, { ...message, fromRole: role });
        break;
      case "ping":
        send(ws, { type: "pong" });
        break;
      default:
        // ignore unknown types silently in preview
    }
  });

  ws.on("close", () => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }
    room.peers.delete(peerId);
    logger.info({ hostId, role, peerId }, "Preview signaling peer disconnected");
    broadcastToOther(room, role, { type: "peer-left", role });
    if (room.peers.size === 0) {
      previewRooms.delete(hostId);
    }
  });

  ws.on("error", (err) => {
    logger.error({ err, hostId, role, peerId }, "Preview signaling socket error");
  });
}

// ─── Regular session connection handler ───────────────────────────────────────

function handleConnection(ws: WebSocket, auth: AuthResult): void {
  const { sessionId, role } = auth;
  const room = getRoom(sessionId);
  void ensureSignalSubscription(sessionId);
  const peerId = `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Replace any existing peer with same role (reconnects).
  for (const [id, peer] of room.peers) {
    if (peer.role === role) {
      try {
        peer.socket.close(4000, "replaced by new connection");
      } catch {
        /* noop */
      }
      room.peers.delete(id);
    }
  }

  room.peers.set(peerId, { socket: ws, role });

  logger.info({ sessionId, role, peerId }, "Signaling peer connected");

  send(ws, {
    type: "welcome",
    sessionId,
    role,
    peerCount: room.peers.size,
  });

  // Notify the other side of presence.
  broadcastToOther(room, role, { type: "peer-joined", role });

  if (role === "player") {
    void markSessionActive(sessionId).catch((err) => {
      logger.error({ err, sessionId }, "Failed to mark session active");
    });
  }

  if (role === "host") {
    db.select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, sessionId))
      .then(async ([session]) => {
        if (session) {
          await markHostSeen(session.hostId);
        }
      })
      .catch((err) => {
        logger.error({ err }, "Failed to update host last_seen_at");
      });
  }

  ws.on("message", (raw) => {
    let msg: unknown;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      send(ws, { type: "error", error: "invalid json" });
      return;
    }

    if (
      typeof msg !== "object" ||
      msg === null ||
      typeof (msg as { type?: unknown }).type !== "string"
    ) {
      send(ws, { type: "error", error: "missing type" });
      return;
    }

    const message = msg as { type: string };

    switch (message.type) {
      case "offer":
      case "answer":
      case "ice-candidate":
      case "input":
      case "control":
        void relaySignal(sessionId, role, { ...message, fromRole: role });
        break;
      case "ping":
        send(ws, { type: "pong" });
        break;
      default:
        send(ws, { type: "error", error: `unknown type: ${message.type}` });
    }
  });

  ws.on("close", () => {
    room.peers.delete(peerId);
    logger.info({ sessionId, role, peerId }, "Signaling peer disconnected");
    broadcastToOther(room, role, { type: "peer-left", role });
    if (room.peers.size === 0) {
      rooms.delete(sessionId);
    }
  });

  ws.on("error", (err) => {
    logger.error({ err, sessionId, role, peerId }, "Signaling socket error");
  });
}
