import { test } from "node:test";
import assert from "node:assert/strict";

const {
  HOST_LAYOUT_NAV_ITEMS,
  resolveHostSiteNavActivePath,
  isHostNavItemActive,
  hostNavLinkTestId,
} = await import("../src/components/layout.tsx");

test("HOST_LAYOUT_NAV_ITEMS lists three Russian host nav links", () => {
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

test("resolveHostSiteNavActivePath maps wallet routes to /host/wallet", () => {
  assert.equal(resolveHostSiteNavActivePath("/host/wallet"), "/host/wallet");
  assert.equal(resolveHostSiteNavActivePath("/host/wallet/history"), "/host/wallet");
});

test("resolveHostSiteNavActivePath maps other host routes to /host", () => {
  assert.equal(resolveHostSiteNavActivePath("/host"), "/host");
  assert.equal(resolveHostSiteNavActivePath("/host/library"), "/host");
});

test("isHostNavItemActive matches exact href only", () => {
  assert.equal(isHostNavItemActive("/host", "/host"), true);
  assert.equal(isHostNavItemActive("/host/library", "/host/library"), true);
  assert.equal(isHostNavItemActive("/host/wallet", "/host"), false);
  assert.equal(isHostNavItemActive("/host/wallet/history", "/host/wallet"), false);
});

test("hostNavLinkTestId replaces slashes with dashes", () => {
  assert.equal(hostNavLinkTestId("/host"), "link-host--host");
  assert.equal(hostNavLinkTestId("/host/library"), "link-host--host-library");
  assert.equal(hostNavLinkTestId("/host/wallet"), "link-host--host-wallet");
});
