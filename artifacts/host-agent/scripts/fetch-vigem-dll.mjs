// Downloads ViGEmClient.dll (MIT) for bundling into the Windows installer.
// ViGEmBus kernel driver must still be installed separately by the host.

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nativeDir = path.join(__dirname, "..", "native");
const dest = path.join(nativeDir, "ViGEmClient.dll");

const VIGEM_DLL_URL =
  "https://buildbot.nefarius.at/builds/ViGEmClient/master/1.17.167.0/bin/release/x64/ViGEmClient.dll";

async function main() {
  if (existsSync(dest)) {
    console.log(`[vigem] Already present: ${dest}`);
    return;
  }
  console.log(`[vigem] Downloading ViGEmClient.dll → ${dest}`);
  try {
    const resp = await fetch(VIGEM_DLL_URL);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    await mkdir(nativeDir, { recursive: true });
    const buf = Buffer.from(await resp.arrayBuffer());
    await writeFile(dest, buf);
    console.log("[vigem] Download complete.");
  } catch (err) {
    console.warn(
      `[vigem] Download failed: ${String(err)}. ` +
        "Installer will ship without bundled DLL — hosts need ViGEmBus + system ViGEmClient.dll.",
    );
  }
}

main();
