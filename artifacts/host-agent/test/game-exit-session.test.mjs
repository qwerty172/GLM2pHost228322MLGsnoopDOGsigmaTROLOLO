import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldEndSessionOnGameExit } from "../dist/main/shared/game-exit-session.js";

test("shouldEndSessionOnGameExit allows teardown only when session ids match", () => {
  assert.equal(shouldEndSessionOnGameExit("sess-a", "sess-a"), true);
  assert.equal(shouldEndSessionOnGameExit("sess-a", "sess-b"), false);
  assert.equal(shouldEndSessionOnGameExit("sess-a", null), false);
  assert.equal(shouldEndSessionOnGameExit(null, "sess-b"), false);
  assert.equal(shouldEndSessionOnGameExit("  sess-a  ", "sess-a"), true);
});
