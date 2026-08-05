import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const installPath = path.resolve(
  fileURLToPath(new URL("../../host-agent/INSTALL.txt", import.meta.url)),
);
const install = readFileSync(installPath, "utf8");

/** U-33: INSTALL.txt must mention the same firewall port range as dashboard and ping-server. */
test("INSTALL.txt firewall ports match dashboard and ping-server fallbacks (U-33)", () => {
  assert.match(install, /18080/);
  assert.match(install, /18081/);
  assert.match(install, /18082/);
  assert.match(install, /18083/);
  assert.match(install, /18080.18083/);
  assert.doesNotMatch(install, /блокирует порт 18080\?/);
});
