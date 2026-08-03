import "../test/setup-renderer-dom.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { elements } from "../test/setup-renderer-dom.mjs";

await import("../dist/renderer/renderer/steam-auto-host.js");

test("steam-auto-host exports auto steam card", async () => {
  const { autoSteamCard } = await import("../dist/renderer/renderer/steam-auto-host.js");
  assert.equal(autoSteamCard, elements.get("auto-steam-card"));
});

test("auto steam publish button exists", () => {
  assert.ok(elements.get("auto-steam-publish"));
});
