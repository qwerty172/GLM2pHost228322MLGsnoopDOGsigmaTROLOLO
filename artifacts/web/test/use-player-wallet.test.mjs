import { test } from "node:test";
import assert from "node:assert/strict";

const {
  PLAYER_WALLET_STORAGE_KEY,
  PLAYER_GUEST_STORAGE_KEY,
  readIsGuestFromStorage,
  registerGuestWallet,
  upgradeGuestWallet,
} = await import("../src/hooks/use-player-wallet.tsx");

function makeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
    map,
  };
}

test("storage keys are streamline.playerWalletToken and streamline.playerIsGuest", () => {
  assert.equal(PLAYER_WALLET_STORAGE_KEY, "streamline.playerWalletToken");
  assert.equal(PLAYER_GUEST_STORAGE_KEY, "streamline.playerIsGuest");
});

test("readIsGuestFromStorage is true only when value is 'true'", () => {
  assert.equal(readIsGuestFromStorage("true"), true);
  assert.equal(readIsGuestFromStorage("false"), false);
  assert.equal(readIsGuestFromStorage(null), false);
});

test("registerGuestWallet returns existing token without API call", async () => {
  let called = false;
  const storage = makeStorage({ [PLAYER_WALLET_STORAGE_KEY]: "existing-token" });
  const result = await registerGuestWallet(async () => {
    called = true;
    return { playerToken: "new" };
  }, storage);
  assert.deepEqual(result, { token: "existing-token" });
  assert.equal(called, false);
});

test("registerGuestWallet persists guest token on success", async () => {
  const storage = makeStorage();
  const result = await registerGuestWallet(async () => ({ playerToken: "guest-1" }), storage);
  assert.deepEqual(result, { token: "guest-1" });
  assert.equal(storage.getItem(PLAYER_WALLET_STORAGE_KEY), "guest-1");
  assert.equal(storage.getItem(PLAYER_GUEST_STORAGE_KEY), "true");
});

test("registerGuestWallet returns error message on failure", async () => {
  const storage = makeStorage();
  const result = await registerGuestWallet(async () => {
    throw new Error("network");
  }, storage);
  assert.deepEqual(result, { error: "Не удалось создать гостевой кошелёк" });
  assert.equal(storage.getItem(PLAYER_WALLET_STORAGE_KEY), null);
});

test("upgradeGuestWallet returns false without guest token or guest flag", async () => {
  const storage = makeStorage();
  const result = await upgradeGuestWallet(
    async () => ({ playerToken: "full-1" }),
    storage,
    "Player",
    false,
  );
  assert.equal(result, false);
});

test("upgradeGuestWallet persists full token and clears guest flag", async () => {
  const storage = makeStorage({
    [PLAYER_WALLET_STORAGE_KEY]: "guest-1",
    [PLAYER_GUEST_STORAGE_KEY]: "true",
  });
  const result = await upgradeGuestWallet(
    async ({ guestToken, displayName }) => {
      assert.equal(guestToken, "guest-1");
      assert.equal(displayName, "Alice");
      return { playerToken: "full-1" };
    },
    storage,
    "  Alice  ",
    true,
  );
  assert.deepEqual(result, { token: "full-1" });
  assert.equal(storage.getItem(PLAYER_WALLET_STORAGE_KEY), "full-1");
  assert.equal(storage.getItem(PLAYER_GUEST_STORAGE_KEY), null);
});

test("upgradeGuestWallet returns false on API failure", async () => {
  const storage = makeStorage({
    [PLAYER_WALLET_STORAGE_KEY]: "guest-1",
    [PLAYER_GUEST_STORAGE_KEY]: "true",
  });
  const result = await upgradeGuestWallet(
    async () => {
      throw new Error("409");
    },
    storage,
    "Bob",
    true,
  );
  assert.equal(result, false);
  assert.equal(storage.getItem(PLAYER_WALLET_STORAGE_KEY), "guest-1");
});
