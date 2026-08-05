import { test } from "node:test";
import assert from "node:assert/strict";

const {
  PLAYER_WALLET_STORAGE_KEY,
  PLAYER_IS_GUEST_STORAGE_KEY,
  readGuestFlagFromStorage,
  persistGuestWalletToken,
  persistUpgradedWalletToken,
  registerGuestWalletAsync,
  upgradeGuestWalletAsync,
} = await import("../src/hooks/use-player-wallet.tsx");

function mockStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
    store,
  };
}

test("storage keys are streamline.playerWalletToken and streamline.playerIsGuest", () => {
  assert.equal(PLAYER_WALLET_STORAGE_KEY, "streamline.playerWalletToken");
  assert.equal(PLAYER_IS_GUEST_STORAGE_KEY, "streamline.playerIsGuest");
});

test("readGuestFlagFromStorage is true only when guest flag is true", () => {
  const ls = mockStorage({ [PLAYER_IS_GUEST_STORAGE_KEY]: "true" });
  globalThis.localStorage = ls;
  try {
    assert.equal(readGuestFlagFromStorage(), true);
    ls.removeItem(PLAYER_IS_GUEST_STORAGE_KEY);
    assert.equal(readGuestFlagFromStorage(), false);
    ls.setItem(PLAYER_IS_GUEST_STORAGE_KEY, "false");
    assert.equal(readGuestFlagFromStorage(), false);
  } finally {
    delete globalThis.localStorage;
  }
});

test("persistGuestWalletToken stores token and guest flag", () => {
  const ls = mockStorage();
  globalThis.localStorage = ls;
  try {
    persistGuestWalletToken("guest-token-1");
    assert.equal(ls.getItem(PLAYER_WALLET_STORAGE_KEY), "guest-token-1");
    assert.equal(ls.getItem(PLAYER_IS_GUEST_STORAGE_KEY), "true");
  } finally {
    delete globalThis.localStorage;
  }
});

test("persistUpgradedWalletToken stores token and clears guest flag", () => {
  const ls = mockStorage({
    [PLAYER_WALLET_STORAGE_KEY]: "guest-token-1",
    [PLAYER_IS_GUEST_STORAGE_KEY]: "true",
  });
  globalThis.localStorage = ls;
  try {
    persistUpgradedWalletToken("full-token-1");
    assert.equal(ls.getItem(PLAYER_WALLET_STORAGE_KEY), "full-token-1");
    assert.equal(ls.getItem(PLAYER_IS_GUEST_STORAGE_KEY), null);
  } finally {
    delete globalThis.localStorage;
  }
});

test("registerGuestWalletAsync returns existing token without API call", async () => {
  let called = false;
  const result = await registerGuestWalletAsync(
    async () => {
      called = true;
      return { playerToken: "new" };
    },
    { isRegistering: false, existingToken: "existing-token" },
  );
  assert.equal(result.token, "existing-token");
  assert.equal(result.error, null);
  assert.equal(called, false);
});

test("registerGuestWalletAsync registers guest and persists token", async () => {
  const ls = mockStorage();
  globalThis.localStorage = ls;
  try {
    const result = await registerGuestWalletAsync(
      async (body) => {
        assert.deepEqual(body, { guest: true });
        return { playerToken: "guest-token-2" };
      },
      { isRegistering: false, existingToken: null },
    );
    assert.equal(result.token, "guest-token-2");
    assert.equal(result.error, null);
    assert.equal(ls.getItem(PLAYER_WALLET_STORAGE_KEY), "guest-token-2");
    assert.equal(ls.getItem(PLAYER_IS_GUEST_STORAGE_KEY), "true");
  } finally {
    delete globalThis.localStorage;
  }
});

test("registerGuestWalletAsync returns error message on failure", async () => {
  const result = await registerGuestWalletAsync(
    async () => {
      throw new Error("network");
    },
    { isRegistering: false, existingToken: null },
  );
  assert.equal(result.token, null);
  assert.equal(result.error, "Не удалось создать гостевой кошелёк");
});

test("upgradeGuestWalletAsync returns false without guest token or flag", async () => {
  const result = await upgradeGuestWalletAsync(
    async () => ({ playerToken: "full" }),
    { guestToken: null, isGuest: true, displayName: "Player" },
  );
  assert.equal(result, false);
});

test("upgradeGuestWalletAsync upgrades guest and persists full token", async () => {
  const ls = mockStorage({
    [PLAYER_WALLET_STORAGE_KEY]: "guest-token-3",
    [PLAYER_IS_GUEST_STORAGE_KEY]: "true",
  });
  globalThis.localStorage = ls;
  try {
    const result = await upgradeGuestWalletAsync(
      async (body) => {
        assert.deepEqual(body, {
          guestToken: "guest-token-3",
          displayName: "Игрок",
        });
        return { playerToken: "full-token-3" };
      },
      { guestToken: "guest-token-3", isGuest: true, displayName: "  Игрок  " },
    );
    assert.equal(result, true);
    assert.equal(ls.getItem(PLAYER_WALLET_STORAGE_KEY), "full-token-3");
    assert.equal(ls.getItem(PLAYER_IS_GUEST_STORAGE_KEY), null);
  } finally {
    delete globalThis.localStorage;
  }
});

test("upgradeGuestWalletAsync returns false on API failure", async () => {
  const result = await upgradeGuestWalletAsync(
    async () => {
      throw new Error("409");
    },
    { guestToken: "guest-token-4", isGuest: true, displayName: "X" },
  );
  assert.equal(result, false);
});
