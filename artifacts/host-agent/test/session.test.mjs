import { test } from "node:test";
import assert from "node:assert/strict";
import { installRendererEnv, RENDERER_DIST } from "./helpers/renderer-env.mjs";

installRendererEnv();

const { showPlayerLink, sendControlReject, cancelDeferredTeardown } = await import(
  new URL("session.js", RENDERER_DIST).href
);
const { session } = await import(new URL("state.js", RENDERER_DIST).href);

test("showPlayerLink fills player URL and reveals share card", () => {
  const shareCard = document.getElementById("share-card");
  const playerLink = document.getElementById("player-link");
  shareCard.hidden = true;
  showPlayerLink({ apiBaseUrl: "https://api.example.com" }, "player-token-abc");
  assert.equal(playerLink.value, "https://api.example.com/play/player-token-abc");
  assert.equal(shareCard.hidden, false);
});

test("sendControlReject sends control message when WS is open", () => {
  const sent = [];
  session.ws = {
    readyState: 1,
    send: (msg) => sent.push(JSON.parse(msg)),
  };
  sendControlReject("host_busy");
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0], { type: "control", action: "reject", reason: "host_busy" });
  session.ws = null;
});

test("cancelDeferredTeardown clears pending timer", () => {
  session.pendingTeardown = setTimeout(() => {}, 60_000);
  cancelDeferredTeardown();
  assert.equal(session.pendingTeardown, null);
});
