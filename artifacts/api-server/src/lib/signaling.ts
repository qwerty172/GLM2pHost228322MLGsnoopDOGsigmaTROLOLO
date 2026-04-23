import type { Server as HttpServer, IncomingMessage } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { eq } from "drizzle-orm";
import { db, hostsTable, sessionsTable } from "@workspace/db";
import { logger } from "./logger";

type Role = "host" | "player";

interface RoomPeer {
  socket: WebSocket;
  role: Role;
}

interface Room {
  peers: Map<string, RoomPeer>;
}

const rooms = new Map<string, Room>();

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
  return { ok: true, result: { sessionId: session.id, role } };
}

async function markSessionActive(sessionId: string): Promise<void> {
  await db
    .update(sessionsTable)
    .set({ status: "active", startedAt: new Date() })
    .where(eq(sessionsTable.id, sessionId));
}

async function markHostSeen(hostId: string): Promise<void> {
  await db
    .update(hostsTable)
    .set({ lastSeenAt: new Date() })
    .where(eq(hostsTable.id, hostId));
}

export function attachSignaling(server: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req: IncomingMessage, socket, head): void => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname !== "/api/signal") {
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

function handleConnection(ws: WebSocket, auth: AuthResult): void {
  const { sessionId, role } = auth;
  const room = getRoom(sessionId);
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
        broadcastToOther(room, role, { ...message, fromRole: role });
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
