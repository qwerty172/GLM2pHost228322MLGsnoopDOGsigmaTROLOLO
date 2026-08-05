import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";
process.env.RATE_LIMIT_STORAGE = "memory";

type PlatformEvent = {
  type: string;
  payload: Record<string, unknown>;
  at: string;
};

let subscribedListener: ((event: PlatformEvent) => void) | null = null;
const mockUnsubscribe = vi.fn();

vi.mock("../lib/pgNotify", () => ({
  subscribePlatformEvents: vi.fn((fn: (event: PlatformEvent) => void) => {
    subscribedListener = fn;
    return mockUnsubscribe;
  }),
}));

const { default: eventsRouter } = await import("./events");
const { subscribePlatformEvents } = await import("../lib/pgNotify");

let baseUrl = "";
let server: Server;

function parseSseEvents(text: string): PlatformEvent[] {
  const events: PlatformEvent[] = [];
  for (const block of text.split("\n\n")) {
    const line = block.trim();
    if (line.startsWith("data: ")) {
      events.push(JSON.parse(line.slice(6)) as PlatformEvent);
    }
  }
  return events;
}

async function openStream() {
  const controller = new AbortController();
  const res = await fetch(`${baseUrl}/events/stream`, {
    signal: controller.signal,
  });
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let text = "";

  const readUntil = async (predicate: (chunk: string) => boolean) => {
    while (!predicate(text)) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value);
    }
  };

  return {
    res,
    controller,
    reader,
    getText: () => text,
    readUntil,
    close: async () => {
      controller.abort();
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
    },
  };
}

beforeAll(async () => {
  const app = express();
  app.use(eventsRouter);
  await new Promise<void>((resolve) => {
    server = createServer(app).listen(0, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

beforeEach(() => {
  subscribedListener = null;
  vi.clearAllMocks();
});

describe("GET /events/stream", () => {
  it("sets SSE headers and sends connected event", async () => {
    const stream = await openStream();

    expect(stream.res.status).toBe(200);
    expect(stream.res.headers.get("content-type")).toBe("text/event-stream");
    expect(stream.res.headers.get("cache-control")).toBe("no-cache");
    expect(stream.res.headers.get("connection")).toBe("keep-alive");
    expect(subscribePlatformEvents).toHaveBeenCalledOnce();

    await stream.readUntil((chunk) => chunk.includes("connected"));
    const events = parseSseEvents(stream.getText());
    expect(events[0]).toMatchObject({ type: "connected", payload: {} });
    expect(events[0]?.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    await stream.close();
  });

  it("forwards platform events to the client", async () => {
    const stream = await openStream();
    await stream.readUntil((chunk) => chunk.includes("connected"));

    expect(subscribedListener).not.toBeNull();
    subscribedListener!({
      type: "session.updated",
      payload: { sessionId: "s-1" },
      at: "2026-01-01T00:00:00.000Z",
    });

    await stream.readUntil((chunk) => chunk.includes("session.updated"));
    const events = parseSseEvents(stream.getText());
    expect(events).toContainEqual({
      type: "session.updated",
      payload: { sessionId: "s-1" },
      at: "2026-01-01T00:00:00.000Z",
    });

    await stream.close();
  });

  it("unsubscribes when the client disconnects", async () => {
    const stream = await openStream();
    await stream.readUntil((chunk) => chunk.includes("connected"));

    await stream.close();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});
