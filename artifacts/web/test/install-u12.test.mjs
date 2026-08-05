import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const installPath = path.resolve(
  fileURLToPath(new URL("../../host-agent/INSTALL.txt", import.meta.url)),
);
const install = readFileSync(installPath, "utf8");

/** U-12: INSTALL.txt must match post-U-01/U-02 dashboard onboarding (no manual token paste). */
test("INSTALL.txt matches dashboard flow after U-01/U-02", () => {
  assert.doesNotMatch(install, /Вставь токен/i);
  assert.doesNotMatch(install, /скопировать токен/i);
  assert.doesNotMatch(install, /Хостить\s*→/i);
  assert.doesNotMatch(install, /Токен хоста.*Сохранить/i);

  assert.match(install, /Скачать агент/i);
  assert.match(install, /start\.bat/i);
  assert.match(install, /Вход выполнен/i);
  assert.match(install, /вшит/i);
  assert.match(install, /Выйти в онлайн/i);
  assert.match(install, /библиотек/i);
});
