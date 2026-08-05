import { test } from "node:test";
import assert from "node:assert/strict";

const { ICE_CONNECTION_LABELS, ICE_TONE_STYLES } = await import(
  "../src/lib/connection-labels.ts"
);

test("ICE_CONNECTION_LABELS covers all connection kinds", () => {
  assert.deepEqual(Object.keys(ICE_CONNECTION_LABELS).sort(), ["host", "relay", "srflx"]);
});

test("ICE_CONNECTION_LABELS uses Russian copy without TURN/STUN jargon", () => {
  for (const kind of ["host", "srflx", "relay"]) {
    const entry = ICE_CONNECTION_LABELS[kind];
    assert.match(entry.short, /[А-Яа-яЁё]/);
    assert.match(entry.hint, /[А-Яа-яЁё]/);
    assert.ok(!/TURN|STUN/i.test(entry.short));
    assert.ok(!/TURN|STUN/i.test(entry.hint));
  }
});

test("ICE_CONNECTION_LABELS assigns expected tones", () => {
  assert.equal(ICE_CONNECTION_LABELS.host.tone, "good");
  assert.equal(ICE_CONNECTION_LABELS.srflx.tone, "ok");
  assert.equal(ICE_CONNECTION_LABELS.relay.tone, "warn");
});

test("ICE_TONE_STYLES covers all tones with hex colors", () => {
  assert.deepEqual(Object.keys(ICE_TONE_STYLES).sort(), ["good", "ok", "warn"]);
  for (const tone of ["good", "ok", "warn"]) {
    assert.match(ICE_TONE_STYLES[tone].border, /^#[0-9a-f]{6}$/i);
    assert.match(ICE_TONE_STYLES[tone].color, /^#[0-9a-f]{6}$/i);
  }
});

test("relay tone uses distinct warn palette", () => {
  assert.equal(ICE_TONE_STYLES.warn.border, "#a855f7");
  assert.equal(ICE_TONE_STYLES.warn.color, "#c084fc");
});
