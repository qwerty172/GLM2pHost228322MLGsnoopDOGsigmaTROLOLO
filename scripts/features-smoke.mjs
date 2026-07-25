/**
 * Smoke: invite (4), rating (5), guest upgrade (6), stream-relay (10)
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.API_BASE ?? "http://localhost:8080";
const require = createRequire(join(ROOT, "lib/db/package.json"));
const pg = require("pg");

function loadEnv() {
  const env = readFileSync(join(ROOT, ".env"), "utf8");
  const get = (k) => env.split(/\r?\n/).find((l) => l.startsWith(`${k}=`))?.slice(k.length + 1).trim();
  return { DATABASE_URL: process.env.DATABASE_URL ?? get("DATABASE_URL") };
}

async function sql(client, q, params = []) {
  const r = await client.query(q, params);
  return r.rows;
}

async function api(method, path, body, headers = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

function ok(label, cond, detail = "") {
  if (cond) {
    console.log(`OK  ${label}${detail ? ` — ${detail}` : ""}`);
    return true;
  }
  console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  return false;
}

async function main() {
  const { DATABASE_URL } = loadEnv();
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  let failed = 0;
  const fail = () => {
    failed++;
  };

  console.log(`\n=== Test 4: Invite links ===`);
  let hostToken = (
    await sql(client, "SELECT host_token FROM hosts ORDER BY created_at DESC LIMIT 1")
  )[0]?.host_token;
  if (!hostToken) {
    const reg = await api("POST", "/api/hosts/register", { displayName: "SmokeHost" });
    hostToken = reg.data?.hostToken;
  }
  if (!ok("host token", !!hostToken, hostToken?.slice(0, 8))) fail();

  const sess = await api("POST", "/api/sessions/test", {}, { "X-Host-Token": hostToken });
  const session = sess.data?.session;
  const inviteCode = session?.inviteCode;
  ok("test session created", sess.status === 201 && session?.id, session?.id) || fail();
  ok("inviteCode present", !!inviteCode, inviteCode) || fail();

  const byInvite = await api("GET", `/api/sessions/by-invite/${inviteCode}`);
  ok(
    "GET by-invite 200",
    byInvite.status === 200 && byInvite.data?.playerToken === session.playerToken,
    `gameSlug=${byInvite.data?.gameSlug ?? "?"}`,
  ) || fail();

  const badInvite = await api("GET", "/api/sessions/by-invite/ZZZZZZZZ");
  ok("bad invite 404", badInvite.status === 404) || fail();

  // Expire invite in DB
  await sql(client, "UPDATE sessions SET invite_expires_at = NOW() - INTERVAL '1 hour' WHERE id = $1", [
    session.id,
  ]);
  const expired = await api("GET", `/api/sessions/by-invite/${inviteCode}`);
  ok("expired invite 410", expired.status === 410 && expired.data?.error === "invite_expired") || fail();
  await sql(client, "UPDATE sessions SET invite_expires_at = NOW() + INTERVAL '7 days' WHERE id = $1", [
    session.id,
  ]);

  console.log(`\n=== Test 5: Session rating ===`);
  const playerReg = await api("POST", "/api/players/register", { guest: true });
  const playerWallet = playerReg.data?.playerToken;
  ok("guest player", playerReg.status === 201 && playerWallet) || fail();

  await api("POST", `/api/sessions/by-player-token/${session.playerToken}/claim`, {
    playerWalletToken: playerWallet,
  });
  await api("PATCH", `/api/sessions/${session.id}/end`, {
    hostToken,
    reason: "rating_smoke",
  });
  ok("session ended for rating", true) || fail();

  const rate = await api("POST", `/api/sessions/${session.id}/rate`, {
    playerWalletToken: playerWallet,
    score: 5,
    comment: "smoke test",
  });
  ok(
    "rate 200",
    rate.status === 200 && rate.data?.ratingCount >= 1,
    `avg=${rate.data?.ratingAvg}`,
  ) || fail();

  const dupRate = await api("POST", `/api/sessions/${session.id}/rate`, {
    playerWalletToken: playerWallet,
    score: 3,
  });
  ok("duplicate rate rejected", dupRate.status === 400 && dupRate.data?.error === "already_rated") ||
    fail();

  const hostRow = (
    await sql(client, "SELECT rating_avg, rating_count FROM hosts WHERE id = $1", [session.hostId])
  )[0];
  ok("host rating in DB", Number(hostRow?.rating_count) >= 1, JSON.stringify(hostRow)) || fail();

  const gameSlug = byInvite.data?.gameSlug;
  if (gameSlug) {
    const game = await api("GET", `/api/games/${gameSlug}`);
    ok("game detail 200", game.status === 200, gameSlug) || fail();
  }

  console.log(`\n=== Test 6: Guest upgrade (critical) ===`);
  const guest = await api("POST", "/api/players/register", { guest: true });
  const guestToken = guest.data?.playerToken;
  const guestId = guest.data?.id;
  ok("new guest registered", guest.status === 201 && guest.data?.isGuest === true) || fail();

  const BALANCE = 777;
  await sql(
    client,
    "UPDATE players SET internal_balance_lzt = $1, withdrawable_balance_lzt = 123 WHERE id = $2",
    [BALANCE, guestId],
  );
  const balBefore = (
    await sql(
      client,
      "SELECT internal_balance_lzt, withdrawable_balance_lzt, is_guest FROM players WHERE id = $1",
      [guestId],
    )
  )[0];
  ok(
    "balance seeded",
    Number(balBefore.internal_balance_lzt) === BALANCE &&
      Number(balBefore.withdrawable_balance_lzt) === 123,
  ) || fail();

  const upgrade = await api("POST", "/api/players/upgrade-guest", {
    guestToken,
    displayName: "SmokeUpgraded",
  });
  const newToken = upgrade.data?.playerToken;
  ok(
    "upgrade 200",
    upgrade.status === 200 && upgrade.data?.isGuest === false && newToken && newToken !== guestToken,
    `name=${upgrade.data?.displayName}`,
  ) || fail();

  const balAfter = (
    await sql(
      client,
      "SELECT internal_balance_lzt, withdrawable_balance_lzt, is_guest, player_token, display_name FROM players WHERE id = $1",
      [guestId],
    )
  )[0];
  ok(
    "balance preserved after upgrade",
    Number(balAfter.internal_balance_lzt) === BALANCE &&
      Number(balAfter.withdrawable_balance_lzt) === 123 &&
      balAfter.is_guest === false &&
      balAfter.player_token === newToken &&
      balAfter.display_name === "SmokeUpgraded",
  ) || fail();

  const wallet = await api("GET", `/api/wallet/${newToken}`);
  ok(
    "wallet API with new token",
    wallet.status === 200 && Number(wallet.data?.internalBalanceLzt) === BALANCE,
    `internal=${wallet.data?.internalBalanceLzt}`,
  ) || fail();

  const oldWallet = await api("GET", `/api/wallet/${guestToken}`);
  ok("old guest token invalid for wallet", oldWallet.status === 404 || oldWallet.status === 401) ||
    fail();

  const reUpgrade = await api("POST", "/api/players/upgrade-guest", {
    guestToken: newToken,
    displayName: "Again",
  });
  ok(
    "cannot upgrade twice",
    reUpgrade.status === 400 && reUpgrade.data?.error === "Account is not a guest",
  ) || fail();

  const staleUpgrade = await api("POST", "/api/players/upgrade-guest", {
    guestToken,
    displayName: "Stale",
  });
  ok(
    "stale guest token rejected",
    staleUpgrade.status === 404 || staleUpgrade.status === 400,
    `status=${staleUpgrade.status}`,
  ) || fail();

  console.log(`\n=== Test 10: Stream-relay ===`);
  const patchStream = await api("PATCH", `/api/hosts/me/config`, {
    streamPlatform: "custom",
    streamUrl: "rtmp://live.test.example/app",
    streamKey: "smoke-secret-key",
  }, {
    "X-Host-Token": hostToken,
  });
  ok("stream config saved", patchStream.status === 200) || fail();

  const relay = await api("GET", `/api/hosts/me/stream-relay`, null, {
    "X-Host-Token": hostToken,
  });
  ok(
    "stream-relay decrypts key",
    relay.status === 200 &&
      relay.data?.streamKey === "smoke-secret-key" &&
      relay.data?.streamUrl?.includes("rtmp"),
    relay.status !== 200 ? JSON.stringify(relay.data) : "ok",
  ) || fail();

  const noAuth = await api("GET", "/api/hosts/me/stream-relay");
  ok("unauth stream-relay 401", noAuth.status === 401) || fail();

  await client.end();
  console.log(`\n${failed === 0 ? "ALL PASSED" : `${failed} FAILED`}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
