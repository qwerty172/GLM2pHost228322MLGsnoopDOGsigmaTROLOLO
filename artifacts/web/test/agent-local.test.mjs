import { test, mock, afterEach } from "node:test";
import assert from "node:assert/strict";

const {
  AGENT_PING_PORTS,
  AGENT_INPUT_SECRET,
  discoverAgentPort,
  getCachedAgentPort,
  postAgentInput,
} = await import("../src/lib/agent-local.ts");

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

afterEach(() => {
  mock.restoreAll();
});

test("AGENT_PING_PORTS and AGENT_INPUT_SECRET are stable", () => {
  assert.deepEqual(AGENT_PING_PORTS, [18080, 18081, 18082, 18083]);
  assert.equal(AGENT_INPUT_SECRET, "dh-local-input-v1");
});

test("discoverAgentPort returns first responding port", async () => {
  mock.method(globalThis, "fetch", async (url) => {
    const port = Number(String(url).match(/:(\d+)\/ping$/)?.[1]);
    if (port === 18081) {
      return jsonResponse({ version: "1.2.3", audioMode: "loopback", port: 18081 });
    }
    return jsonResponse({}, 404);
  });

  const info = await discoverAgentPort({ force: true, timeoutMs: 50 });
  assert.deepEqual(info, { port: 18081, version: "1.2.3", audioMode: "loopback" });
  assert.equal(getCachedAgentPort(), 18081);
});

test("discoverAgentPort returns null when all ports fail", async () => {
  mock.method(globalThis, "fetch", async () => {
    throw new Error("ECONNREFUSED");
  });

  const info = await discoverAgentPort({ force: true, timeoutMs: 50 });
  assert.equal(info, null);
  assert.equal(getCachedAgentPort(), null);
});

test("discoverAgentPort reuses cached port without probing others", async () => {
  let calls = 0;
  mock.method(globalThis, "fetch", async (url) => {
    calls += 1;
    const port = Number(String(url).match(/:(\d+)\/ping$/)?.[1]);
    if (port === 18080) {
      return jsonResponse({ version: "9.9.9", audioMode: "off" });
    }
    return jsonResponse({}, 404);
  });

  const first = await discoverAgentPort({ force: true, timeoutMs: 50 });
  const second = await discoverAgentPort({ timeoutMs: 50 });

  assert.equal(first?.port, 18080);
  assert.deepEqual(second, first);
  assert.equal(calls, 2);
});

test("postAgentInput throws agent_offline when discovery fails", async () => {
  mock.method(globalThis, "fetch", async () => {
    throw new Error("offline");
  });

  await assert.rejects(() => postAgentInput({ type: "input", kind: "key" }), /agent_offline/);
});

test("postAgentInput posts JSON to discovered /input with secret header", async () => {
  const requests = [];
  mock.method(globalThis, "fetch", async (url, init) => {
    requests.push({ url: String(url), init });
    if (String(url).endsWith("/ping")) {
      return jsonResponse({ version: "2.0.0", audioMode: "mic", port: 18082 });
    }
    return jsonResponse({ ok: true });
  });

  const event = { type: "input", kind: "mouse", action: "move", x: 0.5, y: 0.5 };
  const res = await postAgentInput(event);

  assert.equal(res.ok, true);
  const inputReq = requests.find((r) => r.url.endsWith("/input"));
  assert.ok(inputReq);
  assert.equal(inputReq.init.method, "POST");
  assert.equal(inputReq.init.headers["Content-Type"], "application/json");
  assert.equal(inputReq.init.headers["X-Agent-Input-Secret"], AGENT_INPUT_SECRET);
  assert.equal(inputReq.init.body, JSON.stringify(event));
  assert.match(inputReq.url, /127\.0\.0\.1:18082\/input$/);
});
