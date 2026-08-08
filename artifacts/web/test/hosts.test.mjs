import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const {
  formatPrice,
  resolveCoverImageUrl,
  getLatencyColor,
  computeTotalLatency,
  mapSessionHttpStatus,
  resolveSessionConnectNavigation,
  readHostPcSpecs,
  getMinGamePriceLzt,
  sortPublicHosts,
} = await import("../src/pages/hosts-helpers.ts");

function host(overrides = {}) {
  return {
    id: "h1",
    displayName: "Host",
    boundAppLabel: "app",
    boundUrlHost: "",
    tags: [],
    pricePerHourUsd: 2.4,
    launchPriceUsd: 0,
    minutePriceUsd: 0.04,
    status: "online",
    inviteCode: null,
    ...overrides,
  };
}

test("formatPrice formats positive, negative and zero USD", () => {
  assert.equal(formatPrice(2.4), "$2.40");
  assert.equal(formatPrice(-0.05), "−$0.05");
  assert.equal(formatPrice(0), "$0.00");
});

test("resolveCoverImageUrl handles absolute and relative paths", () => {
  assert.equal(resolveCoverImageUrl("https://cdn/img.png", "/"), "https://cdn/img.png");
  assert.equal(resolveCoverImageUrl("/covers/a.png", "https://app/"), "https://app/covers/a.png");
  assert.equal(resolveCoverImageUrl(null, "/"), null);
  assert.equal(resolveCoverImageUrl("", "/"), null);
});

test("getLatencyColor returns green, yellow and red thresholds", () => {
  assert.equal(getLatencyColor(50), "#22c55e");
  assert.equal(getLatencyColor(100), "#eab308");
  assert.equal(getLatencyColor(200), "#ef4444");
});

test("computeTotalLatency sums browser RTT and host ping", () => {
  assert.equal(computeTotalLatency(20, 30), 50);
  assert.equal(computeTotalLatency(null, 40), 40);
  assert.equal(computeTotalLatency(10, null), null);
});

test("mapSessionHttpStatus maps API errors to session failure reasons", () => {
  assert.equal(mapSessionHttpStatus(409), "game_unavailable");
  assert.equal(mapSessionHttpStatus(503), "host_offline");
  assert.equal(mapSessionHttpStatus(404), "host_offline");
  assert.equal(mapSessionHttpStatus(500), "error");
  assert.equal(mapSessionHttpStatus(undefined), "error");
});

test("resolveSessionConnectNavigation does not fallback on game_unavailable", () => {
  const unavailable = { ok: false, reason: "game_unavailable" };
  assert.deepEqual(resolveSessionConnectNavigation(unavailable, "cyberpunk", "other-invite"), {
    action: "game_page",
    slug: "cyberpunk",
  });
});

test("resolveSessionConnectNavigation uses invite on success", () => {
  assert.deepEqual(
    resolveSessionConnectNavigation({ ok: true, inviteCode: "abc123" }, "cyberpunk", null),
    { action: "play", inviteCode: "abc123" },
  );
});

test("resolveSessionConnectNavigation falls back to list invite on host_offline", () => {
  assert.deepEqual(
    resolveSessionConnectNavigation({ ok: false, reason: "host_offline" }, "cyberpunk", "list-inv"),
    { action: "play", inviteCode: "list-inv" },
  );
});

test("readHostPcSpecs returns null for missing or empty specs", () => {
  assert.equal(readHostPcSpecs(undefined), null);
  assert.equal(readHostPcSpecs(null), null);
  assert.equal(readHostPcSpecs("bad"), null);
  assert.equal(readHostPcSpecs({}), null);
  assert.equal(readHostPcSpecs({ cpu: 123, gpu: true }), null);
});

test("readHostPcSpecs extracts known string and number fields", () => {
  assert.deepEqual(readHostPcSpecs({ cpu: "Ryzen 7", gpu: "RTX 4070", ramGb: 32 }), {
    cpu: "Ryzen 7",
    gpu: "RTX 4070",
    ramGb: 32,
  });
  assert.deepEqual(readHostPcSpecs({ cpu: "i5" }), { cpu: "i5" });
  assert.deepEqual(readHostPcSpecs({ ramGb: 16 }), { ramGb: 16 });
});

test("getMinGamePriceLzt returns minimum LZT price or null", () => {
  assert.equal(
    getMinGamePriceLzt([
      { gameId: "g1", slug: "a", title: "A", pricePerMinuteLzt: 12 },
      { gameId: "g2", slug: "b", title: "B", pricePerMinuteLzt: 8 },
    ]),
    8,
  );
  assert.equal(getMinGamePriceLzt([]), null);
});

test("sortPublicHosts ranks online first, then above_rec, then by latency", () => {
  const hosts = [
    host({ id: "offline-slow", isOnline: false, hostTier: "meets_min", pingMs: 100 }),
    host({ id: "online-fast", isOnline: true, hostTier: "meets_min", pingMs: 20 }),
    host({ id: "online-top", isOnline: true, hostTier: "above_rec", pingMs: 200 }),
  ];
  const sorted = sortPublicHosts(hosts, 10, false);
  assert.deepEqual(sorted.map((h) => h.id), ["online-top", "online-fast", "offline-slow"]);
});

test("sortPublicHosts filters to online-only when requested", () => {
  const hosts = [
    host({ id: "online", isOnline: true, pingMs: 50 }),
    host({ id: "offline", isOnline: false, pingMs: 10 }),
  ];
  const sorted = sortPublicHosts(hosts, 0, true);
  assert.deepEqual(sorted.map((h) => h.id), ["online"]);
});

test("sortPublicHosts treats missing pingMs as Infinity", () => {
  const hosts = [
    host({ id: "no-ping", isOnline: true, pingMs: null }),
    host({ id: "has-ping", isOnline: true, pingMs: 50 }),
  ];
  const sorted = sortPublicHosts(hosts, 0, false);
  assert.equal(sorted[0].id, "has-ping");
  assert.equal(sorted[1].id, "no-ping");
});

test("hosts.tsx uses inline game select instead of GamePickerDialog (U-23)", () => {
  const src = readFileSync(new URL("../src/pages/hosts.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(src, /GamePickerDialog/);
  assert.match(src, /data-testid=\{`game-select-\$\{hostId\}`\}/);
  assert.doesNotMatch(src, /@\/components\/ui\/dialog/);
});
