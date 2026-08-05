import { test } from "node:test";
import assert from "node:assert/strict";

const {
  MOBILE_BREAKPOINT,
  isMobileViewport,
  mobileMediaQuery,
} = await import("../src/hooks/use-mobile.tsx");

test("MOBILE_BREAKPOINT is 768", () => {
  assert.equal(MOBILE_BREAKPOINT, 768);
});

test("mobileMediaQuery matches max-width 767px", () => {
  assert.equal(mobileMediaQuery(), "(max-width: 767px)");
});

test("isMobileViewport is true below breakpoint", () => {
  assert.equal(isMobileViewport(0), true);
  assert.equal(isMobileViewport(767), true);
});

test("isMobileViewport is false at or above breakpoint", () => {
  assert.equal(isMobileViewport(768), false);
  assert.equal(isMobileViewport(1024), false);
});
