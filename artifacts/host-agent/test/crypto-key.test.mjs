// Unit tests for Ed25519 key-pair management (crypto-key.ts).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { promises as fs } from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import os from "node:os";

const tmpRoot = path.join(os.tmpdir(), `crypto-key-test-${process.pid}`);
const userDataDir = path.join(tmpRoot, "userdata");

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return {
      app: {
        getPath: (name) => (name === "userData" ? userDataDir : tmpRoot),
        getAppPath: () => tmpRoot,
      },
    };
  }
  return load.apply(this, arguments);
};

const { loadOrGenerateKeyPair, signChallenge } = await import(
  "../dist/main/main/crypto-key.js"
);

before(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
  await fs.mkdir(userDataDir, { recursive: true });
});

after(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

test("loadOrGenerateKeyPair generates Ed25519 PKCS#8/SPKI hex keys and saves agent-key.json", async () => {
  const store = await loadOrGenerateKeyPair();
  assert.match(store.privateKeyHex, /^[0-9a-f]+$/i);
  assert.match(store.publicKeyHex, /^[0-9a-f]+$/i);
  assert.notEqual(store.privateKeyHex, store.publicKeyHex);

  const keyFile = path.join(userDataDir, "agent-key.json");
  const onDisk = JSON.parse(await fs.readFile(keyFile, "utf-8"));
  assert.equal(onDisk.privateKeyHex, store.privateKeyHex);
  assert.equal(onDisk.publicKeyHex, store.publicKeyHex);
});

test("loadOrGenerateKeyPair returns cached pair on subsequent calls", async () => {
  const first = await loadOrGenerateKeyPair();
  const second = await loadOrGenerateKeyPair();
  assert.equal(second.privateKeyHex, first.privateKeyHex);
  assert.equal(second.publicKeyHex, first.publicKeyHex);
});

test("signChallenge produces verifiable Ed25519 signature", async () => {
  const { privateKeyHex, publicKeyHex } = await loadOrGenerateKeyPair();
  const challenge = "bind-challenge-abc123";
  const sigHex = signChallenge(privateKeyHex, challenge);

  assert.match(sigHex, /^[0-9a-f]+$/i);

  const publicKey = crypto.createPublicKey({
    key: Buffer.from(publicKeyHex, "hex"),
    format: "der",
    type: "spki",
  });
  const ok = crypto.verify(
    null,
    Buffer.from(challenge, "utf-8"),
    publicKey,
    Buffer.from(sigHex, "hex"),
  );
  assert.equal(ok, true);
});

test("signChallenge differs per challenge", async () => {
  const { privateKeyHex } = await loadOrGenerateKeyPair();
  const a = signChallenge(privateKeyHex, "challenge-a");
  const b = signChallenge(privateKeyHex, "challenge-b");
  assert.notEqual(a, b);
});
