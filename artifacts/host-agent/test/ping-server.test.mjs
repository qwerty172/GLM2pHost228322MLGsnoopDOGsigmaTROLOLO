// Unit tests for the agent's local HTTP server (ping-server).
// Runs against the compiled output: `pnpm run build:main` first, then
// `node --test test/`.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";

const {
  createPingServer,
  parseInputEvent,
  LOCAL_INPUT_SECRET,
  INPUT_SECRET_HEADER,
} = await import("../dist/main/main/ping-server.js");

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
    getInputSecret: () => LOCAL_INPUT_SECRET,
    getAllowedOrigins: () => ["http://localhost:5173"],
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

test("GET /ping returns status + version with CORS for allowed origin", async () => {
  const res = await fetch(`${baseUrl}/ping`, {
    headers: { Origin: "http://localhost:5173" },
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("access-control-allow-origin"), "http://localhost:5173");
  const body = await res.json();
  assert.equal(body.status, "ok");
  assert.equal(body.version, "test-1");
});

test("GET /ping rejects disallowed origin", async () => {
  const res = await fetch(`${baseUrl}/ping`, {
    headers: { Origin: "https://evil.example" },
  });
  assert.equal(res.status, 403);
});

test("OPTIONS preflight returns 204 with CORS methods", async () => {
  const res = await fetch(`${baseUrl}/input`, {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:5173" },
  });
  assert.equal(res.status, 204);
  assert.match(
    res.headers.get("access-control-allow-methods") ?? "",
    /POST/,
  );
});

test("POST /input without secret returns 401", async () => {
  const res = await fetch(`${baseUrl}/input`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:5173",
    },
    body: JSON.stringify({ kind: "keydown", code: "KeyW", key: "w" }),
  });
  assert.equal(res.status, 401);
});

test("POST /input with valid event injects and returns 204", async () => {
  const res = await fetch(`${baseUrl}/input`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:5173",
      [INPUT_SECRET_HEADER]: LOCAL_INPUT_SECRET,
    },
    body: JSON.stringify({ kind: "keydown", code: "KeyW", key: "w" }),
  });
  assert.equal(res.status, 204);
  assert.equal(injected.length, 1);
  assert.equal(injected[0].kind, "keydown");
});

test("POST /input with invalid JSON returns 400", async () => {
  const res = await fetch(`${baseUrl}/input`, {
    method: "POST",
    headers: {
      Origin: "http://localhost:5173",
      [INPUT_SECRET_HEADER]: LOCAL_INPUT_SECRET,
    },
    body: "not-json{",
  });
  assert.equal(res.status, 400);
});

test("POST /input with unknown kind returns 400 and injects nothing", async () => {
  const count = injected.length;
  const res = await fetch(`${baseUrl}/input`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:5173",
      [INPUT_SECRET_HEADER]: LOCAL_INPUT_SECRET,
    },
    body: JSON.stringify({ kind: "explode" }),
  });
  assert.equal(res.status, 400);
  assert.equal(injected.length, count);
});

test("GET /readiness returns inputOk after probe injection (U-14)", async () => {
  const countBefore = injected.length;
  const res = await fetch(`${baseUrl}/readiness`, {
    headers: { Origin: "http://localhost:5173" },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, "ok");
  assert.equal(body.inputOk, true);
  assert.equal(injected.length, countBefore + 1);
  assert.equal(injected[injected.length - 1].kind, "mousemove");
});

test("POST /pick-exe returns picked path when authorized", async () => {
  const pickServer = createPingServer({
    getInfo: async () => ({ version: "test-1", audioMode: "off" }),
    injectInput: () => {},
    log: () => {},
    getInputSecret: () => LOCAL_INPUT_SECRET,
    getAllowedOrigins: () => ["http://localhost:5173"],
    pickExe: async () => "C:\\Games\\game.exe",
  });
  await new Promise((resolve) => pickServer.listen(0, "127.0.0.1", resolve));
  const pickUrl = `http://127.0.0.1:${pickServer.address().port}`;
  try {
    const res = await fetch(`${pickUrl}/pick-exe`, {
      method: "POST",
      headers: {
        Origin: "http://localhost:5173",
        [INPUT_SECRET_HEADER]: LOCAL_INPUT_SECRET,
      },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.path, "C:\\Games\\game.exe");
  } finally {
    pickServer.close();
  }
});

test("POST /pick-exe without secret returns 401", async () => {
  const pickServer = createPingServer({
    getInfo: async () => ({ version: "test-1", audioMode: "off" }),
    injectInput: () => {},
    log: () => {},
    getInputSecret: () => LOCAL_INPUT_SECRET,
    getAllowedOrigins: () => ["http://localhost:5173"],
    pickExe: async () => "C:\\Games\\game.exe",
  });
  await new Promise((resolve) => pickServer.listen(0, "127.0.0.1", resolve));
  const pickUrl = `http://127.0.0.1:${pickServer.address().port}`;
  try {
    const res = await fetch(`${pickUrl}/pick-exe`, {
      method: "POST",
      headers: { Origin: "http://localhost:5173" },
    });
    assert.equal(res.status, 401);
  } finally {
    pickServer.close();
  }
});

test("GET /steam-games returns game list", async () => {
  const steamServer = createPingServer({
    getInfo: async () => ({ version: "test-1", audioMode: "off" }),
    injectInput: () => {},
    log: () => {},
    getAllowedOrigins: () => ["http://localhost:5173"],
    getSteamGames: async () => [
      { appId: "730", name: "CS2", bestExePath: "C:\\Steam\\cs2.exe" },
    ],
  });
  await new Promise((resolve) => steamServer.listen(0, "127.0.0.1", resolve));
  const steamUrl = `http://127.0.0.1:${steamServer.address().port}`;
  try {
    const res = await fetch(`${steamUrl}/steam-games`, {
      headers: { Origin: "http://localhost:5173" },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.games.length, 1);
    assert.equal(body.games[0].appId, "730");
  } finally {
    steamServer.close();
  }
});
