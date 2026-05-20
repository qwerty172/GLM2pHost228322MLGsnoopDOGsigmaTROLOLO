// Ed25519 key-pair management for the host agent.
// The private key is stored as a hex-encoded PKCS#8 DER file in the Electron
// userData directory (app-specific, per-user, not synced).  The file is
// created with mode 0o600 on the first run and reused on subsequent runs.

import { app } from "electron";
import { promises as fs } from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { log } from "./logger";

interface KeyStore {
  privateKeyHex: string;
  publicKeyHex: string;
}

let _cached: KeyStore | null = null;

function keyPath(): string {
  return path.join(app.getPath("userData"), "agent-key.json");
}

export async function loadOrGenerateKeyPair(): Promise<KeyStore> {
  if (_cached) return _cached;

  try {
    const buf = await fs.readFile(keyPath(), "utf-8");
    const parsed = JSON.parse(buf) as Partial<KeyStore>;
    if (parsed.privateKeyHex && parsed.publicKeyHex) {
      _cached = parsed as KeyStore;
      log("info", "[crypto-key] Loaded existing Ed25519 key pair");
      return _cached;
    }
  } catch {
    // File missing or corrupt — generate a fresh pair below.
  }

  log("info", "[crypto-key] Generating new Ed25519 key pair…");
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  const privateKeyHex = privateKey
    .export({ type: "pkcs8", format: "der" })
    .toString("hex");
  const publicKeyHex = publicKey
    .export({ type: "spki", format: "der" })
    .toString("hex");

  const store: KeyStore = { privateKeyHex, publicKeyHex };
  await fs.mkdir(path.dirname(keyPath()), { recursive: true });
  await fs.writeFile(keyPath(), JSON.stringify(store, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });
  log("info", "[crypto-key] Ed25519 key pair generated and saved");
  _cached = store;
  return store;
}

export function signChallenge(privateKeyHex: string, challenge: string): string {
  const privateKey = crypto.createPrivateKey({
    key: Buffer.from(privateKeyHex, "hex"),
    format: "der",
    type: "pkcs8",
  });
  const sig = crypto.sign(null, Buffer.from(challenge, "utf-8"), privateKey);
  return sig.toString("hex");
}
