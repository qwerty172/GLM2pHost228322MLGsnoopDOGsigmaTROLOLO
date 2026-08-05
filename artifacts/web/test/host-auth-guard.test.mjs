import { test } from "node:test";
import assert from "node:assert/strict";

const {
  HOST_AUTH_FEATURES,
  HOST_AUTH_REGISTER_TOAST,
  HOST_AUTH_EXISTING_TOKEN_TOAST,
  isHostDisplayNameValid,
  isExistingHostTokenValid,
  validateExistingHostToken,
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

test("HOST_AUTH_EXISTING_TOKEN_TOAST messages are Russian", () => {
  assert.match(HOST_AUTH_EXISTING_TOKEN_TOAST.success("Beast"), /Вход выполнен/);
  assert.match(HOST_AUTH_EXISTING_TOKEN_TOAST.error, /Токен не найден/);
});

test("isExistingHostTokenValid rejects empty and whitespace-only tokens", () => {
  assert.equal(isExistingHostTokenValid(""), false);
  assert.equal(isExistingHostTokenValid("   "), false);
});

test("isExistingHostTokenValid accepts non-empty trimmed tokens", () => {
  assert.equal(isExistingHostTokenValid("abc123"), true);
  assert.equal(isExistingHostTokenValid("  token  "), true);
});

test("validateExistingHostToken returns displayName on success", async () => {
  const result = await validateExistingHostToken("tok-1", async () => ({
    displayName: "RTX_4090",
  }));
  assert.deepEqual(result, { ok: true, displayName: "RTX_4090" });
});

test("validateExistingHostToken trims token before lookup", async () => {
  let lookedUp = "";
  await validateExistingHostToken("  tok-1  ", async (token) => {
    lookedUp = token;
    return { displayName: "Beast" };
  });
  assert.equal(lookedUp, "tok-1");
});

test("validateExistingHostToken returns ok:false on lookup failure", async () => {
  const result = await validateExistingHostToken("bad", async () => {
    throw new Error("404");
  });
  assert.deepEqual(result, { ok: false });
});

test("validateExistingHostToken returns ok:false for blank input", async () => {
  const result = await validateExistingHostToken("  ", async () => {
    throw new Error("should not be called");
  });
  assert.deepEqual(result, { ok: false });
});
