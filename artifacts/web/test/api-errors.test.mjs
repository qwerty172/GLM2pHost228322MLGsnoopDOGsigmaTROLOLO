import { test } from "node:test";
import assert from "node:assert/strict";

const {
  extractApiErrorPayload,
  formatApiError,
  formatApiErrorPanel,
} = await import("../src/lib/api-errors.ts");

test("extractApiErrorPayload parses string and nested data", () => {
  assert.deepEqual(extractApiErrorPayload(" host offline "), { message: "host offline" });
  assert.deepEqual(extractApiErrorPayload(null), null);
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
});

test("formatApiError maps known error codes to Russian", () => {
  assert.equal(
    formatApiError({ error: "host_offline", message: "Host is offline" }),
    "Хост сейчас офлайн. Выбери другого или попробуй позже.",
  );
  assert.equal(
    formatApiError({ error: "insufficient_balance", message: "Insufficient balance" }),
    "Недостаточно средств на кошельке. Пополни баланс и попробуй снова.",
  );
  assert.equal(formatApiError({ error: "session_not_found" }), "Сессия не найдена или уже завершена.");
});

test("formatApiError translates exact English API messages", () => {
  assert.equal(formatApiError({ message: "User not found" }), "Пользователь не найден.");
  assert.equal(
    formatApiError({ message: "Session already claimed by another player" }),
    "Сессия уже занята другим игроком.",
  );
});

test("formatApiError keeps Russian text and uses fallback when empty", () => {
  assert.equal(formatApiError({ message: "Сессия недоступна" }), "Сессия недоступна");
  assert.equal(formatApiError(null, "Запасной текст"), "Запасной текст");
  assert.equal(formatApiError({ message: "Something totally unknown xyz" }), "Something totally unknown xyz");
});

test("formatApiErrorPanel picks title by code and detail via formatApiError", () => {
  assert.deepEqual(
    formatApiErrorPanel(
      { error: "key_balance_exhausted", message: "Balance exhausted" },
      { title: "Ошибка", detail: "Подробности" },
    ),
    {
      title: "Баланс API-ключа исчерпан",
      detail: "Баланс API-ключа исчерпан. Пополните кошелёк ключа.",
    },
  );
  assert.deepEqual(
    formatApiErrorPanel(null, { title: "Заголовок", detail: "Детали" }),
    { title: "Заголовок", detail: "Детали" },
  );
});
