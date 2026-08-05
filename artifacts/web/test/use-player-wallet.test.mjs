import { test } from "node:test";
import assert from "node:assert/strict";

const {
  PLAYER_WALLET_STORAGE_KEY,
  PLAYER_GUEST_STORAGE_KEY,
  GUEST_REGISTER_ERROR_MSG,
  readGuestFlagFromStorage,
  registerGuestPlayerWallet,
  upgradeGuestPlayerWallet,
  persistGuestWalletToken,
  persistUpgradedWalletToken,
} = await import("../src/hooks/use-player-wallet.tsx");

test("PLAYER_WALLET_STORAGE_KEY is streamline.playerWalletToken", () => {
  assert.equal(PLAYER_WALLET_STORAGE_KEY, "streamline.playerWalletToken");
});

test("PLAYER_GUEST_STORAGE_KEY is streamline.playerIsGuest", () => {
  assert.equal(PLAYER_GUEST_STORAGE_KEY, "streamline.playerIsGuest");
});

test("readGuestFlagFromStorage is true only when stored value is true", () => {
  assert.equal(readGuestFlagFromStorage("true"), true);
  assert.equal(readGuestFlagFromStorage(null), false);
  assert.equal(readGuestFlagFromStorage("false"), false);
  assert.equal(readGuestFlagFromStorage(""), false);
});

test("registerGuestPlayerWallet returns existing token without calling register", async () => {
  let called = false;
  const result = await registerGuestPlayerWallet(
    () => "existing-token",
    async () => {
      called = true;
      return { playerToken: "new" };
    },
  );
  assert.equal(result.token, "existing-token");
  assert.equal(result.error, null);
  assert.equal(called, false);
});

test("registerGuestPlayerWallet returns token on success", async () => {
  const result = await registerGuestPlayerWallet(
    () => null,
    async () => ({ playerToken: "guest-1" }),
  );
  assert.equal(result.token, "guest-1");
  assert.equal(result.error, null);
});

test("registerGuestPlayerWallet returns error message on failure", async () => {
  const result = await registerGuestPlayerWallet(
    () => null,
    async () => {
      throw new Error("network");
    },
  );
  assert.equal(result.token, null);
  assert.equal(result.error, GUEST_REGISTER_ERROR_MSG);
});

test("upgradeGuestPlayerWallet returns upgraded token on success", async () => {
  const result = await upgradeGuestPlayerWallet(
    "guest-1",
    true,
    "  Player  ",
    async ({ guestToken, displayName }) => {
      assert.equal(guestToken, "guest-1");
      assert.equal(displayName, "Player");
      return { playerToken: "full-1" };
    },
  );
  assert.equal(result.token, "full-1");
  assert.equal(result.upgraded, true);
});

test("upgradeGuestPlayerWallet is no-op without guest token or flag", async () => {
  let called = false;
  const noToken = await upgradeGuestPlayerWallet(null, true, "Name", async () => {
    called = true;
    return { playerToken: "x" };
  });
  assert.equal(noToken.upgraded, false);
  const notGuest = await upgradeGuestPlayerWallet("guest-1", false, "Name", async () => {
    called = true;
    return { playerToken: "x" };
  });
  assert.equal(notGuest.upgraded, false);
  assert.equal(called, false);
});

test("upgradeGuestPlayerWallet returns failure when upgrade rejects", async () => {
  const result = await upgradeGuestPlayerWallet(
    "guest-1",
    true,
    "Name",
    async () => {
      throw new Error("409");
    },
  );
  assert.equal(result.token, null);
  assert.equal(result.upgraded, false);
});

test("persistGuestWalletToken writes token and guest flag", () => {
  const writes = [];
  persistGuestWalletToken(
    {
      setItem: (key, value) => writes.push([key, value]),
    },
    "guest-token",
  );
  assert.deepEqual(writes, [
    [PLAYER_WALLET_STORAGE_KEY, "guest-token"],
    [PLAYER_GUEST_STORAGE_KEY, "true"],
  ]);
});

test("persistUpgradedWalletToken writes token and clears guest flag", () => {
  const writes = [];
  const removals = [];
  persistUpgradedWalletToken(
    {
      setItem: (key, value) => writes.push([key, value]),
      removeItem: (key) => removals.push(key),
    },
    "full-token",
  );
  assert.deepEqual(writes, [[PLAYER_WALLET_STORAGE_KEY, "full-token"]]);
  assert.deepEqual(removals, [PLAYER_GUEST_STORAGE_KEY]);
});
