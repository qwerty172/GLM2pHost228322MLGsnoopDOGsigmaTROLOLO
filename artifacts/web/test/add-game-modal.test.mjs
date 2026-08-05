import { test } from "node:test";
import assert from "node:assert/strict";

test("add-game-modal exports shared AddGameModal and QuickAddFirstGame", async () => {
  const mod = await import("../src/pages/host/add-game-modal.tsx");
  assert.equal(typeof mod.AddGameModal, "function");
  assert.equal(typeof mod.QuickAddFirstGame, "function");
});
