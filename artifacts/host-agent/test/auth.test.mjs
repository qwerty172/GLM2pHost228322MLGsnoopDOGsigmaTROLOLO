import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { setupRendererEnv } from "./helpers/renderer-env.mjs";

setupRendererEnv();
const { validateHostToken, showSigninBanner } = await import("../dist/renderer/renderer/auth.js");

test("validateHostToken returns displayName on success", async () => {
  const restore = mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => ({ displayName: "Test Host" }),
  }));
  try {
    const name = await validateHostToken("https://api.example.com", "token-1");
    assert.equal(name, "Test Host");
  } finally {
    restore.mock.restore();
  }
});

test("validateHostToken returns null on HTTP error", async () => {
  const restore = mock.method(globalThis, "fetch", async () => ({ ok: false }));
  try {
    const name = await validateHostToken("https://api.example.com", "bad");
    assert.equal(name, null);
  } finally {
    restore.mock.restore();
  }
});

test("showSigninBanner fills banner and collapses settings", () => {
  showSigninBanner("Alice", "https://gaming.example.com");
  assert.equal(document.getElementById("signin-display-name").textContent, "Alice");
  assert.equal(document.getElementById("signin-api-url").textContent, "gaming.example.com");
  assert.equal(document.getElementById("signin-banner").hidden, false);
});
