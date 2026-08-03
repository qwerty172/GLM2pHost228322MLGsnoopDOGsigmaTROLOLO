import "../test/setup-renderer-dom.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";

const { pathBasename, deriveSignalingUrl } = await import("../dist/renderer/renderer/config.js");

test("pathBasename returns last path segment", () => {
  assert.equal(pathBasename("C:\\Games\\game.exe"), "game.exe");
  assert.equal(pathBasename("/opt/bin/agent"), "agent");
});

test("deriveSignalingUrl uses explicit signalingUrl when set", () => {
  const cfg = {
    apiBaseUrl: "https://api.example.com",
    signalingUrl: "wss://signal.example.com/ws",
  };
  assert.equal(deriveSignalingUrl(cfg), "wss://signal.example.com/ws");
});

test("deriveSignalingUrl derives ws URL from apiBaseUrl", () => {
  const cfg = { apiBaseUrl: "https://api.example.com/", signalingUrl: "" };
  assert.equal(deriveSignalingUrl(cfg), "wss://api.example.com/api/signal");
});

test("deriveSignalingUrl uses ws for http apiBaseUrl", () => {
  const cfg = { apiBaseUrl: "http://localhost:3000", signalingUrl: "" };
  assert.equal(deriveSignalingUrl(cfg), "ws://localhost:3000/api/signal");
});
