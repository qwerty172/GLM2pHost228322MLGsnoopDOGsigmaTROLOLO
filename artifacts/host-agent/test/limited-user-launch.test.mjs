import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { EventEmitter } from "node:events";

/** Mutable spawn mock state for win32 tests. */
let spawnMock = {
  calls: [],
  pid: 5555,
};

let koffiMock = {
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
        spawnMock.calls.push(args);
        const child = new EventEmitter();
        child.pid = spawnMock.pid;
        return child;
      },
    };
  }
  if (request === "koffi") {
    if (koffiMock.failNext) {
      throw new Error("koffi unavailable");
    }
    return {
      load: (lib) => ({
        func: (sig) => {
          if (sig.includes("CreateProcessWithLogonW")) {
            return () => 1;
          }
          void lib;
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
  spawnMock = { calls: [], pid: 5555 };
}

function resetKoffiMock() {
  koffiMock = { failNext: false };
}

test("non-win32 returns Windows-only error", async () => {
  if (process.platform === "win32") return;
  const { launchWithLimitedUser } = await importLimitedUserModule();
  const result = launchWithLimitedUser("C:\\game.exe", ["-log"], "C:\\Games", {
    enabled: true,
    username: "player",
    password: "secret",
  });
  assert.deepEqual(result, { ok: false, error: "Limited user launch is Windows-only" });
});

test("win32 mocked: missing credentials return not configured", async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetSpawnMock();

  const { launchWithLimitedUser } = await importLimitedUserModule();

  const disabled = launchWithLimitedUser("C:\\game.exe", [], "C:\\", {
    enabled: false,
    username: "u",
    password: "p",
  });
  assert.equal(disabled.ok, false);
  assert.match(disabled.error ?? "", /not configured/i);

  const noUser = launchWithLimitedUser("C:\\game.exe", [], "C:\\", {
    enabled: true,
    username: "",
    password: "p",
  });
  assert.equal(noUser.ok, false);
  assert.match(noUser.error ?? "", /not configured/i);

  const noPass = launchWithLimitedUser("C:\\game.exe", [], "C:\\", {
    enabled: true,
    username: "u",
    password: "",
  });
  assert.equal(noPass.ok, false);
  assert.match(noPass.error ?? "", /not configured/i);
  assert.equal(spawnMock.calls.length, 0);

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: spawns cmd with limited user env", async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetSpawnMock();

  const { launchWithLimitedUser } = await importLimitedUserModule();
  const result = launchWithLimitedUser(
    "C:\\Games\\Foo\\game.exe",
    ["-fullscreen", "arg with spaces"],
    "C:\\Games\\Foo",
    {
      enabled: true,
      username: "DecentralHubPlayer",
      password: "testpass",
      domain: "WORKGROUP",
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.pid, 5555);
  assert.equal(spawnMock.calls.length, 1);

  const [cmd, args, opts] = spawnMock.calls[0];
  assert.equal(cmd, "cmd.exe");
  assert.deepEqual(args, [
    "/c",
    "start",
    "",
    "C:\\Games\\Foo\\game.exe",
    "-fullscreen",
    "arg with spaces",
  ]);
  assert.equal(opts.cwd, "C:\\Games\\Foo");
  assert.equal(opts.env.DH_LIMITED_USER, "DecentralHubPlayer");
  assert.equal(opts.env.DH_LIMITED_DOMAIN, "WORKGROUP");
  assert.equal(opts.stdio, "ignore");
  assert.equal(opts.windowsHide, false);

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: default domain is dot", async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetSpawnMock();

  const { launchWithLimitedUser } = await importLimitedUserModule();
  launchWithLimitedUser("C:\\game.exe", [], "C:\\", {
    enabled: true,
    username: "player",
    password: "pass",
  });

  const [, , opts] = spawnMock.calls[0];
  assert.equal(opts.env.DH_LIMITED_DOMAIN, ".");

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: koffi failure returns error string", async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetSpawnMock();
  resetKoffiMock();
  koffiMock.failNext = true;

  const { launchWithLimitedUser } = await importLimitedUserModule();
  const result = launchWithLimitedUser("C:\\game.exe", [], "C:\\", {
    enabled: true,
    username: "player",
    password: "pass",
  });

  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /koffi unavailable/);
  assert.equal(spawnMock.calls.length, 0);

  Object.defineProperty(process, "platform", { value: origPlatform });
  resetKoffiMock();
});
