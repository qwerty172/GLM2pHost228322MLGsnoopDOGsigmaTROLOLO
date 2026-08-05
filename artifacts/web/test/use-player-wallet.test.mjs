import { test } from "node:test";
import assert from "node:assert/strict";

const {
  PLAYER_WALLET_STORAGE_KEY,
  PLAYER_IS_GUEST_STORAGE_KEY,
  REGISTER_GUEST_ERROR_MSG,
  isGuestStoredValue,
  callRegisterGuestPlayer,
  callUpgradeGuestPlayer,
} = await import("../src/hooks/use-player-wallet.tsx");

test("PLAYER_WALLET_STORAGE_KEY is streamline.playerWalletToken", () => {
  assert.equal(PLAYER_WALLET_STORAGE_KEY, "streamline.playerWalletToken");
});

test("PLAYER_IS_GUEST_STORAGE_KEY is streamline.playerIsGuest", () => {
  assert.equal(PLAYER_IS_GUEST_STORAGE_KEY, "streamline.playerIsGuest");
});

test("REGISTER_GUEST_ERROR_MSG is Russian guest wallet error", () => {
  assert.equal(REGISTER_GUEST_ERROR_MSG, "Не удалось создать гостевой кошелёк");
});

test("isGuestStoredValue is true only for stored \"true\"", () => {
  assert.equal(isGuestStoredValue("true"), true);
  assert.equal(isGuestStoredValue("false"), false);
  assert.equal(isGuestStoredValue(null), false);
  assert.equal(isGuestStoredValue(""), false);
});

test("callRegisterGuestPlayer returns playerToken on success", async () => {
  const token = await callRegisterGuestPlayer(async () => ({ playerToken: "guest-1" }));
  assert.equal(token, "guest-1");
});

test("callRegisterGuestPlayer returns null on failure", async () => {
  const token = await callRegisterGuestPlayer(async () => {
    throw new Error("network");
  });
  assert.equal(token, null);
});

test("callUpgradeGuestPlayer returns playerToken on success", async () => {
  const token = await callUpgradeGuestPlayer("guest-1", "  Player  ", async (body) => {
    assert.equal(body.guestToken, "guest-1");
    assert.equal(body.displayName, "Player");
    return { playerToken: "full-1" };
  });
  assert.equal(token, "full-1");
});

test("callUpgradeGuestPlayer returns null on failure", async () => {
  const token = await callUpgradeGuestPlayer("guest-1", "Name", async () => {
    throw new Error("409");
  });
  assert.equal(token, null);
});
