import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { EventEmitter } from "node:events";

/** Recorded spawn() invocations for assertions. */
let spawnCalls = [];
let koffiShouldThrow = false;

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return {
      app: {
        getAppPath: () => "/tmp/test-limited-user",
        getPath: () => "/tmp/test-limited-user",
      },
    };
  }
  if (request === "node:child_process") {
    return {
      spawn: (...args) => {
        spawnCalls.push(args);
        const child = new EventEmitter();
        child.pid = 9876;
        return child;
      },
    };
  }
  if (request === "koffi") {
    if (koffiShouldThrow) throw new Error("koffi missing");
    return {
      load: (lib) => ({
        func: (sig) => {
          if (lib === "advapi32.dll" && sig.includes("CreateProcessWithLogonW")) {
            return () => 1;
          }
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
  koffiShouldThrow = false;
}

const validCreds = {
  enabled: true,
  username: "DecentralHubPlayer",
  password: "secret",
};

test("non-win32 returns Windows-only error", { concurrency: false }, async () => {
  if (process.platform === "win32") return;
  resetMocks();
  const { launchWithLimitedUser } = await importLimitedUserModule();
  const result = launchWithLimitedUser("C:\\Games\\Foo\\game.exe", ["-log"], "C:\\Games\\Foo", validCreds);
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /Windows-only/i);
  assert.equal(spawnCalls.length, 0);
});

test("win32 mocked: rejects disabled or incomplete credentials", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetMocks();

  const { launchWithLimitedUser } = await importLimitedUserModule();

  for (const creds of [
    { enabled: false, username: "u", password: "p" },
    { enabled: true, username: "", password: "p" },
    { enabled: true, username: "u", password: "" },
  ]) {
    const result = launchWithLimitedUser("C:\\game.exe", [], "C:\\", creds);
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /not configured/i);
  }
  assert.equal(spawnCalls.length, 0);

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: spawns cmd.exe and returns pid", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetMocks();

  const { launchWithLimitedUser } = await importLimitedUserModule();
  const result = launchWithLimitedUser(
    "C:\\Games\\Foo\\game.exe",
    ["-fullscreen", "-log"],
    "C:\\Games\\Foo",
    validCreds,
  );

  assert.deepEqual(result, { ok: true, pid: 9876 });
  assert.equal(spawnCalls.length, 1);
  const [cmd, args, opts] = spawnCalls[0];
  assert.equal(cmd, "cmd.exe");
  assert.deepEqual(args, ["/c", "start", "", "C:\\Games\\Foo\\game.exe", "-fullscreen", "-log"]);
  assert.equal(opts.cwd, "C:\\Games\\Foo");
  assert.equal(opts.detached, false);
  assert.equal(opts.stdio, "ignore");
  assert.equal(opts.windowsHide, false);
  assert.equal(opts.env.DH_LIMITED_USER, validCreds.username);
  assert.equal(opts.env.DH_LIMITED_DOMAIN, ".");

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: uses explicit domain when provided", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetMocks();

  const { launchWithLimitedUser } = await importLimitedUserModule();
  launchWithLimitedUser("C:\\game.exe", [], "C:\\", {
    ...validCreds,
    domain: "WORKGROUP",
  });

  assert.equal(spawnCalls[0][2].env.DH_LIMITED_DOMAIN, "WORKGROUP");

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: koffi failure returns error string", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetMocks();
  koffiShouldThrow = true;

  const { launchWithLimitedUser } = await importLimitedUserModule();
  const result = launchWithLimitedUser("C:\\game.exe", [], "C:\\", validCreds);

  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /koffi missing/);
  assert.equal(spawnCalls.length, 0);

  Object.defineProperty(process, "platform", { value: origPlatform });
});
