import { test } from "node:test";
import assert from "node:assert/strict";

const {
  MOBILE_BREAKPOINT,
  MOBILE_MEDIA_QUERY,
  isMobileViewportWidth,
} = await import("../src/hooks/use-mobile.tsx");

test("MOBILE_BREAKPOINT is 768", () => {
  assert.equal(MOBILE_BREAKPOINT, 768);
});

test("MOBILE_MEDIA_QUERY matches one pixel below breakpoint", () => {
  assert.equal(MOBILE_MEDIA_QUERY, "(max-width: 767px)");
});

test("isMobileViewportWidth treats widths below 768 as mobile", () => {
  assert.equal(isMobileViewportWidth(320), true);
  assert.equal(isMobileViewportWidth(767), true);
});

test("isMobileViewportWidth treats 768 and above as desktop", () => {
  assert.equal(isMobileViewportWidth(768), false);
  assert.equal(isMobileViewportWidth(1920), false);
});
