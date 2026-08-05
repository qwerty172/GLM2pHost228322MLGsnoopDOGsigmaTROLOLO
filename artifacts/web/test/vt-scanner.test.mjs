import { test } from "node:test";
import assert from "node:assert/strict";

const {
  VT_SCANNER_DEFAULT_LABEL,
  VT_SCANNER_STATUS_LABELS,
  VT_SCANNER_NETWORK_ERROR_MESSAGE,
  isVtInputValid,
  isVtUrlInput,
  canScanVt,
  createVtNetworkErrorResult,
} = await import("../src/components/vt-scanner-helpers.ts");

const VALID_SHA256 = "a".repeat(64);

test("VT_SCANNER_DEFAULT_LABEL is Russian", () => {
  assert.match(VT_SCANNER_DEFAULT_LABEL, /Проверить файл игры/);
});

test("VT_SCANNER_STATUS_LABELS cover all VT result statuses in Russian", () => {
  assert.equal(VT_SCANNER_STATUS_LABELS.clean, "Чисто");
  assert.equal(VT_SCANNER_STATUS_LABELS.suspicious, "Подозрительно");
  assert.equal(VT_SCANNER_STATUS_LABELS.malicious, "Угроза обнаружена");
  assert.equal(VT_SCANNER_STATUS_LABELS.unknown, "Нет в базе VT");
  assert.equal(VT_SCANNER_STATUS_LABELS.error, "Ошибка");
});

test("isVtInputValid accepts SHA-256 hash and http(s) URLs", () => {
  assert.equal(isVtInputValid(VALID_SHA256), true);
  assert.equal(isVtInputValid(`  ${VALID_SHA256}  `), true);
  assert.equal(isVtInputValid("https://example.com/installer.exe"), true);
  assert.equal(isVtInputValid("http://cdn.game/setup.msi"), true);
});

test("isVtInputValid rejects empty, short hash and non-URL text", () => {
  assert.equal(isVtInputValid(""), false);
  assert.equal(isVtInputValid("   "), false);
  assert.equal(isVtInputValid("abc"), false);
  assert.equal(isVtInputValid("g".repeat(64)), false);
  assert.equal(isVtInputValid("ftp://example.com/file"), false);
  assert.equal(isVtInputValid("not-a-url"), false);
});

test("isVtUrlInput detects http(s) URLs only", () => {
  assert.equal(isVtUrlInput("https://example.com/file"), true);
  assert.equal(isVtUrlInput("  http://x  "), true);
  assert.equal(isVtUrlInput(VALID_SHA256), false);
  assert.equal(isVtUrlInput(""), false);
});

test("canScanVt requires valid input, owner token and not scanning", () => {
  assert.equal(canScanVt(VALID_SHA256, "host-token", false), true);
  assert.equal(canScanVt(VALID_SHA256, "", false), false);
  assert.equal(canScanVt("bad", "host-token", false), false);
  assert.equal(canScanVt(VALID_SHA256, "host-token", true), false);
});

test("createVtNetworkErrorResult returns error status with Russian message", () => {
  const result = createVtNetworkErrorResult();
  assert.equal(result.status, "error");
  assert.equal(result.errorMessage, VT_SCANNER_NETWORK_ERROR_MESSAGE);
  assert.match(result.errorMessage, /Ошибка сети/);
  assert.equal(result.total, 0);
  assert.equal(result.permalink, "");
});
