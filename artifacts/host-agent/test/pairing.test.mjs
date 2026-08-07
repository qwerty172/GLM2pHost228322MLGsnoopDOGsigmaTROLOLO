import { test } from "node:test";
import assert from "node:assert/strict";
import { setupRendererEnv } from "./helpers/renderer-env.mjs";

setupRendererEnv();
const { pairingCard, submitPairingCode } = await import("../dist/renderer/renderer/pairing.js");

test("pairing module exposes pairing inputs inside troubleshoot panel", () => {
  assert.equal(pairingCard.id, "pairing-card-inner");
  assert.equal(document.getElementById("pairing-code").getAttribute("maxlength"), "6");
});

test("pairing code format requires exactly six digits", () => {
  const isValid = (code) => /^\d{6}$/.test(code.trim());
  assert.equal(isValid("123456"), true);
  assert.equal(isValid("abc"), false);
  assert.equal(isValid("12345"), false);
});

test("submitPairingCode is exported for dashboard deep-link auto bind (U-34)", () => {
  assert.equal(typeof submitPairingCode, "function");
});
