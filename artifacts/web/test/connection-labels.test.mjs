import { test } from "node:test";
import assert from "node:assert/strict";

const { ICE_CONNECTION_LABELS, ICE_TONE_STYLES } = await import("../src/lib/connection-labels.ts");

test("ICE_CONNECTION_LABELS covers all connection kinds with Russian copy", () => {
  for (const kind of ["host", "srflx", "relay"]) {
    const entry = ICE_CONNECTION_LABELS[kind];
    assert.ok(entry.short.length > 0, `${kind} short label`);
    assert.ok(entry.hint.length > 0, `${kind} hint`);
    assert.ok(["good", "ok", "warn"].includes(entry.tone), `${kind} tone`);
  }
});

test("ICE_CONNECTION_LABELS tone mapping matches product expectations", () => {
  assert.equal(ICE_CONNECTION_LABELS.host.tone, "good");
  assert.equal(ICE_CONNECTION_LABELS.srflx.tone, "ok");
  assert.equal(ICE_CONNECTION_LABELS.relay.tone, "warn");
});

test("ICE_TONE_STYLES provides border and color for each tone", () => {
  for (const tone of ["good", "ok", "warn"]) {
    const style = ICE_TONE_STYLES[tone];
    assert.match(style.border, /^#[0-9a-f]{6}$/i, `${tone} border`);
    assert.match(style.color, /^#[0-9a-f]{6}$/i, `${tone} color`);
  }
});
