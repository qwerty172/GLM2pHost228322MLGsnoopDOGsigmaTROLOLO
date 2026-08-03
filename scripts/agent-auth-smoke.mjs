#!/usr/bin/env node
/**
 * Фаза 4: Ed25519 agent-auth E2E — challenge → bind → login.
 */
import crypto from "node:crypto";
import { getHostToken, api as smokeApi } from "./smoke-api.mjs";

const BASE = process.env.API_BASE ?? "http://localhost:8080";

async function api(method, path, body, headers = {}) {
  const { ok, json, text } = await smokeApi(method, path, body, headers);
  if (!ok) throw new Error(`${method} ${path} -> ${text}`);
  return json;
}

function signChallenge(privateKey, challenge) {
  return crypto
    .sign(null, Buffer.from(challenge, "utf-8"), privateKey)
    .toString("hex");
}

function exportPubkeyHex(publicKey) {
  return publicKey.export({ type: "spki", format: "der" }).toString("hex");
}

async function main() {
  console.log(`Agent-auth smoke: ${BASE}`);

  let hostToken = process.env.SMOKE_HOST_TOKEN;
  if (!hostToken) {
    hostToken = await getHostToken();
    console.log("OK  host ready");
  } else {
    console.log("OK  reusing smoke host token");
  }

  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const pubkey = exportPubkeyHex(publicKey);

  const challenge1 = await api("GET", "/api/auth/agent-challenge");
  if (!challenge1.challenge) throw new Error("Missing challenge");
  console.log("OK  agent-challenge");

  const bindCodeResp = await api("POST", "/api/auth/agent-bind-code", undefined, {
    Authorization: `Bearer ${hostToken}`,
    "X-User-Token": hostToken,
  });
  if (!bindCodeResp.bindCode) throw new Error("Missing bindCode");
  console.log("OK  agent-bind-code");

  await api("POST", "/api/auth/bind-agent-key", {
    bindCode: bindCodeResp.bindCode,
    pubkey,
    challenge: challenge1.challenge,
    signature: signChallenge(privateKey, challenge1.challenge),
  });
  console.log("OK  bind-agent-key");

  const challenge2 = await api("GET", "/api/auth/agent-challenge");
  const login = await api("POST", "/api/auth/agent-login", {
    pubkey,
    challenge: challenge2.challenge,
    signature: signChallenge(privateKey, challenge2.challenge),
  });
  if (login.hostToken !== hostToken) {
    throw new Error("agent-login returned wrong hostToken");
  }
  console.log("OK  agent-login → hostToken matches");

  console.log("Done — agent-auth smoke passed.");
}

main().catch((err) => {
  console.error("FAIL agent-auth-smoke:", err.message);
  process.exit(1);
});
