import { test } from "node:test";
import assert from "node:assert/strict";
import { installRendererEnv, RENDERER_DIST } from "./helpers/renderer-env.mjs";

installRendererEnv();

const { pathBasename, deriveSignalingUrl } = await import(new URL("config.js", RENDERER_DIST).href);

test("pathBasename returns last path segment", () => {
  assert.equal(pathBasename("C:\\Games\\foo.exe"), "foo.exe");
  assert.equal(pathBasename("/usr/bin/game"), "game");
});

test("deriveSignalingUrl uses explicit signalingUrl when set", () => {
  assert.equal(
    deriveSignalingUrl({
      apiBaseUrl: "https://api.example.com",
      signalingUrl: "wss://signal.example/ws",
    }),
    "wss://signal.example/ws",
  );
});

test("deriveSignalingUrl builds ws URL from apiBaseUrl", () => {
  assert.equal(
    deriveSignalingUrl({ apiBaseUrl: "https://api.example.com/", signalingUrl: "" }),
    "wss://api.example.com/api/signal",
  );
  assert.equal(
    deriveSignalingUrl({ apiBaseUrl: "http://localhost:3000", signalingUrl: "" }),
    "ws://localhost:3000/api/signal",
  );
});
