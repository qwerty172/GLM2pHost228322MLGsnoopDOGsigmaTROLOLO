import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import Module from "node:module";

const tmpDir = await mkdtemp(path.join(os.tmpdir(), "crypto-key-test-"));

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return {
      app: {
        getPath: () => tmpDir,
        getAppPath: () => tmpDir,
      },
    };
  }
  return load.apply(this, arguments);
};

const { loadOrGenerateKeyPair, signChallenge } = await import("../dist/main/main/crypto-key.js");

test("loadOrGenerateKeyPair generates Ed25519 keys and persists agent-key.json", async () => {
  const keys = await loadOrGenerateKeyPair();
  assert.match(keys.privateKeyHex, /^[0-9a-f]+$/i);
  assert.match(keys.publicKeyHex, /^[0-9a-f]+$/i);
  assert.ok(keys.privateKeyHex.length > 32);
  assert.ok(keys.publicKeyHex.length > 32);

  const raw = await readFile(path.join(tmpDir, "agent-key.json"), "utf-8");
  const saved = JSON.parse(raw);
  assert.equal(saved.privateKeyHex, keys.privateKeyHex);
  assert.equal(saved.publicKeyHex, keys.publicKeyHex);
});

test("loadOrGenerateKeyPair returns cached key pair on subsequent calls", async () => {
  const first = await loadOrGenerateKeyPair();
  const second = await loadOrGenerateKeyPair();
  assert.equal(first, second);
});

test("signChallenge produces verifiable Ed25519 signature", async () => {
  const keys = await loadOrGenerateKeyPair();
  const challenge = "decentralhub-challenge-2026";
  const sigHex = signChallenge(keys.privateKeyHex, challenge);

  const publicKey = crypto.createPublicKey({
    key: Buffer.from(keys.publicKeyHex, "hex"),
    format: "der",
    type: "spki",
  });
  assert.ok(
    crypto.verify(null, Buffer.from(challenge, "utf-8"), publicKey, Buffer.from(sigHex, "hex")),
  );
});

test("signChallenge rejects invalid challenge with different signature", async () => {
  const keys = await loadOrGenerateKeyPair();
  const sigA = signChallenge(keys.privateKeyHex, "challenge-a");
  const sigB = signChallenge(keys.privateKeyHex, "challenge-b");
  assert.notEqual(sigA, sigB);
});
