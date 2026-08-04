// Isolated test: load existing key from disk (import must happen after file write).
import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import crypto from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const userDataDir = mkdtempSync(path.join(tmpdir(), "crypto-key-load-"));
const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
const expected = {
  privateKeyHex: privateKey
    .export({ type: "pkcs8", format: "der" })
    .toString("hex"),
  publicKeyHex: publicKey
    .export({ type: "spki", format: "der" })
    .toString("hex"),
};

writeFileSync(
  path.join(userDataDir, "agent-key.json"),
  JSON.stringify(expected, null, 2),
  "utf8",
);

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

const { loadOrGenerateKeyPair } = await import(
  "../dist/main/main/crypto-key.js"
);

test("loadOrGenerateKeyPair loads existing key pair from disk", async () => {
  const loaded = await loadOrGenerateKeyPair();
  assert.equal(loaded.privateKeyHex, expected.privateKeyHex);
  assert.equal(loaded.publicKeyHex, expected.publicKeyHex);
});
