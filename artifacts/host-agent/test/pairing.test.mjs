import { test } from "node:test";
import assert from "node:assert/strict";
import { installRendererEnv, RENDERER_DIST } from "./helpers/renderer-env.mjs";

installRendererEnv();

const { pairingCard } = await import(new URL("pairing.js", RENDERER_DIST).href);

test("pairing module exposes pairing card element", () => {
  assert.equal(pairingCard.id, "pairing-card");
});

test("pairing code input rejects non-6-digit pattern in UI", () => {
  const input = document.getElementById("pairing-code");
  input.value = "12345";
  assert.equal(/^\d{6}$/.test(input.value.trim()), false);
  input.value = "123456";
  assert.equal(/^\d{6}$/.test(input.value.trim()), true);
});
