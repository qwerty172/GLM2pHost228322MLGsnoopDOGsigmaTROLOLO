import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { generateOtp, verifyOtp } from "../src/otp.ts";

describe("generateOtp", () => {
  it("returns exactly 6 decimal digits", () => {
    for (let i = 0; i < 100; i++) {
      assert.match(generateOtp(), /^\d{6}$/);
    }
  });

  it("pads with leading zeros", () => {
    const randomInt = mock.method(crypto, "randomInt", () => 42);
    try {
      assert.equal(generateOtp(), "000042");
    } finally {
      randomInt.mock.restore();
    }
  });

  it("handles the maximum value (999999)", () => {
    const randomInt = mock.method(crypto, "randomInt", () => 999_999);
    try {
      assert.equal(generateOtp(), "999999");
    } finally {
      randomInt.mock.restore();
    }
  });

  it("produces varied values across calls", () => {
    const seen = new Set(Array.from({ length: 50 }, () => generateOtp()));
    assert.ok(seen.size > 1, "expected at least 2 distinct OTPs in 50 calls");
  });
});

describe("verifyOtp", () => {
  it("returns true for matching OTPs", () => {
    assert.equal(verifyOtp("123456", "123456"), true);
  });

  it("returns false for non-matching OTPs of equal length", () => {
    assert.equal(verifyOtp("123456", "654321"), false);
  });

  it("returns false when lengths differ", () => {
    assert.equal(verifyOtp("12345", "123456"), false);
    assert.equal(verifyOtp("1234567", "123456"), false);
    assert.equal(verifyOtp("", "123456"), false);
  });

  it("rejects single-character differences", () => {
    assert.equal(verifyOtp("123456", "123457"), false);
    assert.equal(verifyOtp("000000", "000001"), false);
  });
});
