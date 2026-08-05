import { test } from "node:test";
import assert from "node:assert/strict";

const { ICE_CONNECTION_LABELS, ICE_TONE_STYLES } = await import("../src/lib/connection-labels.ts");

test("ICE_CONNECTION_LABELS covers all connection kinds with Russian labels", () => {
  assert.deepEqual(Object.keys(ICE_CONNECTION_LABELS).sort(), ["host", "relay", "srflx"]);
  assert.equal(ICE_CONNECTION_LABELS.host.short, "Прямое");
  assert.equal(ICE_CONNECTION_LABELS.srflx.short, "Через сеть");
  assert.equal(ICE_CONNECTION_LABELS.relay.short, "Через сервер");
});

test("ICE_CONNECTION_LABELS assigns tone per connection kind", () => {
  assert.equal(ICE_CONNECTION_LABELS.host.tone, "good");
  assert.equal(ICE_CONNECTION_LABELS.srflx.tone, "ok");
  assert.equal(ICE_CONNECTION_LABELS.relay.tone, "warn");
});

test("ICE_CONNECTION_LABELS hints are non-empty Russian strings", () => {
  for (const kind of ["host", "srflx", "relay"]) {
    const hint = ICE_CONNECTION_LABELS[kind].hint;
    assert.ok(hint.length > 10, `${kind} hint should be descriptive`);
    assert.match(hint, /[А-Яа-яЁё]/, `${kind} hint should be Russian`);
  }
});

test("ICE_TONE_STYLES maps every tone to border and color", () => {
  for (const tone of ["good", "ok", "warn"]) {
    assert.match(ICE_TONE_STYLES[tone].border, /^#[0-9a-f]{6}$/i);
    assert.match(ICE_TONE_STYLES[tone].color, /^#[0-9a-f]{6}$/i);
  }
});

test("ICE_TONE_STYLES uses purple for warn tone", () => {
  assert.equal(ICE_TONE_STYLES.warn.border, "#a855f7");
  assert.equal(ICE_TONE_STYLES.warn.color, "#c084fc");
});
