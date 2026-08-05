import { test } from "node:test";
import assert from "node:assert/strict";

const { ICE_CONNECTION_LABELS, ICE_TONE_STYLES } = await import(
  "../src/lib/connection-labels.ts"
);

test("ICE_CONNECTION_LABELS covers all connection kinds with Russian labels", () => {
  assert.deepEqual(Object.keys(ICE_CONNECTION_LABELS).sort(), ["host", "relay", "srflx"]);

  assert.equal(ICE_CONNECTION_LABELS.host.short, "Прямое");
  assert.equal(ICE_CONNECTION_LABELS.host.tone, "good");
  assert.match(ICE_CONNECTION_LABELS.host.hint, /Оптимальное/);

  assert.equal(ICE_CONNECTION_LABELS.srflx.short, "Через сеть");
  assert.equal(ICE_CONNECTION_LABELS.srflx.tone, "ok");

  assert.equal(ICE_CONNECTION_LABELS.relay.short, "Через сервер");
  assert.equal(ICE_CONNECTION_LABELS.relay.tone, "warn");
  assert.match(ICE_CONNECTION_LABELS.relay.hint, /VPN/);
});

test("ICE_TONE_STYLES maps tones to border and color hex", () => {
  assert.deepEqual(Object.keys(ICE_TONE_STYLES).sort(), ["good", "ok", "warn"]);

  for (const tone of ["good", "ok", "warn"]) {
    const style = ICE_TONE_STYLES[tone];
    assert.match(style.border, /^#[0-9a-f]{6}$/i);
    assert.match(style.color, /^#[0-9a-f]{6}$/i);
  }

  assert.equal(ICE_TONE_STYLES.good.border, "#22c55e");
  assert.equal(ICE_TONE_STYLES.warn.border, "#a855f7");
});
