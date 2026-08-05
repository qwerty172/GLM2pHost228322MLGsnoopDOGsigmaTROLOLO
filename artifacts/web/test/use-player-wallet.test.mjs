import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

const {
  PLAYER_WALLET_STORAGE_KEY,
  PLAYER_GUEST_STORAGE_KEY,
  readIsGuestFromStorage,
  persistGuestWalletToken,
  persistUpgradedWalletToken,
  registerGuestWallet,
  upgradeGuestWallet,
} = await import("../src/hooks/use-player-wallet.tsx");

const storage = new Map();

beforeEach(() => {
  storage.clear();
  globalThis.localStorage = {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => {
      storage.set(key, String(value));
    },
    removeItem: (key) => {
      storage.delete(key);
    },
  };
});

afterEach(() => {
  delete globalThis.localStorage;
});

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
  assert.equal(readIsGuestFromStorage(""), false);
});

test("persistGuestWalletToken stores token and guest flag", () => {
  persistGuestWalletToken("guest-token-1");
  assert.equal(storage.get(PLAYER_WALLET_STORAGE_KEY), "guest-token-1");
  assert.equal(storage.get(PLAYER_GUEST_STORAGE_KEY), "true");
});

test("persistUpgradedWalletToken stores token and clears guest flag", () => {
  storage.set(PLAYER_GUEST_STORAGE_KEY, "true");
  persistUpgradedWalletToken("full-token-1");
  assert.equal(storage.get(PLAYER_WALLET_STORAGE_KEY), "full-token-1");
  assert.equal(storage.has(PLAYER_GUEST_STORAGE_KEY), false);
});

test("registerGuestWallet returns cached token without API call", async () => {
  let called = false;
  const result = await registerGuestWallet("existing-token", async () => {
    called = true;
    return { playerToken: "new" };
  });
  assert.equal(result.ok, true);
  assert.equal(result.token, "existing-token");
  assert.equal(result.cached, true);
  assert.equal(called, false);
});

test("registerGuestWallet persists token on success", async () => {
  const result = await registerGuestWallet(null, async () => ({
    playerToken: "guest-abc",
    internalBalanceLzt: 400,
  }));
  assert.deepEqual(result, {
    ok: true,
    token: "guest-abc",
    welcomeBonusLzt: 400,
  });
  assert.equal(storage.get(PLAYER_WALLET_STORAGE_KEY), "guest-abc");
  assert.equal(storage.get(PLAYER_GUEST_STORAGE_KEY), "true");
});

test("registerGuestWallet returns error on API failure", async () => {
  const result = await registerGuestWallet(null, async () => {
    throw new Error("network");
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, "Не удалось создать гостевой кошелёк");
  assert.equal(storage.has(PLAYER_WALLET_STORAGE_KEY), false);
});

test("upgradeGuestWallet returns false without guest token", async () => {
  const ok = await upgradeGuestWallet(null, true, "Player", async () => ({
    playerToken: "full",
  }));
  assert.equal(ok, false);
});

test("upgradeGuestWallet returns false when not guest", async () => {
  const ok = await upgradeGuestWallet("token", false, "Player", async () => ({
    playerToken: "full",
  }));
  assert.equal(ok, false);
});

test("upgradeGuestWallet trims displayName and persists upgraded token", async () => {
  storage.set(PLAYER_WALLET_STORAGE_KEY, "guest-old");
  storage.set(PLAYER_GUEST_STORAGE_KEY, "true");
  const ok = await upgradeGuestWallet("guest-old", true, "  Игрок  ", async (body) => {
    assert.deepEqual(body, { guestToken: "guest-old", displayName: "Игрок" });
    return { playerToken: "full-new" };
  });
  assert.equal(ok, true);
  assert.equal(storage.get(PLAYER_WALLET_STORAGE_KEY), "full-new");
  assert.equal(storage.has(PLAYER_GUEST_STORAGE_KEY), false);
});

test("upgradeGuestWallet returns false on API failure", async () => {
  const ok = await upgradeGuestWallet("guest-old", true, "Player", async () => {
    throw new Error("409");
  });
  assert.equal(ok, false);
});
