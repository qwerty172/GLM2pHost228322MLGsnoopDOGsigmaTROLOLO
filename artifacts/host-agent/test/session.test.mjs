import { test } from "node:test";
import assert from "node:assert/strict";
import { setupRendererEnv } from "./helpers/renderer-env.mjs";

setupRendererEnv();
const { showPlayerLink } = await import("../dist/renderer/renderer/session.js");

test("showPlayerLink builds play URL and reveals share card", () => {
  showPlayerLink(
    { apiBaseUrl: "https://platform.example.com/" },
    "player-token-42",
  );
  const input = document.getElementById("player-link");
  assert.equal(input.value, "https://platform.example.com/play/player-token-42");
  assert.equal(document.getElementById("share-card").hidden, false);
});
