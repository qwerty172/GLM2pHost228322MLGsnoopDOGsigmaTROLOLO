import { test } from "node:test";
import assert from "node:assert/strict";

const {
  ADMIN_SECRET_STORAGE_KEY,
  readAdminSecret,
  writeAdminSecret,
  adminRequestInit,
  getApiErrorMessage,
} = await import("../src/pages/admin/games.tsx");

function mockStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => {
      data.set(key, String(value));
    },
    removeItem: (key) => {
      data.delete(key);
    },
    _data: data,
  };
}

test("ADMIN_SECRET_STORAGE_KEY is streamline.adminSecret", () => {
  assert.equal(ADMIN_SECRET_STORAGE_KEY, "streamline.adminSecret");
});

test("adminRequestInit sets X-Host-Token and optional X-Admin-Secret", () => {
  assert.deepEqual(adminRequestInit("host-tok", "").headers, {
    "X-Host-Token": "host-tok",
  });
  assert.deepEqual(adminRequestInit("host-tok", "secret-123").headers, {
    "X-Host-Token": "host-tok",
    "X-Admin-Secret": "secret-123",
  });
});

test("getApiErrorMessage extracts API error payload", () => {
  assert.equal(getApiErrorMessage({ data: { error: "forbidden" } }), "forbidden");
  assert.equal(getApiErrorMessage(new Error("network down")), "network down");
  assert.equal(getApiErrorMessage("oops"), "Неизвестная ошибка");
});

test("readAdminSecret and writeAdminSecret use sessionStorage", () => {
  const session = mockStorage();
  const local = mockStorage();
  const prevSession = globalThis.sessionStorage;
  const prevLocal = globalThis.localStorage;
  globalThis.sessionStorage = session;
  globalThis.localStorage = local;

  try {
    assert.equal(readAdminSecret(), "");
    writeAdminSecret("admin-pass");
    assert.equal(readAdminSecret(), "admin-pass");
    assert.equal(session._data.get(ADMIN_SECRET_STORAGE_KEY), "admin-pass");
    writeAdminSecret("");
    assert.equal(readAdminSecret(), "");
    assert.equal(session._data.has(ADMIN_SECRET_STORAGE_KEY), false);
  } finally {
    globalThis.sessionStorage = prevSession;
    globalThis.localStorage = prevLocal;
  }
});
