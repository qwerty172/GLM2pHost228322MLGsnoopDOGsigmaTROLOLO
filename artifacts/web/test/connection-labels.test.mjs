import { test } from "node:test";
import assert from "node:assert/strict";

const { ICE_CONNECTION_LABELS, ICE_TONE_STYLES } = await import("../src/lib/connection-labels.ts");

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

test("ICE_TONE_STYLES provides border and color for each tone", () => {
  for (const tone of ["good", "ok", "warn"]) {
    assert.ok(ICE_TONE_STYLES[tone].border.startsWith("#"));
    assert.ok(ICE_TONE_STYLES[tone].color.startsWith("#"));
  }

  assert.equal(ICE_TONE_STYLES.good.border, ICE_TONE_STYLES.ok.border);
  assert.notEqual(ICE_TONE_STYLES.warn.border, ICE_TONE_STYLES.good.border);
});
