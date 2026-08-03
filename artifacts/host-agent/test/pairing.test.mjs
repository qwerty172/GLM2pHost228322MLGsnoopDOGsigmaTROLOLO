import "../test/setup-renderer-dom.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { elements } from "../test/setup-renderer-dom.mjs";

await import("../dist/renderer/renderer/pairing.js");

test("pairing module exports pairing card", async () => {
  const { pairingCard } = await import("../dist/renderer/renderer/pairing.js");
  assert.equal(pairingCard, elements.get("pairing-card"));
});

test("pairing inputs exist", () => {
  assert.ok(elements.get("pairing-code"));
  assert.ok(elements.get("pairing-submit"));
  assert.ok(elements.get("pairing-status"));
});
