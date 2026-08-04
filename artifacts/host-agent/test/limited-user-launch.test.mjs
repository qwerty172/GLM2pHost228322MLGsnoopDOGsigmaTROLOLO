import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { EventEmitter } from "node:events";

/** Mutable spawn mock state for win32 tests. */
let spawnMock = {
  calls: [],
  failNext: false,
};

let koffiFailNext = false;

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
  if (request === "koffi") {
    if (koffiFailNext) {
      throw new Error("koffi load failed");
    }
    const advapi32Funcs = (sig) => {
      if (sig.includes("CreateProcessWithLogonW")) {
        return () => 1;
      }
      return () => 0;
    };
    return {
      load: (lib) => {
        if (lib === "advapi32.dll") return { func: advapi32Funcs };
        return { func: () => () => 0 };
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
  return load.apply(this, arguments);
};

async function importLimitedUserModule() {
  const url = new URL("../dist/main/main/limited-user-launch.js", import.meta.url);
  url.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return import(url.href);
}

function resetMocks() {
  spawnMock = { calls: [], failNext: false };
  koffiFailNext = false;
}

const validCreds = {
  enabled: true,
  username: "DecentralHubPlayer",
  password: "secret",
};

test("non-win32: returns Windows-only error", async () => {
  if (process.platform === "win32") return;
  resetMocks();
  const { launchWithLimitedUser } = await importLimitedUserModule();
  const result = launchWithLimitedUser("C:\\Games\\game.exe", ["-fullscreen"], "C:\\Games", validCreds);
  assert.deepEqual(result, { ok: false, error: "Limited user launch is Windows-only" });
});

test("rejects disabled limited-user config", async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetMocks();
  const { launchWithLimitedUser } = await importLimitedUserModule();
  const result = launchWithLimitedUser("C:\\Games\\game.exe", [], "C:\\Games", {
    ...validCreds,
    enabled: false,
  });
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /credentials not configured/i);
  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("rejects missing username or password", async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetMocks();
  const { launchWithLimitedUser } = await importLimitedUserModule();
  const noUser = launchWithLimitedUser("C:\\Games\\game.exe", [], "C:\\Games", {
    ...validCreds,
    username: "",
  });
  const noPass = launchWithLimitedUser("C:\\Games\\game.exe", [], "C:\\Games", {
    ...validCreds,
    password: "",
  });
  assert.equal(noUser.ok, false);
  assert.equal(noPass.ok, false);
  assert.match(noUser.error ?? "", /credentials not configured/i);
  assert.match(noPass.error ?? "", /credentials not configured/i);
  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: spawns cmd with app path and returns pid", async () => {
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

  assert.deepEqual(result, { ok: true, pid: 5151 });
  assert.equal(spawnMock.calls.length, 1);
  const [cmd, args, opts] = spawnMock.calls[0];
  assert.equal(cmd, "cmd.exe");
  assert.deepEqual(args, ["/c", "start", "", "C:\\Games\\Foo\\game.exe", "-fullscreen", "-log"]);
  assert.equal(opts.cwd, "C:\\Games\\Foo");
  assert.equal(opts.env.DH_LIMITED_USER, "DecentralHubPlayer");
  assert.equal(opts.env.DH_LIMITED_DOMAIN, ".");

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: uses explicit domain when provided", async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetMocks();

  const { launchWithLimitedUser } = await importLimitedUserModule();
  launchWithLimitedUser("C:\\Games\\game.exe", [], "C:\\Games", {
    ...validCreds,
    domain: "WORKGROUP",
  });

  const [, , opts] = spawnMock.calls[0];
  assert.equal(opts.env.DH_LIMITED_DOMAIN, "WORKGROUP");

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: koffi failure returns error", async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetMocks();
  koffiFailNext = true;

  const { launchWithLimitedUser } = await importLimitedUserModule();
  const result = launchWithLimitedUser("C:\\Games\\game.exe", [], "C:\\Games", validCreds);

  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /koffi load failed/i);

  Object.defineProperty(process, "platform", { value: origPlatform });
});
