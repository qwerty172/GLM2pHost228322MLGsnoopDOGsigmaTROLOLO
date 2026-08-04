import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import crypto from "node:crypto";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const agentRoot = path.join(testDir, "..");

// crypto-key → logger requires electron at load time
let userDataDir = "";
const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return {
      app: {
        getAppPath: () => path.join(userDataDir, "app"),
        getPath: (name) => (name === "userData" ? userDataDir : "/tmp"),
      },
    };
  }
  return load.apply(this, arguments);
};

const { signChallenge, loadOrGenerateKeyPair } = await import(
  "../dist/main/main/crypto-key.js"
);

function exportKeyPair(keyPair) {
  return {
    privateKeyHex: keyPair.privateKey
      .export({ type: "pkcs8", format: "der" })
      .toString("hex"),
    publicKeyHex: keyPair.publicKey
      .export({ type: "spki", format: "der" })
      .toString("hex"),
  };
}

function verifySignature(publicKeyHex, challenge, sigHex) {
  const pubKey = crypto.createPublicKey({
    key: Buffer.from(publicKeyHex, "hex"),
    format: "der",
    type: "spki",
  });
  return crypto.verify(
    null,
    Buffer.from(challenge, "utf-8"),
    pubKey,
    Buffer.from(sigHex, "hex"),
  );
}

test("signChallenge produces verifiable Ed25519 signature", () => {
  const store = exportKeyPair(crypto.generateKeyPairSync("ed25519"));
  const challenge = "test-challenge-123";
  const sigHex = signChallenge(store.privateKeyHex, challenge);
  assert.equal(verifySignature(store.publicKeyHex, challenge, sigHex), true);
});

test("loadOrGenerateKeyPair generates, persists and caches key pair", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "crypto-key-"));
  userDataDir = dir;

  const first = await loadOrGenerateKeyPair();
  assert.match(first.privateKeyHex, /^[0-9a-f]+$/);
  assert.match(first.publicKeyHex, /^[0-9a-f]+$/);
  assert.ok(first.privateKeyHex.length > 0);

  const onDisk = JSON.parse(await readFile(path.join(dir, "agent-key.json"), "utf-8"));
  assert.equal(onDisk.privateKeyHex, first.privateKeyHex);
  assert.equal(onDisk.publicKeyHex, first.publicKeyHex);

  const second = await loadOrGenerateKeyPair();
  assert.equal(second, first);

  const sigHex = signChallenge(first.privateKeyHex, "marathon");
  assert.equal(verifySignature(first.publicKeyHex, "marathon", sigHex), true);

  await rm(dir, { recursive: true, force: true });
});

test("loadOrGenerateKeyPair loads existing key from disk", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "crypto-key-"));
  const store = exportKeyPair(crypto.generateKeyPairSync("ed25519"));
  await writeFile(path.join(dir, "agent-key.json"), JSON.stringify(store));

  const r = spawnSync(
    process.execPath,
    [path.join(testDir, "helpers/crypto-key-load-existing.mjs")],
    {
      cwd: agentRoot,
      env: { ...process.env, CRYPTO_KEY_USER_DATA: dir },
      encoding: "utf8",
    },
  );
  assert.equal(r.status, 0, r.stderr || r.stdout);

  const lastLine = r.stdout.trim().split("\n").at(-1);
  const payload = JSON.parse(lastLine ?? "");
  assert.equal(payload.privateKeyHex, store.privateKeyHex);
  assert.equal(payload.publicKeyHex, store.publicKeyHex);

  await rm(dir, { recursive: true, force: true });
});
