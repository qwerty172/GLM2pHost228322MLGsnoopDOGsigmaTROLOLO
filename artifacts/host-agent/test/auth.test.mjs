import "../test/setup-renderer-dom.mjs";
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { elements } from "../test/setup-renderer-dom.mjs";

const { validateHostToken, showSigninBanner } = await import("../dist/renderer/renderer/auth.js");

test("validateHostToken returns displayName on 200", async () => {
  const restore = mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => ({ displayName: "Test Host" }),
  }));
  try {
    const name = await validateHostToken("https://api.example.com", "tok123");
    assert.equal(name, "Test Host");
  } finally {
    restore.mock.restore();
  }
});

test("validateHostToken returns null on error", async () => {
  const restore = mock.method(globalThis, "fetch", async () => ({ ok: false }));
  try {
    const name = await validateHostToken("https://api.example.com", "bad");
    assert.equal(name, null);
  } finally {
    restore.mock.restore();
  }
});

test("showSigninBanner reveals banner and hides settings", () => {
  const banner = elements.get("signin-banner");
  const name = elements.get("signin-display-name");
  showSigninBanner("MyHost", "https://play.example.com");
  assert.equal(banner.hidden, false);
  assert.equal(name.textContent, "MyHost");
});
