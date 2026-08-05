import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  AGENT_INPUT_SECRET,
  AGENT_PING_PORTS,
  discoverAgentPort,
  getCachedAgentPort,
  postAgentInput,
} from "../src/lib/agent-local.ts";

type FetchHandler = (url: string, init?: RequestInit) => Response | Promise<Response>;

let fetchHandler: FetchHandler | null = null;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  fetchHandler = null;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!fetchHandler) throw new Error(`unexpected fetch: ${url}`);
    return fetchHandler(url, init);
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  fetchHandler = null;
});

function jsonResponse(body: unknown, ok = true): Response {
  return new Response(JSON.stringify(body), {
    status: ok ? 200 : 503,
    headers: { "Content-Type": "application/json" },
  });
}

test("AGENT_PING_PORTS and AGENT_INPUT_SECRET are stable", () => {
  assert.deepEqual(AGENT_PING_PORTS, [18080, 18081, 18082, 18083]);
  assert.equal(AGENT_INPUT_SECRET, "dh-local-input-v1");
});

test("discoverAgentPort returns first responding port", async () => {
  fetchHandler = (url) => {
    if (url === "http://127.0.0.1:18080/ping") return jsonResponse({ version: "1.0", audioMode: "loopback" });
    return jsonResponse(null, false);
  };

  const info = await discoverAgentPort({ force: true });
  assert.deepEqual(info, { port: 18080, version: "1.0", audioMode: "loopback" });
  assert.equal(getCachedAgentPort(), 18080);
});

test("discoverAgentPort scans fallback ports when primary is down", async () => {
  fetchHandler = (url) => {
    if (url === "http://127.0.0.1:18081/ping") {
      return jsonResponse({ port: 18081, version: "2.0", audioMode: "off" });
    }
    return Promise.reject(new Error("ECONNREFUSED"));
  };

  const info = await discoverAgentPort({ force: true });
  assert.deepEqual(info, { port: 18081, version: "2.0", audioMode: "off" });
});

test("discoverAgentPort uses cache until revalidation fails", async () => {
  let pingCalls = 0;
  fetchHandler = (url) => {
    if (!url.endsWith("/ping")) throw new Error(url);
    pingCalls += 1;
    return jsonResponse({ version: "1.0", audioMode: "off" });
  };

  const first = await discoverAgentPort({ force: true });
  const second = await discoverAgentPort();
  assert.equal(first?.port, 18080);
  assert.equal(second?.port, 18080);
  assert.equal(pingCalls, 2);
});

test("discoverAgentPort returns null when all ports fail", async () => {
  fetchHandler = () => Promise.reject(new Error("offline"));
  const info = await discoverAgentPort({ force: true });
  assert.equal(info, null);
});

test("postAgentInput throws agent_offline when discovery fails", async () => {
  fetchHandler = () => Promise.reject(new Error("offline"));
  await assert.rejects(() => postAgentInput({ type: "input", kind: "key" }), /agent_offline/);
});

test("postAgentInput posts JSON to discovered /input with secret header", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  fetchHandler = (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/ping")) return jsonResponse({ version: "1.0", audioMode: "off" });
    if (url.endsWith("/input")) return new Response("", { status: 200 });
    return jsonResponse(null, false);
  };

  const event = { type: "input", kind: "mouse", action: "move", x: 0.5, y: 0.5 };
  const res = await postAgentInput(event);
  assert.equal(res.status, 200);

  const inputCall = calls.find((c) => c.url.endsWith("/input"));
  assert.ok(inputCall);
  assert.equal(inputCall.init?.method, "POST");
  const headers = inputCall.init?.headers as Record<string, string>;
  assert.equal(headers["Content-Type"], "application/json");
  assert.equal(headers["X-Agent-Input-Secret"], AGENT_INPUT_SECRET);
  assert.equal(inputCall.init?.body, JSON.stringify(event));
});
