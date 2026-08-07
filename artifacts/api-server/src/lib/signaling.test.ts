import { createServer, type Server } from "node:http";
import { describe, expect, it, vi, beforeEach } from "vitest";
import WebSocket from "ws";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

const SESSION_ID = "sess-signaling-1";
const PLAYER_TOKEN = "player-tok-signaling";

const sessionRow = {
  id: SESSION_ID,
  status: "waiting",
  playerToken: PLAYER_TOKEN,
  devKeyId: "dev-embed-1",
};

const { mockWhere, mockFrom, mockSelect, mockUpdateWhere, mockUpdateSet, mockUpdate } =
  vi.hoisted(() => {
    const mockWhere = vi.fn(async () => [sessionRow]);
    const mockFrom = vi.fn(() => ({ where: mockWhere }));
    const mockSelect = vi.fn(() => ({ from: mockFrom }));
    const mockUpdateWhere = vi.fn(async () => []);
    const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
    const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));
    return { mockWhere, mockFrom, mockSelect, mockUpdateWhere, mockUpdateSet, mockUpdate };
  });

vi.mock("@workspace/db", () => ({
  db: { select: mockSelect, update: mockUpdate },
  hostsTable: {},
  sessionsTable: {},
  playersTable: {},
}));

vi.mock("./redis", () => ({
  getRedis: () => null,
  getRedisSubscriber: () => null,
  isRedisAvailable: () => false,
}));

vi.mock("./logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("failed to bind server"));
        return;
      }
      resolve(addr.port);
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

function waitForMessage(ws: WebSocket, predicate: (msg: unknown) => boolean): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout waiting for message")), 5_000);
    const onMessage = (raw: WebSocket.RawData) => {
      let msg: unknown;
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
    };
    ws.on("message", onMessage);
  });
}

function connectPlayer(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout connecting player")), 5_000);
    const ws = new WebSocket(
      `ws://127.0.0.1:${port}/api/signal?role=player&playerToken=${PLAYER_TOKEN}`,
    );
    ws.once("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    function onWelcome(raw: WebSocket.RawData) {
      let msg: unknown;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if ((msg as { type?: string }).type === "welcome") {
        clearTimeout(timer);
        ws.off("message", onWelcome);
        resolve(ws);
      }
    }
    ws.on("message", onWelcome);
  });
}

async function withSignaling<T>(
  fn: (
    mod: typeof import("./signaling"),
    server: Server,
    port: number,
  ) => Promise<T>,
): Promise<T> {
  vi.resetModules();
  const mod = await import("./signaling");
  const server = createServer();
  mod.attachSignaling(server);
  const port = await listen(server);
  try {
    return await fn(mod, server, port);
  } finally {
    mod.closeSignaling(server);
    await closeServer(server);
  }
}

describe("signaling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWhere.mockResolvedValue([sessionRow]);
  });

  it("mints preview tokens with prefix", async () => {
    vi.resetModules();
    const { mintPreviewToken } = await import("./signaling");
    const token = mintPreviewToken("host-1");
    expect(token.startsWith("prev_")).toBe(true);
    expect(token.length).toBeGreaterThan(10);
  });

  it("attachSignaling registers and closeSignaling removes the upgrade handler", async () => {
    vi.resetModules();
    const { attachSignaling, closeSignaling } = await import("./signaling");
    const server = createServer();
    const before = server.listenerCount("upgrade");
    attachSignaling(server);
    expect(server.listenerCount("upgrade")).toBe(before + 1);
    closeSignaling(server);
    expect(server.listenerCount("upgrade")).toBe(before);
    await closeServer(server);
  });

  it("closeSignaling closes connected signaling clients", async () => {
    await withSignaling(async (mod, server, port) => {
      const ws = await connectPlayer(port);

      const closed = new Promise<number>((resolve) => {
        ws.once("close", (code) => resolve(code));
      });
      mod.closeSignaling(server);
      expect(await closed).toBe(1001);
    });
  });

  it("sendSignalingMessage delivers payload to player peers", async () => {
    await withSignaling(async (mod, _server, port) => {
      const ws = await connectPlayer(port);

      const payload = { type: "block-warning", minsLeft: 2 };
      const received = waitForMessage(
        ws,
        (m) => (m as { type?: string }).type === "block-warning",
      );
      mod.sendSignalingMessage(SESSION_ID, payload);
      expect(await received).toEqual(payload);
    });
  });

  it("sendSignalingMessage no-ops when the session room is missing", async () => {
    vi.resetModules();
    const { sendSignalingMessage } = await import("./signaling");
    expect(() =>
      sendSignalingMessage("missing-session", { type: "block-expired" }),
    ).not.toThrow();
  });

  it("endSessionSignaling notifies player and closes the room", async () => {
    await withSignaling(async (mod, _server, port) => {
      const ws = await connectPlayer(port);

      const received = waitForMessage(
        ws,
        (m) =>
          (m as { type?: string; action?: string }).type === "control" &&
          (m as { action?: string }).action === "reject",
      );
      const closed = new Promise<number>((resolve) => {
        ws.once("close", (code) => resolve(code));
      });

      mod.endSessionSignaling(SESSION_ID, "balance_exhausted");
      expect(await received).toEqual({
        type: "control",
        action: "reject",
        reason: "balance_exhausted",
      });
      expect(await closed).toBe(4001);
    });
  });
});
