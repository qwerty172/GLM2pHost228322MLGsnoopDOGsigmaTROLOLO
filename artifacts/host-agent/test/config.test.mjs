import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installRendererDom } from "./helpers/dom-setup.mjs";

let pathBasename;
let deriveSignalingUrl;

before(async () => {
  installRendererDom();
  ({ pathBasename, deriveSignalingUrl } = await import("../dist/renderer/renderer/config.js"));
});

test("pathBasename extracts filename from Windows path", () => {
  assert.equal(pathBasename("C:\\Games\\foo.exe"), "foo.exe");
  assert.equal(pathBasename("/usr/bin/game"), "game");
});

test("deriveSignalingUrl builds ws URL from apiBaseUrl", () => {
  const url = deriveSignalingUrl({
    hostToken: "t",
    apiBaseUrl: "https://api.example.com/v1/",
    signalingUrl: "",
    appPath: "",
    ratePerMinute: 0,
    commissionSplit: 0.7,
    resolution: { width: 1920, height: 1080 },
    bitrateKbps: 6000,
    killAppOnDisconnect: false,
    autoLaunchAtStartup: false,
  });
  assert.equal(url, "wss://api.example.com/v1/api/signal");
});
