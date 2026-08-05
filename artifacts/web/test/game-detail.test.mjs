import { test } from "node:test";
import assert from "node:assert/strict";

const {
  DAY_LABELS,
  formatMinuteOfDay,
  formatScheduleSummary,
  chip,
  sortHostsByLatency,
  formatDuration,
  getLatencyColor,
  getLatencyLabel,
  computeTotalLatency,
  filterHostsByTag,
  resolveCoverImageUrl,
  getPingColor,
  getPingLabel,
  computeMinsAvailable,
  canAffordBlock,
} = await import("../src/pages/game-detail-helpers.ts");

function host(overrides = {}) {
  return {
    hostId: "h1",
    displayName: "Host",
    pricePerMinuteLzt: 10,
    pricePerMinuteUsd: 0.05,
    status: "online",
    ...overrides,
  };
}

test("DAY_LABELS has 7 Russian day abbreviations", () => {
  assert.equal(DAY_LABELS.length, 7);
  assert.equal(DAY_LABELS[0], "Вс");
  assert.equal(DAY_LABELS[1], "Пн");
});

test("formatMinuteOfDay pads hours and minutes", () => {
  assert.equal(formatMinuteOfDay(0), "00:00");
  assert.equal(formatMinuteOfDay(90), "01:30");
  assert.equal(formatMinuteOfDay(1439), "23:59");
});

test("formatScheduleSummary formats slots and truncates", () => {
  assert.equal(formatScheduleSummary([]), "нет слотов");
  const slots = [
    { day: 1, startMin: 60, endMin: 120 },
    { day: 3, startMin: 0, endMin: 30 },
  ];
  assert.equal(formatScheduleSummary(slots), "Пн 01:00–02:00, Ср 00:00–00:30");
  const many = Array.from({ length: 5 }, (_, i) => ({ day: i, startMin: 0, endMin: 60 }));
  assert.match(formatScheduleSummary(many), /…$/);
});

test("chip returns active/inactive styles", () => {
  assert.equal(chip(true).background, "#0ea5e9");
  assert.equal(chip(true).color, "#fff");
  assert.equal(chip(false).background, "rgba(14,165,233,0.08)");
  assert.equal(chip(false).color, "#7dd3fc");
});

test("sortHostsByLatency ranks above_rec first, then by latency", () => {
  const hosts = [
    host({ hostId: "slow", hostTier: "meets_min", pingMs: 100 }),
    host({ hostId: "fast", hostTier: "meets_min", pingMs: 20 }),
    host({ hostId: "top", hostTier: "above_rec", pingMs: 200 }),
  ];
  const sorted = sortHostsByLatency(hosts, 10);
  assert.deepEqual(sorted.map((h) => h.hostId), ["top", "fast", "slow"]);
});

test("sortHostsByLatency treats missing pingMs as Infinity", () => {
  const hosts = [
    host({ hostId: "no-ping", pingMs: null }),
    host({ hostId: "has-ping", pingMs: 50 }),
  ];
  const sorted = sortHostsByLatency(hosts, 0);
  assert.equal(sorted[0].hostId, "has-ping");
  assert.equal(sorted[1].hostId, "no-ping");
});

test("formatDuration formats minutes and hours", () => {
  assert.equal(formatDuration(0), "0 мин");
  assert.equal(formatDuration(45), "45 мин");
  assert.equal(formatDuration(60), "1 ч");
  assert.equal(formatDuration(90), "1 ч 30 мин");
});

test("getLatencyColor and getLatencyLabel tier by ms", () => {
  assert.equal(getLatencyColor(50), "#22c55e");
  assert.equal(getLatencyColor(100), "#eab308");
  assert.equal(getLatencyColor(200), "#ef4444");
  assert.equal(getLatencyLabel(50), "низкая задержка");
  assert.equal(getLatencyLabel(100), "средняя задержка");
  assert.equal(getLatencyLabel(200), "высокая задержка");
});

test("computeTotalLatency sums browser RTT and host ping", () => {
  assert.equal(computeTotalLatency(20, 30), 50);
  assert.equal(computeTotalLatency(null, 30), 30);
  assert.equal(computeTotalLatency(20, null), null);
});

test("filterHostsByTag matches case-insensitively", () => {
  const hosts = [
    host({ hostId: "a", tags: ["Pro"] }),
    host({ hostId: "b", tags: ["casual"] }),
  ];
  assert.deepEqual(filterHostsByTag(hosts, "").map((h) => h.hostId), ["a", "b"]);
  assert.deepEqual(filterHostsByTag(hosts, "pro").map((h) => h.hostId), ["a"]);
});

test("resolveCoverImageUrl handles absolute and relative paths", () => {
  assert.equal(resolveCoverImageUrl("https://cdn/img.png", "/"), "https://cdn/img.png");
  assert.equal(resolveCoverImageUrl("/covers/a.png", "https://app/"), "https://app/covers/a.png");
});

test("getPingColor and getPingLabel for pre-session ping", () => {
  assert.equal(getPingColor(null), "#64748b");
  assert.equal(getPingLabel(null), "нет данных");
  assert.equal(getPingColor(40), "#2dd4bf");
  assert.equal(getPingLabel(40), "отлично");
  assert.equal(getPingColor(80), "#eab308");
  assert.equal(getPingLabel(80), "нормально");
  assert.equal(getPingColor(150), "#ef4444");
  assert.equal(getPingLabel(150), "высокий");
});

test("computeMinsAvailable and canAffordBlock", () => {
  assert.equal(computeMinsAvailable(1000, 10), 100);
  assert.equal(computeMinsAvailable(500, 0), 9999);
  assert.equal(canAffordBlock(100, 50), true);
  assert.equal(canAffordBlock(100, null), true);
  assert.equal(canAffordBlock(50, 100), false);
});
