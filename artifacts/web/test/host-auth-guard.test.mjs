import { test } from "node:test";
import assert from "node:assert/strict";

const {
  HOST_AUTH_ACTIVE_PATH,
  HOST_REGISTER_FEATURES,
  canSubmitHostRegistration,
  buildHostRegisterRequest,
  persistHostTokenClipboard,
} = await import("../src/lib/host-auth-guard.ts");

test("HOST_AUTH_ACTIVE_PATH is /host", () => {
  assert.equal(HOST_AUTH_ACTIVE_PATH, "/host");
});

test("HOST_REGISTER_FEATURES lists three host selling points", () => {
  assert.equal(HOST_REGISTER_FEATURES.length, 3);
  assert.equal(HOST_REGISTER_FEATURES[0].title, "P2P стриминг");
  assert.equal(HOST_REGISTER_FEATURES[1].title, "Крипто-выплаты");
  assert.equal(HOST_REGISTER_FEATURES[2].title, "Агент хоста");
  assert.equal(HOST_REGISTER_FEATURES[0].text, "WebRTC напрямую");
});

test("canSubmitHostRegistration requires non-empty trimmed name and not pending", () => {
  assert.equal(canSubmitHostRegistration("RTX_4090", false), true);
  assert.equal(canSubmitHostRegistration("  Beast  ", false), true);
  assert.equal(canSubmitHostRegistration("", false), false);
  assert.equal(canSubmitHostRegistration("   ", false), false);
  assert.equal(canSubmitHostRegistration("RTX_4090", true), false);
});

test("buildHostRegisterRequest returns null for blank displayName", () => {
  assert.equal(buildHostRegisterRequest(""), null);
  assert.equal(buildHostRegisterRequest("   "), null);
});

test("buildHostRegisterRequest trims displayName in payload", () => {
  assert.deepEqual(buildHostRegisterRequest("  RTX_4090  "), {
    data: { displayName: "RTX_4090" },
  });
});

test("persistHostTokenClipboard returns copied when clipboard succeeds", async () => {
  const result = await persistHostTokenClipboard("host-token-1", async (text) => {
    assert.equal(text, "host-token-1");
  });
  assert.equal(result, "copied");
});

test("persistHostTokenClipboard returns registered when clipboard fails", async () => {
  const result = await persistHostTokenClipboard("host-token-2", async () => {
    throw new Error("denied");
  });
  assert.equal(result, "registered");
});
