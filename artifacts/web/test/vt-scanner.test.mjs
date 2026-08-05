import { test } from "node:test";
import assert from "node:assert/strict";

const {
  VT_SCANNER_DEFAULT_LABEL,
  VT_SCANNER_STATUS_CONFIG,
  isVtScannerInputValid,
  isVtScannerUrlInput,
  createVtScannerNetworkError,
} = await import("../src/components/vt-scanner.tsx");

const VALID_SHA256 = "a".repeat(64);

test("VT_SCANNER_DEFAULT_LABEL is Russian prompt for game file check", () => {
  assert.equal(VT_SCANNER_DEFAULT_LABEL, "Проверить файл игры");
});

test("VT_SCANNER_STATUS_CONFIG covers all VT result statuses with Russian labels", () => {
  assert.equal(VT_SCANNER_STATUS_CONFIG.clean.label, "Чисто");
  assert.equal(VT_SCANNER_STATUS_CONFIG.suspicious.label, "Подозрительно");
  assert.equal(VT_SCANNER_STATUS_CONFIG.malicious.label, "Угроза обнаружена");
  assert.equal(VT_SCANNER_STATUS_CONFIG.unknown.label, "Нет в базе VT");
  assert.equal(VT_SCANNER_STATUS_CONFIG.error.label, "Ошибка");
  assert.equal(Object.keys(VT_SCANNER_STATUS_CONFIG).length, 5);
});

test("isVtScannerInputValid accepts 64-char hex SHA-256", () => {
  assert.equal(isVtScannerInputValid(VALID_SHA256), true);
  assert.equal(isVtScannerInputValid(`  ${VALID_SHA256}  `), true);
  assert.equal(isVtScannerInputValid("A".repeat(64)), true);
});

test("isVtScannerInputValid accepts http and https URLs", () => {
  assert.equal(isVtScannerInputValid("https://example.com/installer.exe"), true);
  assert.equal(isVtScannerInputValid("http://files.game/setup.zip"), true);
  assert.equal(isVtScannerInputValid("  https://vt.local/file  "), true);
});

test("isVtScannerInputValid rejects invalid hashes and non-URLs", () => {
  assert.equal(isVtScannerInputValid(""), false);
  assert.equal(isVtScannerInputValid("   "), false);
  assert.equal(isVtScannerInputValid("abc"), false);
  assert.equal(isVtScannerInputValid("a".repeat(63)), false);
  assert.equal(isVtScannerInputValid("g".repeat(64)), false);
  assert.equal(isVtScannerInputValid("ftp://example.com/file"), false);
  assert.equal(isVtScannerInputValid("example.com/file"), false);
});

test("isVtScannerUrlInput detects http(s) only", () => {
  assert.equal(isVtScannerUrlInput("https://game.io/setup.exe"), true);
  assert.equal(isVtScannerUrlInput("http://localhost/file"), true);
  assert.equal(isVtScannerUrlInput(VALID_SHA256), false);
  assert.equal(isVtScannerUrlInput("ftp://example.com"), false);
  assert.equal(isVtScannerUrlInput(""), false);
});

test("createVtScannerNetworkError returns error status with Russian message", () => {
  const err = createVtScannerNetworkError();
  assert.equal(err.status, "error");
  assert.equal(err.errorMessage, "Ошибка сети");
  assert.equal(err.total, 0);
  assert.equal(err.permalink, "");
  assert.equal(err.harmless, 0);
  assert.equal(err.malicious, 0);
});
