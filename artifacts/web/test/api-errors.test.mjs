import { test } from "node:test";
import assert from "node:assert/strict";

const {
  extractApiErrorPayload,
  formatApiError,
  formatApiErrorPanel,
} = await import("../src/lib/api-errors.ts");

test("extractApiErrorPayload handles strings and empty values", () => {
  assert.equal(extractApiErrorPayload(null), null);
  assert.equal(extractApiErrorPayload(""), null);
  assert.equal(extractApiErrorPayload("  "), null);
  assert.deepEqual(extractApiErrorPayload("host offline"), { message: "host offline" });
});

test("extractApiErrorPayload reads top-level and nested data fields", () => {
  assert.deepEqual(extractApiErrorPayload({ error: "host_busy", message: "Host is busy" }), {
    error: "host_busy",
    message: "Host is busy",
  });

  assert.deepEqual(
    extractApiErrorPayload({
      data: { error: "session_not_found", detail: "Session has ended" },
    }),
    {
      error: "session_not_found",
      detail: "Session has ended",
    },
  );

  assert.deepEqual(extractApiErrorPayload({ message: "HTTP 404 Not Found" }), {
    message: "HTTP 404 Not Found",
  });
});

test("formatApiError maps known error codes to Russian", () => {
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
    formatApiError({ message: "User not found" }),
    "Пользователь не найден.",
  );
  assert.equal(
    formatApiError({ message: "Session already claimed by another player" }),
    "Сессия уже занята другим игроком.",
  );
});

test("formatApiError keeps Russian text and applies pattern fallbacks", () => {
  assert.equal(
    formatApiError({ message: "Сервер временно недоступен" }),
    "Сервер временно недоступен",
  );
  assert.equal(
    formatApiError({ message: "fetch failed: network timeout" }),
    "Ошибка сети. Проверь подключение и попробуй снова.",
  );
  assert.equal(
    formatApiError({ message: "Too many requests from this IP" }),
    "Слишком много попыток. Подожди немного и попробуй снова.",
  );
});

test("formatApiError returns fallback for unknown payloads", () => {
  const fallback = "Кастомная ошибка";
  assert.equal(formatApiError(undefined, fallback), fallback);
  assert.equal(formatApiError({}, fallback), fallback);
  assert.equal(formatApiError({ message: "Some unknown English error" }), "Some unknown English error");
});

test("formatApiErrorPanel uses code-specific titles and translated details", () => {
  const panel = formatApiErrorPanel(
    { error: "key_balance_exhausted", message: "Balance exhausted" },
    { title: "Ошибка", detail: "Попробуйте позже." },
  );
  assert.equal(panel.title, "Баланс API-ключа исчерпан");
  assert.equal(
    panel.detail,
    "Баланс API-ключа исчерпан. Пополните кошелёк ключа.",
  );

  const defaults = { title: "Сбой", detail: "Не удалось загрузить." };
  assert.deepEqual(formatApiErrorPanel(null, defaults), defaults);
});
