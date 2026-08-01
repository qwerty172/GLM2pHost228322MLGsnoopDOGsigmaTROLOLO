// Unit tests for limited-user launch guards (no Electron dependency).
import { test } from "node:test";
import assert from "node:assert/strict";

const { validateLimitedUserLaunch } = await import(
  "../dist/main/main/limited-user-guards.js"
);

test("validateLimitedUserLaunch rejects non-Windows platforms", () => {
  const result = validateLimitedUserLaunch(
    {
      enabled: true,
      username: "Player",
      password: "secret",
    },
    "linux",
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /Windows-only/i);
  }
});

test("validateLimitedUserLaunch rejects disabled credentials", () => {
  const result = validateLimitedUserLaunch(
    {
      enabled: false,
      username: "Player",
      password: "secret",
    },
    "win32",
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /not configured/i);
  }
});

test("validateLimitedUserLaunch rejects empty username/password", () => {
  const result = validateLimitedUserLaunch(
    {
      enabled: true,
      username: "",
      password: "",
    },
    "win32",
  );
  assert.equal(result.ok, false);
});

test("validateLimitedUserLaunch accepts valid Windows config", () => {
  const result = validateLimitedUserLaunch(
    {
      enabled: true,
      username: "Player",
      password: "secret",
      domain: "WORKGROUP",
    },
    "win32",
  );
  assert.equal(result.ok, true);
});
