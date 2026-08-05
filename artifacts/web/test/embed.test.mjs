import { test } from "node:test";
import assert from "node:assert/strict";

const {
  parseEmbedQueryParams,
  buildEmbedMissingParamsError,
  getEmbedEndedTitle,
  getEmbedEndedDetail,
  buildEmbedSignalWsUrl,
} = await import("../src/pages/embed-helpers.ts");

test("parseEmbedQueryParams extracts apiKey, game, resolution and bitrateKbps", () => {
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

test("parseEmbedQueryParams returns empty strings and omits invalid bitrate", () => {
  assert.deepEqual(parseEmbedQueryParams(""), {
    apiKey: "",
    gameSlug: "",
    resolution: undefined,
    bitrateKbps: undefined,
  });
  assert.deepEqual(parseEmbedQueryParams("?apiKey=k&game=g&bitrateKbps=0"), {
    apiKey: "k",
    gameSlug: "g",
    resolution: undefined,
    bitrateKbps: undefined,
  });
  assert.deepEqual(parseEmbedQueryParams("?apiKey=k&game=g&bitrateKbps=NaN"), {
    apiKey: "k",
    gameSlug: "g",
    resolution: undefined,
    bitrateKbps: undefined,
  });
});

test("buildEmbedMissingParamsError describes required query params in Russian", () => {
  assert.deepEqual(buildEmbedMissingParamsError(), {
    error: "missing_params",
    message: "Нужны query-параметры apiKey и game",
  });
});

test("getEmbedEndedTitle maps key_balance_exhausted to Russian title", () => {
  assert.equal(getEmbedEndedTitle("key_balance_exhausted"), "Баланс API-ключа исчерпан");
  assert.equal(getEmbedEndedTitle("ended"), "Сессия завершена");
  assert.equal(getEmbedEndedTitle("host_offline"), "Сессия завершена");
});

test("getEmbedEndedDetail maps key_balance_exhausted and generic reasons", () => {
  assert.equal(
    getEmbedEndedDetail("key_balance_exhausted"),
    "У ключа разработчика закончился баланс. Пополните кошелёк ключа, чтобы продолжить.",
  );
  assert.equal(getEmbedEndedDetail("host_offline"), "Причина: host_offline");
});

test("buildEmbedSignalWsUrl uses wss on https and encodes player token", () => {
  assert.equal(
    buildEmbedSignalWsUrl("tok+/=", "https:", "play.example.com", "/"),
    "wss://play.example.com/api/signal?role=player&playerToken=tok%2B%2F%3D",
  );
  assert.equal(
    buildEmbedSignalWsUrl("abc", "http:", "localhost:5173", "/app/"),
    "ws://localhost:5173/app/api/signal?role=player&playerToken=abc",
  );
});
