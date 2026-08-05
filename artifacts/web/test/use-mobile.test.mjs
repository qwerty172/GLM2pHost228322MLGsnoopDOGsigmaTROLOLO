import { test } from "node:test";
import assert from "node:assert/strict";

const { MOBILE_BREAKPOINT, isMobileViewportWidth } = await import("../src/hooks/use-mobile.tsx");

test("MOBILE_BREAKPOINT is 768px", () => {
  assert.equal(MOBILE_BREAKPOINT, 768);
});

test("isMobileViewportWidth treats widths below breakpoint as mobile", () => {
  assert.equal(isMobileViewportWidth(0), true);
  assert.equal(isMobileViewportWidth(767), true);
  assert.equal(isMobileViewportWidth(768), false);
  assert.equal(isMobileViewportWidth(1920), false);
});
