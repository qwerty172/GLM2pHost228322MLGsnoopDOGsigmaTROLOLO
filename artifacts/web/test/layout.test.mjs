import { test } from "node:test";
import assert from "node:assert/strict";

const {
  HOST_NAV_ITEMS,
  resolveHostSiteNavActivePath,
  isHostNavItemActive,
} = await import("../src/components/layout.tsx");

test("HOST_NAV_ITEMS lists three host sub-nav links in Russian", () => {
  assert.equal(HOST_NAV_ITEMS.length, 3);
  assert.deepEqual(
    HOST_NAV_ITEMS.map((item) => item.href),
    ["/host", "/host/library", "/host/wallet"],
  );
  assert.deepEqual(
    HOST_NAV_ITEMS.map((item) => item.label),
    ["Дашборд", "Моя библиотека", "Кошелёк"],
  );
});

test("resolveHostSiteNavActivePath maps wallet routes to /host/wallet", () => {
  assert.equal(resolveHostSiteNavActivePath("/host/wallet"), "/host/wallet");
  assert.equal(resolveHostSiteNavActivePath("/host/wallet/history"), "/host/wallet");
});

test("resolveHostSiteNavActivePath maps other host routes to /host", () => {
  assert.equal(resolveHostSiteNavActivePath("/host"), "/host");
  assert.equal(resolveHostSiteNavActivePath("/host/library"), "/host");
  assert.equal(resolveHostSiteNavActivePath("/host/settings"), "/host");
});

test("isHostNavItemActive matches exact location only", () => {
  assert.equal(isHostNavItemActive("/host", "/host"), true);
  assert.equal(isHostNavItemActive("/host/library", "/host/library"), true);
  assert.equal(isHostNavItemActive("/host/wallet", "/host/wallet"), true);
  assert.equal(isHostNavItemActive("/host/wallet", "/host"), false);
  assert.equal(isHostNavItemActive("/host", "/host/library"), false);
});
