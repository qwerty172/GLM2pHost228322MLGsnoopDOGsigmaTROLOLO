import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { EventEmitter } from "node:events";

/** Captured spawn calls for assertions. */
let spawnMock = {
  calls: [],
  failNext: false,
};

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
        if (spawnMock.failNext) throw new Error("spawn failed");
        spawnMock.calls.push(args);
        const child = new EventEmitter();
        child.pid = 5151;
        return child;
      },
    };
  }
  if (request === "koffi") {
    return {
      load: (lib) => ({
        func: (sig) => {
          if (sig.includes("CreateProcessWithLogonW")) return () => 1;
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

function resetSpawnMock() {
  spawnMock = { calls: [], failNext: false };
}

const validCreds = {
  enabled: true,
  username: "DecentralHubPlayer",
  password: "secret",
};

test("non-win32: returns Windows-only error", { concurrency: false }, async () => {
  if (process.platform === "win32") return;
  const { launchWithLimitedUser } = await importLimitedUserModule();
  const result = launchWithLimitedUser("C:\\game.exe", ["-log"], "C:\\Games", validCreds);
  assert.deepEqual(result, { ok: false, error: "Limited user launch is Windows-only" });
});

test("rejects disabled or incomplete credentials", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetSpawnMock();

  const { launchWithLimitedUser } = await importLimitedUserModule();

  assert.deepEqual(
    launchWithLimitedUser("C:\\game.exe", [], "C:\\Games", {
      enabled: false,
      username: "u",
      password: "p",
    }),
    { ok: false, error: "Limited user credentials not configured" },
  );
  assert.deepEqual(
    launchWithLimitedUser("C:\\game.exe", [], "C:\\Games", {
      enabled: true,
      username: "",
      password: "p",
    }),
    { ok: false, error: "Limited user credentials not configured" },
  );
  assert.deepEqual(
    launchWithLimitedUser("C:\\game.exe", [], "C:\\Games", {
      enabled: true,
      username: "u",
      password: "",
    }),
    { ok: false, error: "Limited user credentials not configured" },
  );
  assert.equal(spawnMock.calls.length, 0);

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: spawns cmd with app path, args and limited-user env", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetSpawnMock();

  const { launchWithLimitedUser } = await importLimitedUserModule();
  const result = launchWithLimitedUser(
    "C:\\Games\\Foo\\game.exe",
    ["-fullscreen", "extra arg"],
    "C:\\Games\\Foo",
    { ...validCreds, domain: "WORKGROUP" },
  );

  assert.deepEqual(result, { ok: true, pid: 5151 });
  assert.equal(spawnMock.calls.length, 1);
  const [cmd, args, opts] = spawnMock.calls[0];
  assert.equal(cmd, "cmd.exe");
  assert.deepEqual(args, ["/c", "start", "", "C:\\Games\\Foo\\game.exe", "-fullscreen", "extra arg"]);
  assert.equal(opts.cwd, "C:\\Games\\Foo");
  assert.equal(opts.env.DH_LIMITED_USER, "DecentralHubPlayer");
  assert.equal(opts.env.DH_LIMITED_DOMAIN, "WORKGROUP");

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: defaults domain to dot when omitted", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetSpawnMock();

  const { launchWithLimitedUser } = await importLimitedUserModule();
  launchWithLimitedUser("C:\\game.exe", [], "C:\\Games", validCreds);

  assert.equal(spawnMock.calls[0][2].env.DH_LIMITED_DOMAIN, ".");

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: spawn failure returns error string", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetSpawnMock();
  spawnMock.failNext = true;

  const { launchWithLimitedUser } = await importLimitedUserModule();
  const result = launchWithLimitedUser("C:\\game.exe", [], "C:\\Games", validCreds);

  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /spawn failed/);

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: koffi load failure returns error string", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });

  const origLoad = Module._load;
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
        spawn: () => {
          const child = new EventEmitter();
          child.pid = 1;
          return child;
        },
      };
    }
    if (request === "koffi") {
      throw new Error("koffi missing");
    }
    return origLoad.apply(this, arguments);
  };

  const { launchWithLimitedUser } = await importLimitedUserModule();
  const result = launchWithLimitedUser("C:\\game.exe", [], "C:\\Games", validCreds);

  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /koffi missing/);

  Module._load = origLoad;
  Object.defineProperty(process, "platform", { value: origPlatform });
});
