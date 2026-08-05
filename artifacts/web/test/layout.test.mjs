import { test } from "node:test";
import assert from "node:assert/strict";

const {
  HOST_LAYOUT_NAV_ITEMS,
  resolveHostSiteNavActivePath,
  hostNavLinkTestId,
} = await import("../src/components/layout.tsx");

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

test("resolveHostSiteNavActivePath highlights wallet on wallet routes", () => {
  assert.equal(resolveHostSiteNavActivePath("/host/wallet"), "/host/wallet");
  assert.equal(resolveHostSiteNavActivePath("/host/wallet/history"), "/host/wallet");
});

test("resolveHostSiteNavActivePath defaults to host dashboard elsewhere", () => {
  assert.equal(resolveHostSiteNavActivePath("/host"), "/host");
  assert.equal(resolveHostSiteNavActivePath("/host/library"), "/host");
  assert.equal(resolveHostSiteNavActivePath("/host/settings"), "/host");
});

test("hostNavLinkTestId slugifies href for data-testid", () => {
  assert.equal(hostNavLinkTestId("/host"), "link-host--host");
  assert.equal(hostNavLinkTestId("/host/library"), "link-host--host-library");
  assert.equal(hostNavLinkTestId("/host/wallet"), "link-host--host-wallet");
});
