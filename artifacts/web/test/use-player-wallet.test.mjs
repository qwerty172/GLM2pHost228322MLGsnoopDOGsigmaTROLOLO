import { test, mock, afterEach } from "node:test";
import assert from "node:assert/strict";

const {
  PLAYER_WALLET_TOKEN_KEY,
  PLAYER_IS_GUEST_KEY,
  readPlayerIsGuestFromStorage,
  registerGuestPlayerWallet,
  upgradeGuestPlayerWallet,
} = await import("../src/hooks/use-player-wallet.tsx");

const storage = new Map();

function mockLocalStorage() {
  storage.clear();
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  };
}

afterEach(() => {
  mock.restoreAll();
  delete globalThis.localStorage;
  storage.clear();
});

test("PLAYER_WALLET_TOKEN_KEY is streamline.playerWalletToken", () => {
  assert.equal(PLAYER_WALLET_TOKEN_KEY, "streamline.playerWalletToken");
});

test("PLAYER_IS_GUEST_KEY is streamline.playerIsGuest", () => {
  assert.equal(PLAYER_IS_GUEST_KEY, "streamline.playerIsGuest");
});

test("readPlayerIsGuestFromStorage is true when guest flag stored", () => {
  mockLocalStorage();
  storage.set(PLAYER_IS_GUEST_KEY, "true");
  assert.equal(readPlayerIsGuestFromStorage(), true);
});

test("readPlayerIsGuestFromStorage is false when guest flag missing", () => {
  mockLocalStorage();
  assert.equal(readPlayerIsGuestFromStorage(), false);
});

test("registerGuestPlayerWallet returns existing token without API call", async () => {
  mockLocalStorage();
  storage.set(PLAYER_WALLET_TOKEN_KEY, "existing-token");
  let called = false;
  const result = await registerGuestPlayerWallet(async () => {
    called = true;
    return { playerToken: "new" };
  });
  assert.equal(called, false);
  assert.equal(result.token, "existing-token");
  assert.equal(result.error, null);
});

test("registerGuestPlayerWallet persists token and guest flag on success", async () => {
  mockLocalStorage();
  const result = await registerGuestPlayerWallet(async () => ({ playerToken: "guest-1" }));
  assert.equal(result.token, "guest-1");
  assert.equal(result.error, null);
  assert.equal(storage.get(PLAYER_WALLET_TOKEN_KEY), "guest-1");
  assert.equal(storage.get(PLAYER_IS_GUEST_KEY), "true");
});

test("registerGuestPlayerWallet returns error on failure", async () => {
  mockLocalStorage();
  const result = await registerGuestPlayerWallet(async () => {
    throw new Error("network");
  });
  assert.equal(result.token, null);
  assert.equal(result.error, "Не удалось создать гостевой кошелёк");
});

test("upgradeGuestPlayerWallet returns false when not guest", async () => {
  mockLocalStorage();
  storage.set(PLAYER_WALLET_TOKEN_KEY, "guest-1");
  const result = await upgradeGuestPlayerWallet("Игрок", "guest-1", false);
  assert.equal(result.success, false);
  assert.equal(result.token, null);
});

test("upgradeGuestPlayerWallet trims displayName and persists full token", async () => {
  mockLocalStorage();
  storage.set(PLAYER_WALLET_TOKEN_KEY, "guest-1");
  storage.set(PLAYER_IS_GUEST_KEY, "true");
  let capturedName = null;
  const result = await upgradeGuestPlayerWallet(
    "  Игрок  ",
    "guest-1",
    true,
    async ({ displayName }) => {
      capturedName = displayName;
      return { playerToken: "full-1" };
    },
  );
  assert.equal(capturedName, "Игрок");
  assert.equal(result.success, true);
  assert.equal(result.token, "full-1");
  assert.equal(storage.get(PLAYER_WALLET_TOKEN_KEY), "full-1");
  assert.equal(storage.has(PLAYER_IS_GUEST_KEY), false);
});

test("upgradeGuestPlayerWallet returns false on API failure", async () => {
  mockLocalStorage();
  const result = await upgradeGuestPlayerWallet("Игрок", "guest-1", true, async () => {
    throw new Error("409");
  });
  assert.equal(result.success, false);
  assert.equal(result.token, null);
});
