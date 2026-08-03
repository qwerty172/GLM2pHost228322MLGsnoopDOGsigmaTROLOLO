import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installRendererDom } from "./helpers/dom-setup.mjs";

let pairingCard;

before(async () => {
  installRendererDom();
  ({ pairingCard } = await import("../dist/renderer/renderer/pairing.js"));
});

test("pairingCard element is exported", () => {
  assert.equal(pairingCard.id, "pairing-card");
});
