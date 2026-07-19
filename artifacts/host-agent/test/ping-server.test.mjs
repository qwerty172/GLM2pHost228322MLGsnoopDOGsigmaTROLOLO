// Unit tests for the agent's local HTTP server (ping-server).
// Runs against the compiled output: `pnpm run build:main` first, then
// `node --test test/`.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";

const { createPingServer, parseInputEvent } = await import(
  "../dist/main/main/ping-server.js"
);

// ─── parseInputEvent validation ──────────────────────────────────────────────

test("parseInputEvent accepts valid mousemove", () => {
  const ev = parseInputEvent({ kind: "mousemove", x: 0.5, y: 0.25 });
  assert.ok(ev);
  assert.equal(ev.kind, "mousemove");
});

test("parseInputEvent rejects mousemove with non-numeric coords", () => {
  assert.equal(parseInputEvent({ kind: "mousemove", x: "a", y: 1 }), null);
  assert.equal(parseInputEvent({ kind: "mousemove", x: NaN, y: 1 }), null);
});

test("parseInputEvent accepts valid mousedown/mouseup buttons", () => {
  assert.ok(parseInputEvent({ kind: "mousedown", button: "left" }));
  assert.ok(parseInputEvent({ kind: "mouseup", button: "right" }));
  assert.equal(parseInputEvent({ kind: "mousedown", button: "back" }), null);
});

test("parseInputEvent validates wheel and key events", () => {
  assert.ok(parseInputEvent({ kind: "wheel", deltaY: -120 }));
  assert.equal(parseInputEvent({ kind: "wheel", deltaY: "x" }), null);
  assert.ok(parseInputEvent({ kind: "keydown", code: "KeyW", key: "w" }));
  assert.equal(parseInputEvent({ kind: "keyup", code: 5, key: "w" }), null);
});

test("parseInputEvent rejects unknown kinds and non-objects", () => {
  assert.equal(parseInputEvent({ kind: "gamepad" }), null);
  assert.equal(parseInputEvent(null), null);
  assert.equal(parseInputEvent("mousemove"), null);
});

// ─── HTTP server behaviour ───────────────────────────────────────────────────

let server;
let baseUrl;
let injected;

before(async () => {
  injected = [];
  server = createPingServer({
    getInfo: async () => ({ version: "test-1", audioMode: "off" }),
    injectInput: (ev) => injected.push(ev),
    log: () => {},
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

test("GET /ping returns status + version with CORS header", async () => {
  const res = await fetch(`${baseUrl}/ping`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
  const body = await res.json();
  assert.equal(body.status, "ok");
  assert.equal(body.version, "test-1");
});

test("OPTIONS preflight returns 204 with CORS methods", async () => {
  const res = await fetch(`${baseUrl}/input`, { method: "OPTIONS" });
  assert.equal(res.status, 204);
  assert.match(
    res.headers.get("access-control-allow-methods") ?? "",
    /POST/,
  );
});

test("POST /input with valid event injects and returns 204", async () => {
  const res = await fetch(`${baseUrl}/input`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "keydown", code: "KeyW", key: "w" }),
  });
  assert.equal(res.status, 204);
  assert.equal(injected.length, 1);
  assert.equal(injected[0].kind, "keydown");
});

test("POST /input with invalid JSON returns 400", async () => {
  const res = await fetch(`${baseUrl}/input`, {
    method: "POST",
    body: "not-json{",
  });
  assert.equal(res.status, 400);
});

test("POST /input with unknown kind returns 400 and injects nothing", async () => {
  const count = injected.length;
  const res = await fetch(`${baseUrl}/input`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "explode" }),
  });
  assert.equal(res.status, 400);
  assert.equal(injected.length, count);
});
