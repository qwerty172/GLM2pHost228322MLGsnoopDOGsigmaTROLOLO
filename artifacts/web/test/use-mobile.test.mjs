import { test } from "node:test";
import assert from "node:assert/strict";

const {
  MOBILE_BREAKPOINT,
  buildMobileMediaQuery,
  isMobileWidth,
} = await import("../src/hooks/use-mobile.tsx");

test("MOBILE_BREAKPOINT is 768", () => {
  assert.equal(MOBILE_BREAKPOINT, 768);
});

test("buildMobileMediaQuery matches max-width 767px", () => {
  assert.equal(buildMobileMediaQuery(), "(max-width: 767px)");
});

test("isMobileWidth is true below breakpoint", () => {
  assert.equal(isMobileWidth(0), true);
  assert.equal(isMobileWidth(767), true);
});

test("isMobileWidth is false at or above breakpoint", () => {
  assert.equal(isMobileWidth(768), false);
  assert.equal(isMobileWidth(1920), false);
});
