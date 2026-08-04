/**
 * Lightweight invite-flow smoke — requires running API + Postgres (.env).
 * Usage: node scripts/invite-flow-smoke.mjs
 */
const BASE = process.env.API_BASE ?? "http://localhost:8080";

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
  let failed = 0;
  const fail = () => {
    failed++;
  };

  console.log("\n=== Invite flow smoke ===");

  const reg = await api("POST", "/api/hosts/register", { displayName: "InviteSmokeHost" });
  const hostToken = reg.data?.hostToken;
  if (!ok("host register", reg.status === 201 && hostToken, hostToken?.slice(0, 8))) fail();

  const sess = await api("POST", "/api/sessions/test", {}, { "X-Host-Token": hostToken });
  const session = sess.data?.session;
  const inviteCode = session?.inviteCode;
  if (!ok("test session", sess.status === 201 && session?.id, session?.id)) fail();
  if (!ok("inviteCode", !!inviteCode, inviteCode)) fail();

  const byInvite = await api("GET", `/api/sessions/by-invite/${inviteCode}`);
  if (
    !ok(
      "GET /sessions/by-invite/:code",
      byInvite.status === 200 && byInvite.data?.playerToken === session.playerToken,
      `slug=${byInvite.data?.gameSlug ?? "?"}`,
    )
  ) {
    fail();
  }

  const bad = await api("GET", "/api/sessions/by-invite/invalid-code-xyz");
  if (!ok("invalid invite → 404", bad.status === 404)) fail();

  console.log(failed ? `\nFAILED (${failed})\n` : "\nAll invite-flow checks passed.\n");
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
