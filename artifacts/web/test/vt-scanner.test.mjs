import { test } from "node:test";
import assert from "node:assert/strict";

const {
  VT_STATUS_LABELS,
  isValidVtInput,
  canTriggerVtScan,
  isVtUrlInput,
  buildVtNetworkErrorResult,
} = await import("../src/components/vt-scanner.tsx");

const VALID_SHA256 = "a".repeat(64);

test("VT_STATUS_LABELS maps all VT statuses to Russian labels", () => {
  assert.equal(VT_STATUS_LABELS.clean, "Чисто");
  assert.equal(VT_STATUS_LABELS.suspicious, "Подозрительно");
  assert.equal(VT_STATUS_LABELS.malicious, "Угроза обнаружена");
  assert.equal(VT_STATUS_LABELS.unknown, "Нет в базе VT");
  assert.equal(VT_STATUS_LABELS.error, "Ошибка");
});

test("isValidVtInput accepts 64-char hex SHA-256 hashes", () => {
  assert.equal(isValidVtInput(VALID_SHA256), true);
  assert.equal(isValidVtInput(`  ${VALID_SHA256}  `), true);
  assert.equal(isValidVtInput("A".repeat(64)), true);
});

test("isValidVtInput accepts http(s) URLs", () => {
  assert.equal(isValidVtInput("https://example.com/game.exe"), true);
  assert.equal(isValidVtInput("http://cdn.example.com/installer.zip"), true);
  assert.equal(isValidVtInput("  https://example.com  "), true);
});

test("isValidVtInput rejects invalid input", () => {
  assert.equal(isValidVtInput(""), false);
  assert.equal(isValidVtInput("   "), false);
  assert.equal(isValidVtInput("abc"), false);
  assert.equal(isValidVtInput("a".repeat(63)), false);
  assert.equal(isValidVtInput("g".repeat(64)), false);
  assert.equal(isValidVtInput("ftp://example.com/file"), false);
});

test("canTriggerVtScan requires valid input, owner token, and not scanning", () => {
  assert.equal(canTriggerVtScan(VALID_SHA256, "token", false), true);
  assert.equal(canTriggerVtScan(VALID_SHA256, "token", true), false);
  assert.equal(canTriggerVtScan(VALID_SHA256, "", false), false);
  assert.equal(canTriggerVtScan("invalid", "token", false), false);
});

test("isVtUrlInput detects http(s) URLs only", () => {
  assert.equal(isVtUrlInput("https://example.com/file.exe"), true);
  assert.equal(isVtUrlInput("http://example.com"), true);
  assert.equal(isVtUrlInput(`  https://example.com  `), true);
  assert.equal(isVtUrlInput(VALID_SHA256), false);
  assert.equal(isVtUrlInput("ftp://example.com"), false);
});

test("buildVtNetworkErrorResult returns Russian network error payload", () => {
  const result = buildVtNetworkErrorResult();
  assert.equal(result.status, "error");
  assert.equal(result.errorMessage, "Ошибка сети");
  assert.equal(result.total, 0);
  assert.equal(result.permalink, "");
});
