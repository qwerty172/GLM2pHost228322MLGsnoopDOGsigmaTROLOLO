import { test } from "node:test";
import assert from "node:assert/strict";

const {
  extractApiErrorPayload,
  formatApiError,
  formatApiErrorPanel,
} = await import("../src/lib/api-errors.ts");

test("extractApiErrorPayload parses string and nested data", () => {
  assert.deepEqual(extractApiErrorPayload(" host_busy "), { message: "host_busy" });
  assert.equal(extractApiErrorPayload("   "), null);
  assert.equal(extractApiErrorPayload(null), null);
  assert.equal(extractApiErrorPayload(42), null);

  assert.deepEqual(extractApiErrorPayload({ error: "host_offline", message: "Host is offline" }), {
    error: "host_offline",
    message: "Host is offline",
  });

  assert.deepEqual(
    extractApiErrorPayload({ data: { error: "game_not_found", detail: "Game missing" } }),
    { error: "game_not_found", detail: "Game missing" },
  );

  assert.deepEqual(extractApiErrorPayload({ message: "HTTP 404 Not Found" }), {
    message: "HTTP 404 Not Found",
  });
  assert.deepEqual(extractApiErrorPayload({ message: "plain error" }), { message: "plain error" });
});

test("formatApiError translates known error codes to Russian", () => {
  assert.equal(
    formatApiError({ error: "host_busy", message: "Host is busy" }),
    "У хоста уже идёт сессия — выбери другого или подожди.",
  );
  assert.equal(
    formatApiError({ error: "insufficient_balance" }),
    "Недостаточно средств на кошельке. Пополни баланс и попробуй снова.",
  );
  assert.equal(formatApiError({ error: "HOST_OFFLINE" }), "Хост сейчас офлайн. Выбери другого или попробуй позже.");
});

test("formatApiError translates exact English API messages", () => {
  assert.equal(
    formatApiError({ message: "Session not found" }),
    "Сессия не найдена или уже завершена.",
  );
  assert.equal(
    formatApiError({ message: "API keys cannot withdraw — deposit-only wallet" }),
    "API-ключи не могут выводить средства — только пополнение.",
  );
});

test("formatApiError keeps Russian text and applies pattern fallbacks", () => {
  assert.equal(formatApiError({ message: "Сервер временно недоступен" }), "Сервер временно недоступен");
  assert.equal(
    formatApiError({ message: "Too many requests from this IP" }),
    "Слишком много попыток. Подожди немного и попробуй снова.",
  );
  assert.equal(
    formatApiError({ message: "fetch failed: network timeout" }),
    "Ошибка сети. Проверь подключение и попробуй снова.",
  );
});

test("formatApiError returns fallback for unknown payloads", () => {
  const fallback = "Что-то пошло не так";
  assert.equal(formatApiError(undefined, fallback), fallback);
  assert.equal(formatApiError({}, fallback), fallback);
});

test("formatApiErrorPanel maps title by code and detail via formatApiError", () => {
  assert.deepEqual(
    formatApiErrorPanel(
      { error: "key_balance_exhausted", message: "Balance exhausted" },
      { title: "Ошибка", detail: "Попробуйте позже" },
    ),
    {
      title: "Баланс API-ключа исчерпан",
      detail: "Баланс API-ключа исчерпан. Пополните кошелёк ключа.",
    },
  );

  assert.deepEqual(
    formatApiErrorPanel({ message: "Unknown failure" }, { title: "Ошибка", detail: "Попробуйте позже" }),
    { title: "Ошибка", detail: "Unknown failure" },
  );

  assert.deepEqual(
    formatApiErrorPanel(null, { title: "Ошибка", detail: "Попробуйте позже" }),
    { title: "Ошибка", detail: "Попробуйте позже" },
  );
});
