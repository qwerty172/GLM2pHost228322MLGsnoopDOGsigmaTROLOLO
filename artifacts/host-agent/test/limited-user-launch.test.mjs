import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { EventEmitter } from "node:events";

/** Mutable spawn mock state for win32 + koffi tests. */
let spawnMock = {
  calls: [],
  nextPid: 9876,
  failNext: false,
};

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
  if (request === "koffi") {
    return {
      load: () => ({
        func: () => () => 1,
      }),
    };
  }
  if (request === "node:child_process") {
    return {
      spawn: (...args) => {
        if (spawnMock.failNext) throw new Error("spawn failed");
        spawnMock.calls.push(args);
        const child = new EventEmitter();
        child.pid = spawnMock.nextPid;
        return child;
      },
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
  spawnMock = { calls: [], nextPid: 9876, failNext: false };
}

const validCreds = {
  enabled: true,
  username: "DecentralHubPlayer",
  password: "secret",
};

test("non-win32: returns Windows-only error", { concurrency: false }, async () => {
  if (process.platform === "win32") return;
  const { launchWithLimitedUser } = await importLimitedUserModule();
  const result = launchWithLimitedUser("C:\\Games\\foo.exe", [], "C:\\Games", validCreds);
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /Windows-only/i);
});

test("rejects disabled limited-user config", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  const { launchWithLimitedUser } = await importLimitedUserModule();
  const result = launchWithLimitedUser("C:\\Games\\foo.exe", [], "C:\\Games", {
    ...validCreds,
    enabled: false,
  });
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /not configured/i);
  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("rejects missing username or password", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  const { launchWithLimitedUser } = await importLimitedUserModule();
  assert.match(
    launchWithLimitedUser("C:\\Games\\foo.exe", [], "C:\\Games", {
      ...validCreds,
      username: "",
    }).error ?? "",
    /not configured/i,
  );
  assert.match(
    launchWithLimitedUser("C:\\Games\\foo.exe", [], "C:\\Games", {
      ...validCreds,
      password: "",
    }).error ?? "",
    /not configured/i,
  );
  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: spawns cmd with limited-user env and returns pid", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetSpawnMock();

  const { launchWithLimitedUser } = await importLimitedUserModule();
  const result = launchWithLimitedUser(
    "C:\\Games\\Foo\\game.exe",
    ["-fullscreen", "-log"],
    "C:\\Games\\Foo",
    validCreds,
  );

  assert.deepEqual(result, { ok: true, pid: 9876 });
  assert.equal(spawnMock.calls.length, 1);
  const [cmd, args, opts] = spawnMock.calls[0];
  assert.equal(cmd, "cmd.exe");
  assert.deepEqual(args, ["/c", "start", "", "C:\\Games\\Foo\\game.exe", "-fullscreen", "-log"]);
  assert.equal(opts.cwd, "C:\\Games\\Foo");
  assert.equal(opts.env.DH_LIMITED_USER, "DecentralHubPlayer");
  assert.equal(opts.env.DH_LIMITED_DOMAIN, ".");

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: uses custom domain when provided", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetSpawnMock();

  const { launchWithLimitedUser } = await importLimitedUserModule();
  launchWithLimitedUser("C:\\Games\\foo.exe", [], "C:\\Games", {
    ...validCreds,
    domain: "WORKGROUP",
  });

  assert.equal(spawnMock.calls[0][2].env.DH_LIMITED_DOMAIN, "WORKGROUP");

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: spawn failure returns error string", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetSpawnMock();
  spawnMock.failNext = true;

  const { launchWithLimitedUser } = await importLimitedUserModule();
  const result = launchWithLimitedUser("C:\\Games\\foo.exe", [], "C:\\Games", validCreds);

  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /spawn failed/);

  Object.defineProperty(process, "platform", { value: origPlatform });
});
