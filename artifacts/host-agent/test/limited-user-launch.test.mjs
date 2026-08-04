import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { EventEmitter } from "node:events";

/** Captured spawn invocations and failure toggles for win32 mocks. */
let spawnCalls = [];
let spawnShouldFail = false;
let koffiShouldFail = false;

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return {
      app: {
        getAppPath: () => "/tmp/test-limited-user-agent",
        getPath: () => "/tmp/test-limited-user-agent",
      },
    };
  }
  if (request === "node:child_process") {
    return {
      spawn: (...args) => {
        if (spawnShouldFail) throw new Error("spawn failed");
        spawnCalls.push(args);
        const child = new EventEmitter();
        child.pid = 5555;
        return child;
      },
    };
  }
  if (request === "koffi") {
    if (koffiShouldFail) throw new Error("koffi missing");
    return {
      load: (lib) => ({
        func: (sig) => {
          if (sig.includes("CreateProcessWithLogonW")) return () => 1;
          if (lib === "kernel32.dll") return () => 0;
          return () => 0;
        },
      }),
    };
  }
  return load.apply(this, arguments);
};

async function importLimitedUserModule() {
  const url = new URL("../dist/main/main/limited-user-launch.js", import.meta.url);
  url.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return import(url.href);
}

function resetMocks() {
  spawnCalls = [];
  spawnShouldFail = false;
  koffiShouldFail = false;
}

test("non-win32: returns Windows-only error", async () => {
  if (process.platform === "win32") return;
  resetMocks();
  const { launchWithLimitedUser } = await importLimitedUserModule();
  const result = launchWithLimitedUser(
    "C:\\game.exe",
    ["-fullscreen"],
    "C:\\Games",
    { enabled: true, username: "player", password: "secret" },
  );
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /Windows-only/i);
  assert.equal(spawnCalls.length, 0);
});

test("win32 mocked: rejects when credentials not configured", async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetMocks();
  const { launchWithLimitedUser } = await importLimitedUserModule();

  assert.deepEqual(
    launchWithLimitedUser("game.exe", [], "", { enabled: false, username: "u", password: "p" }),
    { ok: false, error: "Limited user credentials not configured" },
  );
  assert.deepEqual(
    launchWithLimitedUser("game.exe", [], "", { enabled: true, username: "", password: "p" }),
    { ok: false, error: "Limited user credentials not configured" },
  );
  assert.deepEqual(
    launchWithLimitedUser("game.exe", [], "", { enabled: true, username: "u", password: "" }),
    { ok: false, error: "Limited user credentials not configured" },
  );
  assert.equal(spawnCalls.length, 0);

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: spawns cmd with app path and args, returns pid", async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetMocks();
  const { launchWithLimitedUser } = await importLimitedUserModule();

  const result = launchWithLimitedUser(
    "C:\\Games\\Foo\\game.exe",
    ["-fullscreen", "with space"],
    "C:\\Games\\Foo",
    {
      enabled: true,
      username: "DecentralHubPlayer",
      password: "secret",
      domain: "WORKGROUP",
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.pid, 5555);
  assert.equal(spawnCalls.length, 1);
  assert.equal(spawnCalls[0][0], "cmd.exe");
  assert.deepEqual(spawnCalls[0][1], [
    "/c",
    "start",
    "",
    "C:\\Games\\Foo\\game.exe",
    "-fullscreen",
    "with space",
  ]);
  assert.equal(spawnCalls[0][2]?.cwd, "C:\\Games\\Foo");
  assert.equal(spawnCalls[0][2]?.env?.DH_LIMITED_USER, "DecentralHubPlayer");
  assert.equal(spawnCalls[0][2]?.env?.DH_LIMITED_DOMAIN, "WORKGROUP");

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: defaults domain to dot when omitted", async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetMocks();
  const { launchWithLimitedUser } = await importLimitedUserModule();

  launchWithLimitedUser("game.exe", [], "C:\\", {
    enabled: true,
    username: "player",
    password: "pwd",
  });

  assert.equal(spawnCalls[0][2]?.env?.DH_LIMITED_DOMAIN, ".");

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: koffi init failure returns error string", async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetMocks();
  koffiShouldFail = true;

  const { createRequire } = await import("node:module");
  const req = createRequire(import.meta.url);
  try {
    const koffiPath = req.resolve("koffi");
    delete req.cache[koffiPath];
  } catch {
    // koffi not loaded yet
  }

  const { launchWithLimitedUser } = await importLimitedUserModule();
  const result = launchWithLimitedUser("game.exe", [], "", {
    enabled: true,
    username: "u",
    password: "p",
  });

  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /koffi missing/);
  assert.equal(spawnCalls.length, 0);

  koffiShouldFail = false;
  try {
    const koffiPath = req.resolve("koffi");
    delete req.cache[koffiPath];
  } catch {
    // ignore
  }
  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: spawn failure returns error string", async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetMocks();
  spawnShouldFail = true;

  const { launchWithLimitedUser } = await importLimitedUserModule();
  const result = launchWithLimitedUser("game.exe", [], "", {
    enabled: true,
    username: "u",
    password: "p",
  });

  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /spawn failed/);

  spawnShouldFail = false;
  Object.defineProperty(process, "platform", { value: origPlatform });
});
