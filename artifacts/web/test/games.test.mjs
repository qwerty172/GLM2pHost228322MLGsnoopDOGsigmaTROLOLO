import { test } from "node:test";
import assert from "node:assert/strict";

const {
  LZT_PER_USDT,
  DEFAULT_PRICE_PER_MIN_USD,
  HOST_TOKEN_STORAGE_PREFIX,
  BROWSER_HOST_URL_STORAGE_PREFIX,
  buildGamesApiParams,
  extractCategories,
  extractAllGenres,
  computeGlobalMaxLzt,
  filterAndSortGames,
  resolveCoverImageUrl,
  getLiveHostsCount,
  isGameLive,
  formatPriceLabel,
  formatUsdFromLzt,
  getOfflineAvailabilityLabel,
  getPrimaryGameGenre,
  buildSimilarGamesHref,
  getOfflineNotifyMessage,
  parseGamesGenreFromSearch,
} = await import("../src/pages/games-helpers.ts");

const emptyBoolFilters = {
  hasMods: false,
  isMultiplayer: false,
  hostSpectatesPlayer: false,
  hasQuests: false,
};

test("LZT_PER_USDT and storage prefixes are stable", () => {
  assert.equal(LZT_PER_USDT, 200);
  assert.equal(DEFAULT_PRICE_PER_MIN_USD, 0.04);
  assert.equal(HOST_TOKEN_STORAGE_PREFIX, "streamline.browserHostToken:");
  assert.equal(BROWSER_HOST_URL_STORAGE_PREFIX, "streamline.browserHostUrl:");
});

test("buildGamesApiParams includes active bool filters, liveOnly, search and category", () => {
  assert.deepEqual(
    buildGamesApiParams({
      boolFilters: { ...emptyBoolFilters, hasMods: true, isMultiplayer: true },
      liveOnly: true,
      debouncedSearch: "  cs2  ",
      category: "FPS",
    }),
    {
      hasMods: true,
      isMultiplayer: true,
      liveOnly: true,
      search: "cs2",
      category: "FPS",
    },
  );
  assert.deepEqual(
    buildGamesApiParams({
      boolFilters: emptyBoolFilters,
      liveOnly: false,
      debouncedSearch: "   ",
      category: "",
    }),
    {},
  );
});

test("extractCategories returns sorted unique categories", () => {
  const games = [
    { category: "RPG" },
    { category: "FPS" },
    { category: "RPG" },
    {},
  ];
  assert.deepEqual(extractCategories(games), ["FPS", "RPG"]);
});

test("extractAllGenres merges genres array and legacy genre field", () => {
  const games = [
    { genres: ["Action", "Shooter"] },
    { genre: "Puzzle" },
    { genres: ["Action"], genre: "Indie" },
  ];
  assert.deepEqual(extractAllGenres(games), ["Action", "Indie", "Puzzle", "Shooter"]);
});

test("computeGlobalMaxLzt uses max price or default fallback", () => {
  assert.equal(computeGlobalMaxLzt([{ minPricePerMinuteLzt: 5 }, { minPricePerMinuteLzt: 12 }]), 12);
  assert.equal(computeGlobalMaxLzt([]), Math.round(DEFAULT_PRICE_PER_MIN_USD * LZT_PER_USDT * 3));
});

test("filterAndSortGames filters by price and genres", () => {
  const games = [
    { slug: "a", minPricePerMinuteLzt: 5, genres: ["Action"] },
    { slug: "b", minPricePerMinuteLzt: 20, genres: ["RPG"] },
    { slug: "c", minPricePerMinuteLzt: 8, genre: "Action" },
  ];
  const filtered = filterAndSortGames(games, "cheapest", 10, ["Action"]);
  assert.deepEqual(filtered.map((g) => g.slug), ["a", "c"]);
});

test("filterAndSortGames sorts by mostOnline, cheapest and newest", () => {
  const games = [
    { slug: "a", liveHostsCount: 2, minPricePerMinuteLzt: 10, createdAt: "2024-01-01" },
    { slug: "b", liveHostsCount: 5, minPricePerMinuteLzt: 5, createdAt: "2024-06-01" },
    { slug: "c", liveHostsCount: 1, minPricePerMinuteLzt: 20, createdAt: "2025-01-01" },
  ];
  assert.deepEqual(
    filterAndSortGames(games, "mostOnline", 999, []).map((g) => g.slug),
    ["b", "a", "c"],
  );
  assert.deepEqual(
    filterAndSortGames(games, "cheapest", 999, []).map((g) => g.slug),
    ["b", "a", "c"],
  );
  assert.deepEqual(
    filterAndSortGames(games, "newest", 999, []).map((g) => g.slug),
    ["c", "b", "a"],
  );
});

test("resolveCoverImageUrl handles absolute and relative paths", () => {
  assert.equal(resolveCoverImageUrl("https://cdn/img.png", "/"), "https://cdn/img.png");
  assert.equal(resolveCoverImageUrl("/covers/a.png", "https://app/"), "https://app/covers/a.png");
});

test("getLiveHostsCount prefers liveHostsCount over liveSessionCount", () => {
  assert.equal(getLiveHostsCount({ liveHostsCount: 3, liveSessionCount: 10 }), 3);
  assert.equal(getLiveHostsCount({ liveSessionCount: 7 }), 7);
  assert.equal(getLiveHostsCount({}), 0);
});

test("isGameLive is true when host count is positive", () => {
  assert.equal(isGameLive({ liveHostsCount: 1 }), true);
  assert.equal(isGameLive({ liveHostsCount: 0 }), false);
});

test("formatPriceLabel and formatUsdFromLzt", () => {
  assert.equal(formatPriceLabel(8), "8 LZT/мин");
  assert.equal(formatPriceLabel(null), `${Math.round(DEFAULT_PRICE_PER_MIN_USD * LZT_PER_USDT)} LZT/мин`);
  assert.equal(formatUsdFromLzt(10), "0.050");
});

test("U-28 offline catalog helpers expose honest label and next steps", () => {
  assert.equal(getOfflineAvailabilityLabel(), "Сейчас нет хостов");
  assert.equal(getPrimaryGameGenre({ genres: ["Action", "Shooter"] }), "Action");
  assert.equal(getPrimaryGameGenre({ genre: "Puzzle" }), "Puzzle");
  assert.equal(getPrimaryGameGenre({}), null);
  assert.equal(buildSimilarGamesHref("Action"), "/games?genre=Action");
  assert.equal(buildSimilarGamesHref(null), "/games");
  assert.match(getOfflineNotifyMessage("CS2"), /CS2/);
  assert.equal(parseGamesGenreFromSearch("?genre=Action"), "Action");
  assert.equal(parseGamesGenreFromSearch(""), null);
});
