import { test } from "node:test";
import assert from "node:assert/strict";

const {
  HOST_LAYOUT_NAV_ITEMS,
  getHostSiteNavActivePath,
  isHostNavItemActive,
} = await import("../src/lib/host-layout-nav.ts");

test("HOST_LAYOUT_NAV_ITEMS lists dashboard, library and wallet", () => {
  assert.equal(HOST_LAYOUT_NAV_ITEMS.length, 3);
  assert.deepEqual(
    HOST_LAYOUT_NAV_ITEMS.map((item) => item.href),
    ["/host", "/host/library", "/host/wallet"],
  );
  assert.deepEqual(
    HOST_LAYOUT_NAV_ITEMS.map((item) => item.label),
    ["Дашборд", "Моя библиотека", "Кошелёк"],
  );
});

test("getHostSiteNavActivePath highlights wallet when on /host/wallet", () => {
  assert.equal(getHostSiteNavActivePath("/host/wallet"), "/host/wallet");
  assert.equal(getHostSiteNavActivePath("/host/wallet/history"), "/host/wallet");
});

test("getHostSiteNavActivePath defaults to /host for other host routes", () => {
  assert.equal(getHostSiteNavActivePath("/host"), "/host");
  assert.equal(getHostSiteNavActivePath("/host/library"), "/host");
});

test("isHostNavItemActive matches exact location only", () => {
  assert.equal(isHostNavItemActive("/host/wallet", "/host/wallet"), true);
  assert.equal(isHostNavItemActive("/host/library", "/host/library"), true);
  assert.equal(isHostNavItemActive("/host/wallet", "/host"), false);
  assert.equal(isHostNavItemActive("/host", "/host/library"), false);
});
