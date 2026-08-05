import { test } from "node:test";
import assert from "node:assert/strict";

const {
  PLAYER_WALLET_STORAGE_KEY,
  PLAYER_GUEST_STORAGE_KEY,
  readIsGuestFromStorage,
  registerGuestWallet,
  upgradeGuestWallet,
} = await import("../src/hooks/use-player-wallet.tsx");

test("PLAYER_WALLET_STORAGE_KEY is streamline.playerWalletToken", () => {
  assert.equal(PLAYER_WALLET_STORAGE_KEY, "streamline.playerWalletToken");
});

test("PLAYER_GUEST_STORAGE_KEY is streamline.playerIsGuest", () => {
  assert.equal(PLAYER_GUEST_STORAGE_KEY, "streamline.playerIsGuest");
});

test("readIsGuestFromStorage is true when guest flag is set", () => {
  assert.equal(
    readIsGuestFromStorage({ getItem: (k) => (k === PLAYER_GUEST_STORAGE_KEY ? "true" : null) }),
    true,
  );
});

test("readIsGuestFromStorage is false when guest flag is absent", () => {
  assert.equal(readIsGuestFromStorage({ getItem: () => null }), false);
});

test("registerGuestWallet returns token on success", async () => {
  const result = await registerGuestWallet(async () => ({ playerToken: "guest-1" }));
  assert.deepEqual(result, { token: "guest-1" });
});

test("registerGuestWallet returns error message on failure", async () => {
  const result = await registerGuestWallet(async () => {
    throw new Error("network");
  });
  assert.deepEqual(result, { error: "Не удалось создать гостевой кошелёк" });
});

test("upgradeGuestWallet returns null without guest token", async () => {
  const token = await upgradeGuestWallet("Player", null, true, async () => ({
    playerToken: "full-1",
  }));
  assert.equal(token, null);
});

test("upgradeGuestWallet returns null when not guest", async () => {
  const token = await upgradeGuestWallet("Player", "guest-1", false, async () => ({
    playerToken: "full-1",
  }));
  assert.equal(token, null);
});

test("upgradeGuestWallet trims displayName and returns token on success", async () => {
  let captured = null;
  const token = await upgradeGuestWallet(
    "  Alice  ",
    "guest-1",
    true,
    async (body) => {
      captured = body;
      return { playerToken: "full-1" };
    },
  );
  assert.equal(token, "full-1");
  assert.deepEqual(captured, { guestToken: "guest-1", displayName: "Alice" });
});

test("upgradeGuestWallet returns null on failure", async () => {
  const token = await upgradeGuestWallet("Bob", "guest-1", true, async () => {
    throw new Error("409");
  });
  assert.equal(token, null);
});
