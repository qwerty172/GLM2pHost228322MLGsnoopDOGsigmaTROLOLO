// Unit tests for Ed25519 key-pair management (crypto-key.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import crypto from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

let userDataDir = mkdtempSync(path.join(tmpdir(), "crypto-key-"));

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return {
      app: {
        getPath: (key) => (key === "userData" ? userDataDir : userDataDir),
        getAppPath: () => userDataDir,
      },
    };
  }
  return load.apply(this, arguments);
};

async function importCryptoKey() {
  const url = new URL("../dist/main/main/crypto-key.js", import.meta.url);
  url.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return import(url.href);
}

function keyFilePath() {
  return path.join(userDataDir, "agent-key.json");
}

test("loadOrGenerateKeyPair generates and persists Ed25519 key pair", async () => {
  userDataDir = mkdtempSync(path.join(tmpdir(), "crypto-key-"));
  const { loadOrGenerateKeyPair } = await importCryptoKey();

  const store = await loadOrGenerateKeyPair();
  assert.ok(store.privateKeyHex.length > 0);
  assert.ok(store.publicKeyHex.length > 0);

  const onDisk = JSON.parse(readFileSync(keyFilePath(), "utf8"));
  assert.equal(onDisk.privateKeyHex, store.privateKeyHex);
  assert.equal(onDisk.publicKeyHex, store.publicKeyHex);
});

test("loadOrGenerateKeyPair returns cached pair on subsequent calls", async () => {
  userDataDir = mkdtempSync(path.join(tmpdir(), "crypto-key-"));
  const { loadOrGenerateKeyPair } = await importCryptoKey();

  const first = await loadOrGenerateKeyPair();
  const second = await loadOrGenerateKeyPair();

  assert.equal(first.privateKeyHex, second.privateKeyHex);
  assert.equal(first.publicKeyHex, second.publicKeyHex);
});

test("signChallenge produces verifiable Ed25519 signature", async () => {
  userDataDir = mkdtempSync(path.join(tmpdir(), "crypto-key-"));
  const { loadOrGenerateKeyPair, signChallenge } = await importCryptoKey();

  const store = await loadOrGenerateKeyPair();
  const challenge = "marathon-m55-challenge";
  const sigHex = signChallenge(store.privateKeyHex, challenge);
  const sig = Buffer.from(sigHex, "hex");

  const publicKey = crypto.createPublicKey({
    key: Buffer.from(store.publicKeyHex, "hex"),
    format: "der",
    type: "spki",
  });

  assert.ok(
    crypto.verify(null, Buffer.from(challenge, "utf-8"), publicKey, sig),
  );
});
