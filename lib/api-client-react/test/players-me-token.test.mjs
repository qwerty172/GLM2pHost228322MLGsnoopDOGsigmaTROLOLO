import assert from "node:assert/strict";
import test from "node:test";
import { userTokenForPlayersMeRoute } from "../src/custom-fetch.ts";

test("userTokenForPlayersMeRoute prefers player wallet over host token", () => {
  const host = "host-token-abc";
  const player = "player-token-xyz";
  assert.equal(
    userTokenForPlayersMeRoute("/api/players/me/credit-settings", [host, player]),
    player,
  );
});

test("userTokenForPlayersMeRoute uses player when host token absent", () => {
  const player = "player-token-xyz";
  assert.equal(
    userTokenForPlayersMeRoute("/api/players/me/saves/game-1", [null, player]),
    player,
  );
});

test("userTokenForPlayersMeRoute ignores non-player routes", () => {
  assert.equal(
    userTokenForPlayersMeRoute("/api/hosts/me/config", ["host-token", "player-token"]),
    null,
  );
});

test("userTokenForPlayersMeRoute returns null when no tokens", () => {
  assert.equal(userTokenForPlayersMeRoute("/api/players/me/credit-settings", []), null);
});
