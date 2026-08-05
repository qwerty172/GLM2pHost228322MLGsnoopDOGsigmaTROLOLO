import { describe, expect, it, vi, beforeEach } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

const mockPoolQuery = vi.fn(async () => ({}));
const notificationHandlers: Record<string, Array<(...args: unknown[]) => void>> = {};
const mockClient = {
  query: vi.fn(async () => ({})),
  release: vi.fn(),
  on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
    notificationHandlers[event] ??= [];
    notificationHandlers[event].push(listener);
  }),
};

const mockConnect = vi.fn(async () => mockClient);

vi.mock("@workspace/db", () => ({
  pool: {
    connect: mockConnect,
    query: mockPoolQuery,
  },
}));

async function loadPgNotify() {
  vi.resetModules();
  return import("./pgNotify");
}

describe("pgNotify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(notificationHandlers)) delete notificationHandlers[key];
    process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:5432/test";
  });

  it("exposes channel and in-memory subscription", async () => {
    const { NOTIFY_CHANNEL, subscribePlatformEvents } = await loadPgNotify();
    expect(NOTIFY_CHANNEL).toBe("decentralhub_events");
    const events: unknown[] = [];
    const unsub = subscribePlatformEvents((e) => events.push(e));
    expect(typeof unsub).toBe("function");
    unsub();
  });

  describe("startPgNotifyListener", () => {
    it("connects, LISTENs on the channel, and forwards NOTIFY payloads to subscribers", async () => {
      const {
        startPgNotifyListener,
        stopPgNotifyListener,
        subscribePlatformEvents,
        NOTIFY_CHANNEL,
      } = await loadPgNotify();
      const events: unknown[] = [];
      subscribePlatformEvents((e) => events.push(e));

      await startPgNotifyListener();

      expect(mockConnect).toHaveBeenCalledOnce();
      expect(mockClient.query).toHaveBeenCalledWith(`LISTEN ${NOTIFY_CHANNEL}`);

      const payload = JSON.stringify({
        type: "host_last_seen",
        payload: { hostId: "h1" },
        at: "2026-08-05T00:00:00.000Z",
      });
      notificationHandlers.notification?.[0]?.({ payload });

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: "host_last_seen",
        payload: { hostId: "h1" },
        at: "2026-08-05T00:00:00.000Z",
      });
      await stopPgNotifyListener();
    });

    it("skips when DATABASE_URL is unset", async () => {
      delete process.env.DATABASE_URL;
      const { startPgNotifyListener } = await loadPgNotify();
      await startPgNotifyListener();
      expect(mockConnect).not.toHaveBeenCalled();
    });

    it("is idempotent while a listen client is active", async () => {
      const { startPgNotifyListener, stopPgNotifyListener } = await loadPgNotify();
      await startPgNotifyListener();
      await startPgNotifyListener();
      expect(mockConnect).toHaveBeenCalledOnce();
      await stopPgNotifyListener();
    });
  });

  describe("emitPlatformEvent", () => {
    it("pg_notifys and fans out to local subscribers", async () => {
      const { emitPlatformEvent, subscribePlatformEvents, NOTIFY_CHANNEL } =
        await loadPgNotify();
      const events: unknown[] = [];
      subscribePlatformEvents((e) => events.push(e));

      await emitPlatformEvent("session_started", { sessionId: "s1" });

      expect(mockPoolQuery).toHaveBeenCalledWith(`SELECT pg_notify($1, $2)`, [
        NOTIFY_CHANNEL,
        expect.stringContaining('"type":"session_started"'),
      ]);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: "session_started",
        payload: { sessionId: "s1" },
      });
      expect((events[0] as { at: string }).at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("still fans out locally when pg_notify fails", async () => {
      mockPoolQuery.mockRejectedValueOnce(new Error("db down"));
      const { emitPlatformEvent, subscribePlatformEvents } = await loadPgNotify();
      const events: unknown[] = [];
      subscribePlatformEvents((e) => events.push(e));

      await emitPlatformEvent("fallback", { ok: true });

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ type: "fallback", payload: { ok: true } });
    });
  });

  describe("stopPgNotifyListener", () => {
    it("UNLISTENs and releases the listen client", async () => {
      const { startPgNotifyListener, stopPgNotifyListener, NOTIFY_CHANNEL } =
        await loadPgNotify();
      await startPgNotifyListener();
      await stopPgNotifyListener();

      expect(mockClient.query).toHaveBeenCalledWith(`UNLISTEN ${NOTIFY_CHANNEL}`);
      expect(mockClient.release).toHaveBeenCalledOnce();
    });

    it("is a no-op when listener was never started", async () => {
      const { stopPgNotifyListener } = await loadPgNotify();
      await stopPgNotifyListener();
      expect(mockClient.release).not.toHaveBeenCalled();
    });
  });
});
