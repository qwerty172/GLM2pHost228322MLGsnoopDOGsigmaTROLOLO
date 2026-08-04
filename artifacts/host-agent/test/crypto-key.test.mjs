// Unit tests for Ed25519 key-pair management (crypto-key).
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import Module from "node:module";

const require = createRequire(import.meta.url);
const CRYPTO_KEY_PATH = require.resolve("../dist/main/main/crypto-key.js");
const LOGGER_PATH = require.resolve("../dist/main/main/logger.js");

const load = Module._load;
let userDataDir;

Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return {
      app: {
        getPath: (name) => {
          if (name === "userData") return userDataDir;
          return "/tmp/test-agent";
        },
        getAppPath: () => "/tmp/test-agent",
      },
    };
  }
  return load.apply(this, arguments);
};

function reloadCryptoKey() {
  delete require.cache[CRYPTO_KEY_PATH];
  delete require.cache[LOGGER_PATH];
  return require(CRYPTO_KEY_PATH);
}

function keyFilePath() {
  return path.join(userDataDir, "agent-key.json");
}

function generateKeyStore() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  return {
    privateKeyHex: privateKey.export({ type: "pkcs8", format: "der" }).toString("hex"),
    publicKeyHex: publicKey.export({ type: "spki", format: "der" }).toString("hex"),
  };
}

function verifySignature(publicKeyHex, challenge, signatureHex) {
  const publicKey = crypto.createPublicKey({
    key: Buffer.from(publicKeyHex, "hex"),
    format: "der",
    type: "spki",
  });
  return crypto.verify(
    null,
    Buffer.from(challenge, "utf-8"),
    publicKey,
    Buffer.from(signatureHex, "hex"),
  );
}

beforeEach(async () => {
  userDataDir = await mkdtemp(path.join(tmpdir(), "crypto-key-"));
});

afterEach(async () => {
  delete require.cache[CRYPTO_KEY_PATH];
  delete require.cache[LOGGER_PATH];
  await rm(userDataDir, { recursive: true, force: true });
});

test("loadOrGenerateKeyPair generates and persists a new Ed25519 key pair", async () => {
  const { loadOrGenerateKeyPair } = reloadCryptoKey();
  const store = await loadOrGenerateKeyPair();

  assert.match(store.privateKeyHex, /^[0-9a-f]+$/i);
  assert.match(store.publicKeyHex, /^[0-9a-f]+$/i);
  assert.ok(store.privateKeyHex.length > 0);
  assert.ok(store.publicKeyHex.length > 0);

  const saved = JSON.parse(await readFile(keyFilePath(), "utf-8"));
  assert.equal(saved.privateKeyHex, store.privateKeyHex);
  assert.equal(saved.publicKeyHex, store.publicKeyHex);
});

test("loadOrGenerateKeyPair loads an existing key file", async () => {
  const expected = generateKeyStore();
  await writeFile(keyFilePath(), JSON.stringify(expected, null, 2), "utf-8");

  const { loadOrGenerateKeyPair } = reloadCryptoKey();
  const store = await loadOrGenerateKeyPair();

  assert.equal(store.privateKeyHex, expected.privateKeyHex);
  assert.equal(store.publicKeyHex, expected.publicKeyHex);
});

test("loadOrGenerateKeyPair regenerates when the key file is corrupt", async () => {
  await writeFile(keyFilePath(), "{not-json", "utf-8");

  const { loadOrGenerateKeyPair } = reloadCryptoKey();
  const store = await loadOrGenerateKeyPair();

  assert.match(store.privateKeyHex, /^[0-9a-f]+$/i);
  assert.match(store.publicKeyHex, /^[0-9a-f]+$/i);

  const saved = JSON.parse(await readFile(keyFilePath(), "utf-8"));
  assert.equal(saved.privateKeyHex, store.privateKeyHex);
});

test("loadOrGenerateKeyPair returns cached store on subsequent calls", async () => {
  const { loadOrGenerateKeyPair } = reloadCryptoKey();
  const first = await loadOrGenerateKeyPair();
  const second = await loadOrGenerateKeyPair();

  assert.equal(first, second);
});

test("signChallenge produces a verifiable Ed25519 signature", async () => {
  const { loadOrGenerateKeyPair, signChallenge } = reloadCryptoKey();
  const store = await loadOrGenerateKeyPair();
  const challenge = "session-bind-challenge-42";

  const signatureHex = signChallenge(store.privateKeyHex, challenge);

  assert.match(signatureHex, /^[0-9a-f]+$/i);
  assert.ok(verifySignature(store.publicKeyHex, challenge, signatureHex));
});

test("signChallenge signatures differ for different challenges", async () => {
  const { loadOrGenerateKeyPair, signChallenge } = reloadCryptoKey();
  const store = await loadOrGenerateKeyPair();

  const sigA = signChallenge(store.privateKeyHex, "challenge-a");
  const sigB = signChallenge(store.privateKeyHex, "challenge-b");

  assert.notEqual(sigA, sigB);
});
