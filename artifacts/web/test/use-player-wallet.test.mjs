import { test } from "node:test";
import assert from "node:assert/strict";

const {
  PLAYER_WALLET_STORAGE_KEY,
  PLAYER_GUEST_STORAGE_KEY,
  readStoredPlayerWalletToken,
  readStoredIsGuest,
  registerGuestPlayerWallet,
  upgradeGuestPlayerWallet,
} = await import("../src/hooks/use-player-wallet.tsx");

function createStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
    clear: () => map.clear(),
  };
}

test("storage keys are streamline.player*", () => {
  assert.equal(PLAYER_WALLET_STORAGE_KEY, "streamline.playerWalletToken");
  assert.equal(PLAYER_GUEST_STORAGE_KEY, "streamline.playerIsGuest");
});

test("readStoredPlayerWalletToken and readStoredIsGuest read localStorage", () => {
  const storage = createStorage();
  globalThis.localStorage = storage;
  try {
    assert.equal(readStoredPlayerWalletToken(), null);
    assert.equal(readStoredIsGuest(), false);

    storage.setItem(PLAYER_WALLET_STORAGE_KEY, "tok-1");
    storage.setItem(PLAYER_GUEST_STORAGE_KEY, "true");
    assert.equal(readStoredPlayerWalletToken(), "tok-1");
    assert.equal(readStoredIsGuest(), true);
  } finally {
    delete globalThis.localStorage;
  }
});

test("registerGuestPlayerWallet returns existing token without API call", async () => {
  const storage = createStorage();
  globalThis.localStorage = storage;
  storage.setItem(PLAYER_WALLET_STORAGE_KEY, "existing");
  let called = false;
  try {
    const result = await registerGuestPlayerWallet(async () => {
      called = true;
      return { playerToken: "new" };
    });
    assert.equal(called, false);
    assert.deepEqual(result, { token: "existing", created: false });
  } finally {
    delete globalThis.localStorage;
  }
});

test("registerGuestPlayerWallet persists guest token on success", async () => {
  const storage = createStorage();
  globalThis.localStorage = storage;
  try {
    const result = await registerGuestPlayerWallet(async () => ({
      playerToken: "guest-abc",
    }));
    assert.deepEqual(result, { token: "guest-abc", created: true });
    assert.equal(storage.getItem(PLAYER_WALLET_STORAGE_KEY), "guest-abc");
    assert.equal(storage.getItem(PLAYER_GUEST_STORAGE_KEY), "true");
  } finally {
    delete globalThis.localStorage;
  }
});

test("registerGuestPlayerWallet returns error message on failure", async () => {
  const storage = createStorage();
  globalThis.localStorage = storage;
  try {
    const result = await registerGuestPlayerWallet(async () => {
      throw new Error("network");
    });
    assert.deepEqual(result, { error: "Не удалось создать гостевой кошелёк" });
    assert.equal(storage.getItem(PLAYER_WALLET_STORAGE_KEY), null);
  } finally {
    delete globalThis.localStorage;
  }
});

test("upgradeGuestPlayerWallet returns false when not guest or no token", async () => {
  const storage = createStorage();
  globalThis.localStorage = storage;
  try {
    assert.equal(await upgradeGuestPlayerWallet("Alice", false), false);
    storage.setItem(PLAYER_WALLET_STORAGE_KEY, "tok");
    assert.equal(await upgradeGuestPlayerWallet("Alice", false), false);
  } finally {
    delete globalThis.localStorage;
  }
});

test("upgradeGuestPlayerWallet upgrades guest and clears guest flag", async () => {
  const storage = createStorage();
  globalThis.localStorage = storage;
  storage.setItem(PLAYER_WALLET_STORAGE_KEY, "guest-tok");
  storage.setItem(PLAYER_GUEST_STORAGE_KEY, "true");
  try {
    const upgraded = await upgradeGuestPlayerWallet("  Bob  ", true, async (body) => {
      assert.equal(body.guestToken, "guest-tok");
      assert.equal(body.displayName, "Bob");
      return { playerToken: "full-tok" };
    });
    assert.equal(upgraded, "full-tok");
    assert.equal(storage.getItem(PLAYER_WALLET_STORAGE_KEY), "full-tok");
    assert.equal(storage.getItem(PLAYER_GUEST_STORAGE_KEY), null);
  } finally {
    delete globalThis.localStorage;
  }
});

test("upgradeGuestPlayerWallet returns false on API failure", async () => {
  const storage = createStorage();
  globalThis.localStorage = storage;
  storage.setItem(PLAYER_WALLET_STORAGE_KEY, "guest-tok");
  storage.setItem(PLAYER_GUEST_STORAGE_KEY, "true");
  try {
    const upgraded = await upgradeGuestPlayerWallet("Bob", true, async () => {
      throw new Error("409");
    });
    assert.equal(upgraded, false);
    assert.equal(storage.getItem(PLAYER_WALLET_STORAGE_KEY), "guest-tok");
    assert.equal(storage.getItem(PLAYER_GUEST_STORAGE_KEY), "true");
  } finally {
    delete globalThis.localStorage;
  }
});
