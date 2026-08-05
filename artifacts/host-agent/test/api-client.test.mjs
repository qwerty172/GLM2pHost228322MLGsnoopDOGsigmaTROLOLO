import { test, mock } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";

// api-client → logger requires electron at load time
const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return { app: { getAppPath: () => "/tmp/test-agent" } };
  }
  return load.apply(this, arguments);
};

const {
  fetchHostSchedule,
  fetchLibrary,
  sendHeartbeat,
  patchLocalAvailability,
  fetchAgentRequirements,
  warnIfAgentVersionUnsupported,
  requestSaveDownloadUrl,
  requestSaveUploadUrl,
  confirmSaveUpload,
} = await import("../dist/main/main/api-client.js");

const API = "https://api.example.com/";
const TOKEN = "host-tok-1";

test("fetchHostSchedule returns schedule on success", async () => {
  const restore = mock.method(globalThis, "fetch", async (url) => {
    assert.equal(url, "https://api.example.com/api/hosts/host-tok-1");
    return {
      ok: true,
      json: async () => ({
        scheduleMode: "weekly",
        scheduleJson: [{ day: 1, startMin: 60, endMin: 120 }],
      }),
    };
  });
  try {
    const result = await fetchHostSchedule(TOKEN, API);
    assert.deepEqual(result, {
      scheduleMode: "weekly",
      scheduleJson: [{ day: 1, startMin: 60, endMin: 120 }],
    });
  } finally {
    restore.mock.restore();
  }
});

test("fetchHostSchedule returns null on HTTP error", async () => {
  const restore = mock.method(globalThis, "fetch", async () => ({ ok: false, status: 401 }));
  try {
    assert.equal(await fetchHostSchedule(TOKEN, API), null);
  } finally {
    restore.mock.restore();
  }
});

test("fetchHostSchedule defaults scheduleJson to empty array", async () => {
  const restore = mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => ({ scheduleMode: "always" }),
  }));
  try {
    const result = await fetchHostSchedule(TOKEN, API);
    assert.deepEqual(result, { scheduleMode: "always", scheduleJson: [] });
  } finally {
    restore.mock.restore();
  }
});

test("fetchLibrary returns entries on success", async () => {
  const entries = [{ id: "lib-1", gameId: "g-1" }];
  const restore = mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(url, "https://api.example.com/api/hosts/host-tok-1/library");
    assert.equal(init.headers["content-type"], "application/json");
    return { ok: true, json: async () => entries };
  });
  try {
    assert.deepEqual(await fetchLibrary(TOKEN, API), entries);
  } finally {
    restore.mock.restore();
  }
});

test("fetchLibrary returns null on failure", async () => {
  const restore = mock.method(globalThis, "fetch", async () => {
    throw new Error("offline");
  });
  try {
    assert.equal(await fetchLibrary(TOKEN, API), null);
  } finally {
    restore.mock.restore();
  }
});

test("sendHeartbeat probes ping then posts heartbeat with pingMs", async () => {
  const calls = [];
  const restore = mock.method(globalThis, "fetch", async (url, init) => {
    calls.push({ url, init });
    return { ok: true };
  });
  try {
    await sendHeartbeat(TOKEN, API);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, "https://api.example.com/api/public/ping");
    assert.equal(calls[1].url, "https://api.example.com/api/hosts/heartbeat");
    assert.equal(calls[1].init.method, "POST");
    assert.equal(calls[1].init.headers["x-host-token"], TOKEN);
    const body = JSON.parse(calls[1].init.body);
    assert.equal(body.hostToken, TOKEN);
    assert.equal(typeof body.pingMs, "number");
  } finally {
    restore.mock.restore();
  }
});

test("sendHeartbeat swallows network errors", async () => {
  const restore = mock.method(globalThis, "fetch", async () => {
    throw new Error("timeout");
  });
  try {
    await assert.doesNotReject(sendHeartbeat(TOKEN, API));
  } finally {
    restore.mock.restore();
  }
});

test("patchLocalAvailability PATCHes library entry", async () => {
  const restore = mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(
      url,
      "https://api.example.com/api/hosts/host-tok-1/library/game%2F1",
    );
    assert.equal(init.method, "PATCH");
    assert.deepEqual(JSON.parse(init.body), {
      localAvailable: false,
      lastError: "exe missing",
    });
    return { ok: true };
  });
  try {
    await patchLocalAvailability(TOKEN, API, "game/1", false, "exe missing");
  } finally {
    restore.mock.restore();
  }
});

test("requestSaveDownloadUrl handles 404 and success", async () => {
  let call = 0;
  const restore = mock.method(globalThis, "fetch", async () => {
    call += 1;
    if (call === 1) return { ok: false, status: 404 };
    return {
      ok: true,
      status: 200,
      json: async () => ({ downloadURL: "https://cdn/save.zip", objectPath: "saves/a" }),
    };
  });
  try {
    assert.deepEqual(await requestSaveDownloadUrl(TOKEN, API, "sess-1"), {
      ok: false,
      status: 404,
    });
    assert.deepEqual(await requestSaveDownloadUrl(TOKEN, API, "sess-1"), {
      ok: true,
      downloadURL: "https://cdn/save.zip",
      objectPath: "saves/a",
    });
  } finally {
    restore.mock.restore();
  }
});

test("requestSaveDownloadUrl maps 503 to storage_unavailable", async () => {
  const restore = mock.method(globalThis, "fetch", async () => ({ ok: false, status: 503 }));
  try {
    assert.deepEqual(await requestSaveDownloadUrl(TOKEN, API, "sess-1"), {
      ok: false,
      status: 503,
      error: "storage_unavailable",
    });
  } finally {
    restore.mock.restore();
  }
});

test("requestSaveUploadUrl returns upload URL on success", async () => {
  const restore = mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(url, "https://api.example.com/api/saves/upload-url");
    assert.equal(init.method, "POST");
    assert.deepEqual(JSON.parse(init.body), { sessionId: "sess-2", sizeBytes: 4096 });
    return {
      ok: true,
      json: async () => ({ uploadURL: "https://cdn/upload", objectPath: "saves/b" }),
    };
  });
  try {
    assert.deepEqual(await requestSaveUploadUrl(TOKEN, API, "sess-2", 4096), {
      ok: true,
      uploadURL: "https://cdn/upload",
      objectPath: "saves/b",
    });
  } finally {
    restore.mock.restore();
  }
});

test("confirmSaveUpload posts hash and size", async () => {
  const restore = mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(url, "https://api.example.com/api/saves/confirm");
    assert.deepEqual(JSON.parse(init.body), {
      sessionId: "sess-3",
      contentHash: "abc123",
      sizeBytes: 100,
    });
    return { ok: true };
  });
  try {
    assert.deepEqual(await confirmSaveUpload(TOKEN, API, "sess-3", "abc123", 100), { ok: true });
  } finally {
    restore.mock.restore();
  }
});

test("fetchAgentRequirements returns requirements on success", async () => {
  const restore = mock.method(globalThis, "fetch", async (url) => {
    assert.equal(url, "https://api.example.com/api/public/agent-requirements");
    return {
      ok: true,
      json: async () => ({ minSupportedAgentVersion: "2.0.0" }),
    };
  });
  try {
    assert.deepEqual(await fetchAgentRequirements(API), {
      minSupportedAgentVersion: "2.0.0",
    });
  } finally {
    restore.mock.restore();
  }
});

test("fetchAgentRequirements returns null on HTTP error", async () => {
  const restore = mock.method(globalThis, "fetch", async () => ({ ok: false, status: 503 }));
  try {
    assert.equal(await fetchAgentRequirements(API), null);
  } finally {
    restore.mock.restore();
  }
});

test("fetchAgentRequirements returns null when minSupportedAgentVersion missing", async () => {
  const restore = mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => ({}),
  }));
  try {
    assert.equal(await fetchAgentRequirements(API), null);
  } finally {
    restore.mock.restore();
  }
});

test("fetchAgentRequirements returns null on network error", async () => {
  const restore = mock.method(globalThis, "fetch", async () => {
    throw new Error("offline");
  });
  try {
    assert.equal(await fetchAgentRequirements(API), null);
  } finally {
    restore.mock.restore();
  }
});

test("warnIfAgentVersionUnsupported returns true for supported version", () => {
  assert.equal(warnIfAgentVersionUnsupported("2.5.0", "2.0.0"), true);
  assert.equal(warnIfAgentVersionUnsupported("2.0.0", "2.0.0"), true);
});

test("warnIfAgentVersionUnsupported returns false for outdated version", () => {
  assert.equal(warnIfAgentVersionUnsupported("1.0.0", "2.0.0"), false);
});
