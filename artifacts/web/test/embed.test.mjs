import { test } from "node:test";
import assert from "node:assert/strict";

const {
  EMBED_MISSING_PARAMS_ERROR,
  parseEmbedQueryParams,
  isEmbedQueryComplete,
  getEmbedEndedCopy,
  buildEmbedSignalWsUrl,
  computeNextWsReconnectDelayMs,
} = await import("../src/pages/embed.tsx");

test("EMBED_MISSING_PARAMS_ERROR describes required query params", () => {
  assert.equal(EMBED_MISSING_PARAMS_ERROR.error, "missing_params");
  assert.match(EMBED_MISSING_PARAMS_ERROR.message, /apiKey/);
  assert.match(EMBED_MISSING_PARAMS_ERROR.message, /game/);
});

test("parseEmbedQueryParams reads apiKey, game, resolution and bitrateKbps", () => {
  assert.deepEqual(
    parseEmbedQueryParams("?apiKey=dev-key&game=cs2&resolution=1080p&bitrateKbps=8000"),
    {
      apiKey: "dev-key",
      gameSlug: "cs2",
      resolution: "1080p",
      bitrateKbps: 8000,
    },
  );
});

test("parseEmbedQueryParams ignores invalid or non-positive bitrateKbps", () => {
  assert.equal(parseEmbedQueryParams("?apiKey=k&game=g&bitrateKbps=0").bitrateKbps, undefined);
  assert.equal(parseEmbedQueryParams("?apiKey=k&game=g&bitrateKbps=abc").bitrateKbps, undefined);
  assert.equal(parseEmbedQueryParams("?apiKey=k&game=g").bitrateKbps, undefined);
});

test("isEmbedQueryComplete requires apiKey and game", () => {
  assert.equal(isEmbedQueryComplete({ apiKey: "k", gameSlug: "g" }), true);
  assert.equal(isEmbedQueryComplete({ apiKey: "", gameSlug: "g" }), false);
  assert.equal(isEmbedQueryComplete({ apiKey: "k", gameSlug: "" }), false);
});

test("getEmbedEndedCopy maps key_balance_exhausted and generic reasons", () => {
  const exhausted = getEmbedEndedCopy("key_balance_exhausted");
  assert.match(exhausted.title, /баланс/i);
  assert.match(exhausted.detail, /кошел/i);

  const generic = getEmbedEndedCopy("host_offline");
  assert.equal(generic.title, "Сессия завершена");
  assert.equal(generic.detail, "Причина: host_offline");
});

test("buildEmbedSignalWsUrl uses wss on https and encodes player token", () => {
  const url = buildEmbedSignalWsUrl("https:", "play.example.com", "/", "tok/en");
  assert.equal(
    url,
    "wss://play.example.com/api/signal?role=player&playerToken=tok%2Fen",
  );
  assert.equal(
    buildEmbedSignalWsUrl("http:", "localhost:3000", "/app/", "abc"),
    "ws://localhost:3000/app/api/signal?role=player&playerToken=abc",
  );
});

test("computeNextWsReconnectDelayMs doubles delay up to 8000ms", () => {
  assert.equal(computeNextWsReconnectDelayMs(1000), 2000);
  assert.equal(computeNextWsReconnectDelayMs(5000), 8000);
  assert.equal(computeNextWsReconnectDelayMs(8000), 8000);
});
