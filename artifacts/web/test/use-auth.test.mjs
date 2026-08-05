import { test } from "node:test";
import assert from "node:assert/strict";

const {
  AUTH_ACCESS_STORAGE_KEY,
  consumeTokenFromUrl,
  exchangeLegacyForJwt,
  refreshAccessJwt,
} = await import("../src/hooks/use-auth.tsx");

test("AUTH_ACCESS_STORAGE_KEY is streamline.accessJwt", () => {
  assert.equal(AUTH_ACCESS_STORAGE_KEY, "streamline.accessJwt");
});

test("consumeTokenFromUrl persists token and strips query param", () => {
  let captured = null;
  let replacedUrl = null;
  const replaceState = (_state, _title, url) => {
    replacedUrl = url;
  };
  globalThis.window = {
    location: { search: "?token=abc123&foo=bar", pathname: "/dashboard", hash: "" },
    history: { replaceState },
  };

  try {
    consumeTokenFromUrl((t) => {
      captured = t;
    });
    assert.equal(captured, "abc123");
    assert.equal(replacedUrl, "/dashboard?foo=bar");
  } finally {
    delete globalThis.window;
  }
});

test("consumeTokenFromUrl is no-op without token param", () => {
  let called = false;
  globalThis.window = {
    location: { search: "?foo=bar", pathname: "/", hash: "" },
    history: { replaceState: () => {} },
  };
  try {
    consumeTokenFromUrl(() => {
      called = true;
    });
    assert.equal(called, false);
  } finally {
    delete globalThis.window;
  }
});

test("exchangeLegacyForJwt returns accessToken on success", async () => {
  const jwt = await exchangeLegacyForJwt("legacy-1", async () => ({ accessToken: "jwt-1" }));
  assert.equal(jwt, "jwt-1");
});

test("exchangeLegacyForJwt returns null on failure", async () => {
  const jwt = await exchangeLegacyForJwt("bad", async () => {
    throw new Error("401");
  });
  assert.equal(jwt, null);
});

test("refreshAccessJwt returns accessToken on success", async () => {
  const jwt = await refreshAccessJwt(async () => ({ accessToken: "refreshed" }));
  assert.equal(jwt, "refreshed");
});

test("refreshAccessJwt returns null on failure", async () => {
  const jwt = await refreshAccessJwt(async () => {
    throw new Error("expired");
  });
  assert.equal(jwt, null);
});
