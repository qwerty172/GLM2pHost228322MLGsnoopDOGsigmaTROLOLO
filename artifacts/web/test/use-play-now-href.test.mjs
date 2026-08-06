import { test } from "node:test";
import assert from "node:assert/strict";
import { isPlayNavActive } from "../src/hooks/use-play-now-href.ts";

test("isPlayNavActive highlights play, games and hosts routes", () => {
  assert.equal(isPlayNavActive("/play/i/INV"), true);
  assert.equal(isPlayNavActive("/play/token"), true);
  assert.equal(isPlayNavActive("/games"), true);
  assert.equal(isPlayNavActive("/hosts"), true);
  assert.equal(isPlayNavActive("/host"), false);
  assert.equal(isPlayNavActive(undefined), false);
});
