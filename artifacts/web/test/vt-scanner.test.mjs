import { test } from "node:test";
import assert from "node:assert/strict";

const {
  VT_SCANNER_DEFAULT_LABEL,
  VT_SCANNER_STATUS_LABELS,
  isVtScannerInputValid,
  canVtScannerScan,
  isVtScannerUrlInput,
  buildVtScannerNetworkErrorResult,
} = await import("../src/components/vt-scanner.tsx");

const VALID_SHA256 = "a".repeat(64);

test("VT_SCANNER_DEFAULT_LABEL is Russian", () => {
  assert.equal(VT_SCANNER_DEFAULT_LABEL, "Проверить файл игры");
});

test("VT_SCANNER_STATUS_LABELS covers all VT result statuses in Russian", () => {
  assert.equal(VT_SCANNER_STATUS_LABELS.clean, "Чисто");
  assert.equal(VT_SCANNER_STATUS_LABELS.suspicious, "Подозрительно");
  assert.equal(VT_SCANNER_STATUS_LABELS.malicious, "Угроза обнаружена");
  assert.equal(VT_SCANNER_STATUS_LABELS.unknown, "Нет в базе VT");
  assert.equal(VT_SCANNER_STATUS_LABELS.error, "Ошибка");
});

test("isVtScannerInputValid accepts 64-char hex SHA-256", () => {
  assert.equal(isVtScannerInputValid(VALID_SHA256), true);
  assert.equal(isVtScannerInputValid(`  ${VALID_SHA256}  `), true);
  assert.equal(isVtScannerInputValid(VALID_SHA256.toUpperCase()), true);
});

test("isVtScannerInputValid accepts http(s) URLs", () => {
  assert.equal(isVtScannerInputValid("https://example.com/installer.exe"), true);
  assert.equal(isVtScannerInputValid("http://files.game/setup.zip"), true);
  assert.equal(isVtScannerInputValid("  https://x.y/z  "), true);
});

test("isVtScannerInputValid rejects empty, short hex and non-URLs", () => {
  assert.equal(isVtScannerInputValid(""), false);
  assert.equal(isVtScannerInputValid("   "), false);
  assert.equal(isVtScannerInputValid("abc"), false);
  assert.equal(isVtScannerInputValid("a".repeat(63)), false);
  assert.equal(isVtScannerInputValid("ftp://example.com/file"), false);
  assert.equal(isVtScannerInputValid("example.com/file"), false);
});

test("canVtScannerScan requires valid input, owner token and idle state", () => {
  assert.equal(canVtScannerScan(VALID_SHA256, "owner-token", false), true);
  assert.equal(canVtScannerScan(VALID_SHA256, "owner-token", true), false);
  assert.equal(canVtScannerScan("bad", "owner-token", false), false);
  assert.equal(canVtScannerScan(VALID_SHA256, "", false), false);
});

test("isVtScannerUrlInput detects http(s) prefix after trim", () => {
  assert.equal(isVtScannerUrlInput("https://game.example/setup.exe"), true);
  assert.equal(isVtScannerUrlInput("  http://localhost/file  "), true);
  assert.equal(isVtScannerUrlInput(VALID_SHA256), false);
  assert.equal(isVtScannerUrlInput("ftp://example.com"), false);
});

test("buildVtScannerNetworkErrorResult returns Russian network error payload", () => {
  const result = buildVtScannerNetworkErrorResult();
  assert.equal(result.status, "error");
  assert.equal(result.errorMessage, "Ошибка сети");
  assert.equal(result.total, 0);
  assert.equal(result.permalink, "");
});
