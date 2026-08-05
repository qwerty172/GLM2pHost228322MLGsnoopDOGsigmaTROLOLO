import { test } from "node:test";
import assert from "node:assert/strict";

const { extractApiErrorPayload, formatApiError, formatApiErrorPanel } = await import(
  "../src/lib/api-errors.ts"
);

test("extractApiErrorPayload parses string and nested data", () => {
  assert.deepEqual(extractApiErrorPayload("  host offline  "), { message: "host offline" });
  assert.equal(extractApiErrorPayload(""), null);
  assert.equal(extractApiErrorPayload(null), null);

  assert.deepEqual(extractApiErrorPayload({ error: "host_busy", message: "Host is busy" }), {
    error: "host_busy",
    message: "Host is busy",
  });

  assert.deepEqual(
    extractApiErrorPayload({ data: { error: "game_not_found", detail: "Game 42 missing" } }),
    { error: "game_not_found", detail: "Game 42 missing" },
  );

  assert.deepEqual(extractApiErrorPayload({ message: "HTTP 404 Not Found" }), {
    message: "HTTP 404 Not Found",
  });
});

test("formatApiError translates error codes and exact English messages", () => {
  assert.equal(
    formatApiError({ error: "host_offline", message: "Host is not currently available" }),
    "Хост сейчас офлайн. Выбери другого или попробуй позже.",
  );
  assert.equal(formatApiError({ message: "User not found" }), "Пользователь не найден.");
  assert.equal(
    formatApiError({ error: "insufficient_balance", message: "Insufficient balance" }),
    "Недостаточно средств на кошельке. Пополни баланс и попробуй снова.",
  );
});

test("formatApiError keeps Russian text and uses pattern fallback for English", () => {
  assert.equal(formatApiError({ message: "Сессия уже завершена." }), "Сессия уже завершена.");
  assert.equal(
    formatApiError({ message: "Too many requests, slow down" }),
    "Слишком много попыток. Подожди немного и попробуй снова.",
  );
  assert.equal(formatApiError("fetch failed: network"), "Ошибка сети. Проверь подключение и попробуй снова.");
  assert.equal(formatApiError(null, "Запасной текст"), "Запасной текст");
});

test("formatApiErrorPanel maps known codes to Russian title and detail", () => {
  const panel = formatApiErrorPanel(
    { error: "key_balance_exhausted", message: "Balance exhausted" },
    { title: "Ошибка", detail: "Что-то пошло не так" },
  );
  assert.deepEqual(panel, {
    title: "Баланс API-ключа исчерпан",
    detail: "Баланс API-ключа исчерпан. Пополните кошелёк ключа.",
  });

  assert.deepEqual(
    formatApiErrorPanel(null, { title: "Заголовок", detail: "Детали" }),
    { title: "Заголовок", detail: "Детали" },
  );
});
