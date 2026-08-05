import { test } from "node:test";
import assert from "node:assert/strict";

const {
  PLAYER_WALLET_STORAGE_KEY,
  PLAYER_GUEST_STORAGE_KEY,
  readPlayerWalletToken,
  readIsGuestPlayer,
  registerGuestPlayerWallet,
  upgradeGuestPlayerWallet,
} = await import("../src/hooks/use-player-wallet.tsx");

function makeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

test("PLAYER_WALLET_STORAGE_KEY is streamline.playerWalletToken", () => {
  assert.equal(PLAYER_WALLET_STORAGE_KEY, "streamline.playerWalletToken");
});

test("PLAYER_GUEST_STORAGE_KEY is streamline.playerIsGuest", () => {
  assert.equal(PLAYER_GUEST_STORAGE_KEY, "streamline.playerIsGuest");
});

test("readPlayerWalletToken returns stored token", () => {
  const storage = makeStorage({ [PLAYER_WALLET_STORAGE_KEY]: "tok-1" });
  assert.equal(readPlayerWalletToken(storage), "tok-1");
});

test("readIsGuestPlayer is true only when guest flag is true", () => {
  const guest = makeStorage({ [PLAYER_GUEST_STORAGE_KEY]: "true" });
  const notGuest = makeStorage({ [PLAYER_GUEST_STORAGE_KEY]: "false" });
  assert.equal(readIsGuestPlayer(guest), true);
  assert.equal(readIsGuestPlayer(notGuest), false);
});

test("registerGuestPlayerWallet returns existing token without API call", async () => {
  let called = false;
  const storage = makeStorage({ [PLAYER_WALLET_STORAGE_KEY]: "existing" });
  const result = await registerGuestPlayerWallet(
    async () => {
      called = true;
      return { playerToken: "new" };
    },
    storage,
  );
  assert.deepEqual(result, { token: "existing" });
  assert.equal(called, false);
});

test("registerGuestPlayerWallet persists guest token on success", async () => {
  const storage = makeStorage();
  const result = await registerGuestPlayerWallet(
    async () => ({ playerToken: "guest-1" }),
    storage,
  );
  assert.deepEqual(result, { token: "guest-1" });
  assert.equal(storage.getItem(PLAYER_WALLET_STORAGE_KEY), "guest-1");
  assert.equal(storage.getItem(PLAYER_GUEST_STORAGE_KEY), "true");
});

test("registerGuestPlayerWallet returns error message on failure", async () => {
  const storage = makeStorage();
  const result = await registerGuestPlayerWallet(
    async () => {
      throw new Error("network");
    },
    storage,
  );
  assert.deepEqual(result, { error: "Не удалось создать гостевой кошелёк" });
  assert.equal(storage.getItem(PLAYER_WALLET_STORAGE_KEY), null);
});

test("upgradeGuestPlayerWallet returns null when not guest", async () => {
  const storage = makeStorage({ [PLAYER_WALLET_STORAGE_KEY]: "tok-1" });
  const result = await upgradeGuestPlayerWallet("Игрок", storage, async () => ({
    playerToken: "full-1",
  }));
  assert.equal(result, null);
});

test("upgradeGuestPlayerWallet upgrades guest and clears guest flag", async () => {
  const storage = makeStorage({
    [PLAYER_WALLET_STORAGE_KEY]: "guest-tok",
    [PLAYER_GUEST_STORAGE_KEY]: "true",
  });
  const result = await upgradeGuestPlayerWallet(
    "  Игрок  ",
    storage,
    async ({ guestToken, displayName }) => {
      assert.equal(guestToken, "guest-tok");
      assert.equal(displayName, "Игрок");
      return { playerToken: "full-tok" };
    },
  );
  assert.deepEqual(result, { token: "full-tok" });
  assert.equal(storage.getItem(PLAYER_WALLET_STORAGE_KEY), "full-tok");
  assert.equal(storage.getItem(PLAYER_GUEST_STORAGE_KEY), null);
});

test("upgradeGuestPlayerWallet returns null on API failure", async () => {
  const storage = makeStorage({
    [PLAYER_WALLET_STORAGE_KEY]: "guest-tok",
    [PLAYER_GUEST_STORAGE_KEY]: "true",
  });
  const result = await upgradeGuestPlayerWallet("Игрок", storage, async () => {
    throw new Error("409");
  });
  assert.equal(result, null);
  assert.equal(storage.getItem(PLAYER_GUEST_STORAGE_KEY), "true");
});
