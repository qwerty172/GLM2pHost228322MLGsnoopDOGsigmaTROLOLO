import { test } from "node:test";
import assert from "node:assert/strict";

const {
  HOST_NAV_ITEMS,
  resolveHostSiteNavActivePath,
  isHostNavItemActive,
  hostNavLinkTestId,
} = await import("../src/components/layout.tsx");

test("HOST_NAV_ITEMS lists three host dashboard links", () => {
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

test("resolveHostSiteNavActivePath highlights wallet for wallet routes", () => {
  assert.equal(resolveHostSiteNavActivePath("/host/wallet"), "/host/wallet");
  assert.equal(resolveHostSiteNavActivePath("/host/wallet/history"), "/host/wallet");
});

test("resolveHostSiteNavActivePath defaults to /host elsewhere", () => {
  assert.equal(resolveHostSiteNavActivePath("/host"), "/host");
  assert.equal(resolveHostSiteNavActivePath("/host/library"), "/host");
  assert.equal(resolveHostSiteNavActivePath("/host/settings"), "/host");
});

test("isHostNavItemActive matches exact location", () => {
  assert.equal(isHostNavItemActive("/host", "/host"), true);
  assert.equal(isHostNavItemActive("/host/library", "/host/library"), true);
  assert.equal(isHostNavItemActive("/host/library", "/host"), false);
  assert.equal(isHostNavItemActive("/host/wallet", "/host"), false);
});

test("hostNavLinkTestId converts slashes to dashes", () => {
  assert.equal(hostNavLinkTestId("/host"), "link-host--host");
  assert.equal(hostNavLinkTestId("/host/library"), "link-host--host-library");
  assert.equal(hostNavLinkTestId("/host/wallet"), "link-host--host-wallet");
});
