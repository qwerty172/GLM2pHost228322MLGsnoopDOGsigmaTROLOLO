import { test } from "node:test";
import assert from "node:assert/strict";

const {
  HOST_AUTH_FEATURES,
  HOST_AUTH_REGISTER_TOAST,
  isHostDisplayNameValid,
} = await import("../src/components/host-auth-guard.tsx");

test("HOST_AUTH_FEATURES lists three host onboarding highlights", () => {
  assert.equal(HOST_AUTH_FEATURES.length, 3);
  assert.deepEqual(
    HOST_AUTH_FEATURES.map((f) => f.title),
    ["P2P стриминг", "Крипто-выплаты", "Агент хоста"],
  );
  assert.equal(HOST_AUTH_FEATURES[0].text, "WebRTC напрямую");
  assert.equal(HOST_AUTH_FEATURES[1].text, "95% дохода тебе");
  assert.equal(HOST_AUTH_FEATURES[2].text, "Простая установка");
});

test("HOST_AUTH_REGISTER_TOAST messages are Russian", () => {
  assert.match(HOST_AUTH_REGISTER_TOAST.clipboardOk, /Узел создан/);
  assert.match(HOST_AUTH_REGISTER_TOAST.clipboardFail, /зарегистрирован/);
  assert.match(HOST_AUTH_REGISTER_TOAST.error, /Не удалось/);
});

test("isHostDisplayNameValid rejects empty and whitespace-only names", () => {
  assert.equal(isHostDisplayNameValid(""), false);
  assert.equal(isHostDisplayNameValid("   "), false);
  assert.equal(isHostDisplayNameValid("\t\n"), false);
});

test("isHostDisplayNameValid accepts non-empty trimmed names", () => {
  assert.equal(isHostDisplayNameValid("RTX_4090"), true);
  assert.equal(isHostDisplayNameValid("  Beast  "), true);
});
