import { test } from "node:test";
import assert from "node:assert/strict";

const { extractApiErrorPayload, formatApiError, formatApiErrorPanel } = await import(
  "../src/lib/api-errors.ts"
);

test("extractApiErrorPayload returns null for empty input", () => {
  assert.equal(extractApiErrorPayload(null), null);
  assert.equal(extractApiErrorPayload(undefined), null);
  assert.equal(extractApiErrorPayload(""), null);
  assert.equal(extractApiErrorPayload(42), null);
});

test("extractApiErrorPayload parses plain string", () => {
  assert.deepEqual(extractApiErrorPayload("host offline"), { message: "host offline" });
});

test("extractApiErrorPayload reads top-level and nested data fields", () => {
  assert.deepEqual(extractApiErrorPayload({ error: "host_offline", message: "Host is down" }), {
    error: "host_offline",
    message: "Host is down",
  });
  assert.deepEqual(
    extractApiErrorPayload({ data: { error: "game_not_found", detail: "missing" } }),
    { error: "game_not_found", detail: "missing" },
  );
});

test("extractApiErrorPayload collects title and reason fields", () => {
  assert.deepEqual(extractApiErrorPayload({ error: "forbidden", reason: "quota exceeded" }), {
    error: "forbidden",
    reason: "quota exceeded",
  });
});

test("formatApiError translates known error codes", () => {
  assert.equal(
    formatApiError({ error: "host_offline", message: "Host is offline" }),
    "Хост сейчас офлайн. Выбери другого или попробуй позже.",
  );
  assert.equal(
    formatApiError({ error: "insufficient_balance" }),
    "Недостаточно средств на кошельке. Пополни баланс и попробуй снова.",
  );
});

test("formatApiError translates exact English API messages", () => {
  assert.equal(
    formatApiError({ message: "session not found" }),
    "Сессия не найдена или уже завершена.",
  );
  assert.equal(
    formatApiError({ message: "not authenticated" }),
    "Требуется авторизация.",
  );
});

test("formatApiError matches common English patterns", () => {
  assert.equal(
    formatApiError({ message: "Too many requests from this IP" }),
    "Слишком много попыток. Подожди немного и попробуй снова.",
  );
  assert.equal(
    formatApiError({ message: "fetch failed: network error" }),
    "Ошибка сети. Проверь подключение и попробуй снова.",
  );
});

test("formatApiError keeps Russian messages as-is", () => {
  const ru = "Сервер временно недоступен — попробуй позже.";
  assert.equal(formatApiError({ message: ru }), ru);
});

test("formatApiError uses fallback when payload is empty", () => {
  assert.equal(formatApiError(null), "Произошла ошибка. Попробуй ещё раз.");
  assert.equal(formatApiError(null, "Кастомный fallback"), "Кастомный fallback");
});

test("formatApiErrorPanel maps title by error code and detail via formatApiError", () => {
  assert.deepEqual(
    formatApiErrorPanel(
      { error: "key_balance_exhausted", message: "Balance is exhausted" },
      { title: "Ошибка", detail: "Подробности" },
    ),
    {
      title: "Баланс API-ключа исчерпан",
      detail: "Баланс API-ключа исчерпан. Пополните кошелёк ключа.",
    },
  );
});

test("formatApiErrorPanel falls back to defaults when payload is missing", () => {
  const defaults = { title: "Не удалось загрузить", detail: "Попробуй обновить страницу." };
  assert.deepEqual(formatApiErrorPanel(null, defaults), defaults);
});
