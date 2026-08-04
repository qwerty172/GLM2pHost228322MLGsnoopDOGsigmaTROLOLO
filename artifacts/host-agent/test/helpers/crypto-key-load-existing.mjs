import Module from "node:module";
import path from "node:path";

const userDataDir = process.env.CRYPTO_KEY_USER_DATA;
if (!userDataDir) {
  console.error("CRYPTO_KEY_USER_DATA is required");
  process.exit(1);
}

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

const { loadOrGenerateKeyPair } = await import("../../dist/main/main/crypto-key.js");
const loaded = await loadOrGenerateKeyPair();
process.stdout.write(`${JSON.stringify(loaded)}\n`);
