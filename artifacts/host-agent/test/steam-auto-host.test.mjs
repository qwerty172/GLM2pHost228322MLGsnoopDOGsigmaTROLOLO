import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installRendererDom } from "./helpers/dom-setup.mjs";

let autoSteamCard;

before(async () => {
  installRendererDom();
  ({ autoSteamCard } = await import("../dist/renderer/renderer/steam-auto-host.js"));
});

test("autoSteamCard element is exported", () => {
  assert.equal(autoSteamCard.id, "auto-steam-card");
});
