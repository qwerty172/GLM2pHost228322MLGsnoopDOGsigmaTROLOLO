import { test } from "node:test";
import assert from "node:assert/strict";
import { installRendererEnv, RENDERER_DIST } from "./helpers/renderer-env.mjs";

installRendererEnv();

const { validateHostToken } = await import(new URL("auth.js", RENDERER_DIST).href);

test("validateHostToken returns displayName on success", async () => {
  globalThis.fetch = async (url) => {
    assert.match(String(url), /\/api\/hosts\/token-123$/);
    return {
      ok: true,
      json: async () => ({ displayName: "Test Host" }),
    };
  };
  const name = await validateHostToken("https://api.example.com", "token-123");
  assert.equal(name, "Test Host");
});

test("validateHostToken returns null on HTTP error", async () => {
  globalThis.fetch = async () => ({ ok: false });
  assert.equal(await validateHostToken("https://api.example.com", "bad"), null);
});
