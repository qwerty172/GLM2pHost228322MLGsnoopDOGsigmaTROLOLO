import { test } from "node:test";
import assert from "node:assert/strict";

const { ICE_CONNECTION_LABELS, ICE_TONE_STYLES } = await import(
  "../src/lib/connection-labels.ts"
);

test("ICE_CONNECTION_LABELS covers all connection kinds in Russian", () => {
  assert.deepEqual(Object.keys(ICE_CONNECTION_LABELS).sort(), ["host", "relay", "srflx"]);
  for (const kind of ["host", "relay", "srflx"]) {
    const entry = ICE_CONNECTION_LABELS[kind];
    assert.match(entry.short, /[А-Яа-яЁё]/, `${kind}.short should be Russian`);
    assert.match(entry.hint, /[А-Яа-яЁё]/, `${kind}.hint should be Russian`);
    assert.ok(["good", "ok", "warn"].includes(entry.tone), `${kind}.tone`);
  }
});

test("host uses good tone, relay uses warn tone", () => {
  assert.equal(ICE_CONNECTION_LABELS.host.tone, "good");
  assert.equal(ICE_CONNECTION_LABELS.srflx.tone, "ok");
  assert.equal(ICE_CONNECTION_LABELS.relay.tone, "warn");
});

test("ICE_TONE_STYLES defines border and color for each tone", () => {
  for (const tone of ["good", "ok", "warn"]) {
    const style = ICE_TONE_STYLES[tone];
    assert.match(style.border, /^#[0-9a-f]{6}$/i, `${tone}.border`);
    assert.match(style.color, /^#[0-9a-f]{6}$/i, `${tone}.color`);
  }
});
