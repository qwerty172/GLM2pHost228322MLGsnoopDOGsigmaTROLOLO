import { test } from "node:test";
import assert from "node:assert/strict";

const {
  HOST_LAYOUT_NAV_ITEMS,
  resolveHostSiteNavActivePath,
  isHostNavItemActive,
  hostNavLinkTestId,
} = await import("../src/components/layout.tsx");

test("HOST_LAYOUT_NAV_ITEMS lists dashboard, library and wallet in Russian", () => {
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

test("resolveHostSiteNavActivePath keeps wallet subpaths on wallet tab", () => {
  assert.equal(resolveHostSiteNavActivePath("/host"), "/host");
  assert.equal(resolveHostSiteNavActivePath("/host/library"), "/host");
  assert.equal(resolveHostSiteNavActivePath("/host/wallet"), "/host/wallet");
  assert.equal(resolveHostSiteNavActivePath("/host/wallet/history"), "/host/wallet");
});

test("isHostNavItemActive matches exact host routes only", () => {
  assert.equal(isHostNavItemActive("/host", "/host"), true);
  assert.equal(isHostNavItemActive("/host/library", "/host/library"), true);
  assert.equal(isHostNavItemActive("/host/wallet", "/host/wallet"), true);
  assert.equal(isHostNavItemActive("/host/wallet", "/host"), false);
  assert.equal(isHostNavItemActive("/host", "/host/wallet"), false);
});

test("hostNavLinkTestId slugifies href for data-testid", () => {
  assert.equal(hostNavLinkTestId("/host"), "link-host--host");
  assert.equal(hostNavLinkTestId("/host/library"), "link-host--host-library");
  assert.equal(hostNavLinkTestId("/host/wallet"), "link-host--host-wallet");
});
