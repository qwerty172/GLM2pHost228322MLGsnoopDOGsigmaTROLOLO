import { test } from "node:test";
import assert from "node:assert/strict";

const {
  PLAYER_WALLET_STORAGE_KEY,
  PLAYER_GUEST_STORAGE_KEY,
  readIsGuestFromStorage,
  registerGuestWallet,
  upgradeGuestWallet,
} = await import("../src/hooks/use-player-wallet.tsx");

function mockStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem(key) {
      return data[key] ?? null;
    },
    setItem(key, value) {
      data[key] = value;
    },
    removeItem(key) {
      delete data[key];
    },
    data,
  };
}

test("PLAYER_WALLET_STORAGE_KEY is streamline.playerWalletToken", () => {
  assert.equal(PLAYER_WALLET_STORAGE_KEY, "streamline.playerWalletToken");
});

test("PLAYER_GUEST_STORAGE_KEY is streamline.playerIsGuest", () => {
  assert.equal(PLAYER_GUEST_STORAGE_KEY, "streamline.playerIsGuest");
});

test("readIsGuestFromStorage is true only for literal true", () => {
  assert.equal(readIsGuestFromStorage("true"), true);
  assert.equal(readIsGuestFromStorage("false"), false);
  assert.equal(readIsGuestFromStorage(null), false);
});

test("registerGuestWallet returns existing token without API call", async () => {
  let called = false;
  const storage = mockStorage({ [PLAYER_WALLET_STORAGE_KEY]: "existing-token" });
  const result = await registerGuestWallet(async () => {
    called = true;
    return { playerToken: "new" };
  }, storage);
  assert.deepEqual(result, { existing: "existing-token" });
  assert.equal(called, false);
});

test("registerGuestWallet persists guest token on success", async () => {
  const storage = mockStorage();
  const result = await registerGuestWallet(async () => ({ playerToken: "guest-1" }), storage);
  assert.deepEqual(result, { token: "guest-1" });
  assert.equal(storage.data[PLAYER_WALLET_STORAGE_KEY], "guest-1");
  assert.equal(storage.data[PLAYER_GUEST_STORAGE_KEY], "true");
});

test("registerGuestWallet returns error message on failure", async () => {
  const storage = mockStorage();
  const result = await registerGuestWallet(async () => {
    throw new Error("offline");
  }, storage);
  assert.deepEqual(result, { error: "Не удалось создать гостевой кошелёк" });
  assert.equal(storage.data[PLAYER_WALLET_STORAGE_KEY], undefined);
});

test("upgradeGuestWallet returns null when not guest", async () => {
  const storage = mockStorage({ [PLAYER_WALLET_STORAGE_KEY]: "guest-1" });
  const result = await upgradeGuestWallet("Игрок", false, async () => ({ playerToken: "full-1" }), storage);
  assert.equal(result, null);
});

test("upgradeGuestWallet returns null when token missing", async () => {
  const storage = mockStorage();
  const result = await upgradeGuestWallet("Игрок", true, async () => ({ playerToken: "full-1" }), storage);
  assert.equal(result, null);
});

test("upgradeGuestWallet persists full token and clears guest flag", async () => {
  const storage = mockStorage({
    [PLAYER_WALLET_STORAGE_KEY]: "guest-1",
    [PLAYER_GUEST_STORAGE_KEY]: "true",
  });
  const result = await upgradeGuestWallet(
    "  Игрок  ",
    true,
    async ({ guestToken, displayName }) => {
      assert.equal(guestToken, "guest-1");
      assert.equal(displayName, "Игрок");
      return { playerToken: "full-1" };
    },
    storage,
  );
  assert.deepEqual(result, { token: "full-1" });
  assert.equal(storage.data[PLAYER_WALLET_STORAGE_KEY], "full-1");
  assert.equal(storage.data[PLAYER_GUEST_STORAGE_KEY], undefined);
});

test("upgradeGuestWallet returns null on API failure", async () => {
  const storage = mockStorage({
    [PLAYER_WALLET_STORAGE_KEY]: "guest-1",
    [PLAYER_GUEST_STORAGE_KEY]: "true",
  });
  const result = await upgradeGuestWallet("Игрок", true, async () => {
    throw new Error("409");
  }, storage);
  assert.equal(result, null);
  assert.equal(storage.data[PLAYER_WALLET_STORAGE_KEY], "guest-1");
});
