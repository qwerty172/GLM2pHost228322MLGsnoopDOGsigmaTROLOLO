import { test } from "node:test";
import assert from "node:assert/strict";

const { ICE_CONNECTION_LABELS, ICE_TONE_STYLES } = await import("../src/lib/connection-labels.ts");

test("ICE_CONNECTION_LABELS covers all connection kinds with Russian copy", () => {
  assert.deepEqual(Object.keys(ICE_CONNECTION_LABELS).sort(), ["host", "relay", "srflx"]);
  assert.equal(ICE_CONNECTION_LABELS.host.short, "Прямое");
  assert.equal(ICE_CONNECTION_LABELS.srflx.short, "Через сеть");
  assert.equal(ICE_CONNECTION_LABELS.relay.short, "Через сервер");
  assert.match(ICE_CONNECTION_LABELS.relay.hint, /задержк/i);
});

test("ICE_CONNECTION_LABELS tone matches UX severity", () => {
  assert.equal(ICE_CONNECTION_LABELS.host.tone, "good");
  assert.equal(ICE_CONNECTION_LABELS.srflx.tone, "ok");
  assert.equal(ICE_CONNECTION_LABELS.relay.tone, "warn");
});

test("ICE_TONE_STYLES provides border and color for each tone", () => {
  for (const tone of ["good", "ok", "warn"]) {
    assert.match(ICE_TONE_STYLES[tone].border, /^#[0-9a-f]{6}$/i);
    assert.match(ICE_TONE_STYLES[tone].color, /^#[0-9a-f]{6}$/i);
  }
  assert.equal(ICE_TONE_STYLES.warn.border, "#a855f7");
});
