import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { EventEmitter } from "node:events";

/** Mutable spawn mock state for win32 + koffi tests. */
let spawnMock = {
  calls: [],
  pid: 5678,
  failNext: false,
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
        if (spawnMock.failNext) throw new Error("spawn failed");
        spawnMock.calls.push(args);
        const child = new EventEmitter();
        child.pid = spawnMock.pid;
        return child;
      },
    };
  }
  if (request === "koffi") {
    return {
      load: () => ({
        func: () => {
          if (koffiMock.failNext) throw new Error("koffi load failed");
          return () => 1;
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
  spawnMock = { calls: [], pid: 5678, failNext: false };
  koffiMock = { failNext: false };
}

const validCreds = {
  enabled: true,
  username: "DecentralHubPlayer",
  password: "secret",
};

test("non-win32: returns Windows-only error", { concurrency: false }, async () => {
  if (process.platform === "win32") return;
  resetMocks();
  const { launchWithLimitedUser } = await importLimitedUserModule();
  const result = launchWithLimitedUser("C:\\Games\\game.exe", [], "C:\\Games", validCreds);
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /Windows-only/i);
  assert.equal(spawnMock.calls.length, 0);
});

test("win32 mocked: rejects when limited user is disabled", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetMocks();

  const { launchWithLimitedUser } = await importLimitedUserModule();
  const result = launchWithLimitedUser("C:\\Games\\game.exe", [], "C:\\Games", {
    enabled: false,
    username: "user",
    password: "pass",
  });

  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /not configured/i);
  assert.equal(spawnMock.calls.length, 0);

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: rejects missing username or password", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetMocks();

  const { launchWithLimitedUser } = await importLimitedUserModule();

  assert.equal(
    launchWithLimitedUser("C:\\Games\\game.exe", [], "C:\\Games", {
      ...validCreds,
      username: "",
    }).ok,
    false,
  );
  assert.equal(
    launchWithLimitedUser("C:\\Games\\game.exe", [], "C:\\Games", {
      ...validCreds,
      password: "",
    }).ok,
    false,
  );
  assert.equal(spawnMock.calls.length, 0);

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

  assert.deepEqual(result, { ok: true, pid: 5678 });
  assert.equal(spawnMock.calls.length, 1);
  const [cmd, args, opts] = spawnMock.calls[0];
  assert.equal(cmd, "cmd.exe");
  assert.deepEqual(args, ["/c", "start", "", "C:\\Games\\Foo\\game.exe", "-fullscreen", "-log"]);
  assert.equal(opts.cwd, "C:\\Games\\Foo");
  assert.equal(opts.env.DH_LIMITED_USER, "DecentralHubPlayer");
  assert.equal(opts.env.DH_LIMITED_DOMAIN, ".");

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: uses custom domain in spawn env", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetMocks();

  const { launchWithLimitedUser } = await importLimitedUserModule();
  launchWithLimitedUser("C:\\Games\\game.exe", [], "C:\\Games", {
    ...validCreds,
    domain: "WORKGROUP",
  });

  const opts = spawnMock.calls[0][2];
  assert.equal(opts.env.DH_LIMITED_DOMAIN, "WORKGROUP");

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: passes args with spaces through spawn", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetMocks();

  const { launchWithLimitedUser } = await importLimitedUserModule();
  launchWithLimitedUser(
    "C:\\Games\\game.exe",
    ["-map", "Custom Map.umap"],
    "C:\\Games",
    validCreds,
  );

  const args = spawnMock.calls[0][1];
  assert.deepEqual(args, ["/c", "start", "", "C:\\Games\\game.exe", "-map", "Custom Map.umap"]);

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: koffi failure returns error string", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetMocks();
  koffiMock.failNext = true;

  const { launchWithLimitedUser } = await importLimitedUserModule();
  const result = launchWithLimitedUser("C:\\Games\\game.exe", [], "C:\\Games", validCreds);

  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /koffi load failed/);
  assert.equal(spawnMock.calls.length, 0);

  Object.defineProperty(process, "platform", { value: origPlatform });
});
