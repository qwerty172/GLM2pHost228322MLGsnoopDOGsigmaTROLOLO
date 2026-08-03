import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installRendererDom } from "./helpers/dom-setup.mjs";

let showPlayerLink;
let sendControlReject;
let session;
let playerLinkInput;

before(async () => {
  installRendererDom();
  ({ showPlayerLink, sendControlReject } = await import("../dist/renderer/renderer/session.js"));
  ({ session } = await import("../dist/renderer/renderer/state.js"));
  ({ playerLinkInput } = await import("../dist/renderer/renderer/dom.js"));
});

test("showPlayerLink builds play URL", () => {
  showPlayerLink({ apiBaseUrl: "https://api.example.com" }, "player-token-1");
  assert.equal(
    playerLinkInput.value,
    "https://api.example.com/play/player-token-1",
  );
});

test("sendControlReject sends control message when ws open", () => {
  const sent = [];
  session.ws = {
    readyState: WebSocket.OPEN,
    send: (msg) => sent.push(msg),
  };
  sendControlReject("host_busy");
  assert.equal(sent.length, 1);
  assert.match(sent[0], /host_busy/);
});
