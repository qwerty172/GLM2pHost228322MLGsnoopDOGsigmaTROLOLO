import { test } from "node:test";
import assert from "node:assert/strict";

const { extractApiErrorPayload, formatApiError, formatApiErrorPanel } = await import(
  "../src/lib/api-errors.ts"
);

test("extractApiErrorPayload returns null for empty values", () => {
  assert.equal(extractApiErrorPayload(null), null);
  assert.equal(extractApiErrorPayload(undefined), null);
  assert.equal(extractApiErrorPayload(""), null);
  assert.equal(extractApiErrorPayload("   "), null);
  assert.equal(extractApiErrorPayload(42), null);
});

test("extractApiErrorPayload parses string and object payloads", () => {
  assert.deepEqual(extractApiErrorPayload("host offline"), { message: "host offline" });
  assert.deepEqual(extractApiErrorPayload({ error: "host_busy", message: "Host is busy" }), {
    error: "host_busy",
    message: "Host is busy",
  });
  assert.deepEqual(
    extractApiErrorPayload({ data: { error: "game_not_found", detail: "Game missing" } }),
    { error: "game_not_found", detail: "Game missing" },
  );
  assert.deepEqual(extractApiErrorPayload({ message: "HTTP 404 Not Found" }), {
    message: "HTTP 404 Not Found",
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
    formatApiError({ message: "User not found" }),
    "Пользователь не найден.",
  );
  assert.equal(
    formatApiError({ message: "Session already claimed by another player" }),
    "Сессия уже занята другим игроком.",
  );
});

test("formatApiError keeps Russian messages and uses pattern fallback", () => {
  assert.equal(formatApiError({ message: "Хост недоступен прямо сейчас" }), "Хост недоступен прямо сейчас");
  assert.equal(
    formatApiError({ message: "fetch failed: network timeout" }),
    "Ошибка сети. Проверь подключение и попробуй снова.",
  );
  assert.equal(formatApiError(null, "Запасной текст"), "Запасной текст");
});

test("formatApiError does not leak untranslated English (U-26)", () => {
  assert.equal(
    formatApiError({ message: "Something went wrong internally" }, "Произошла ошибка"),
    "Произошла ошибка",
  );
});

test("formatApiErrorPanel maps API key errors to titled panels", () => {
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
    formatApiErrorPanel(null, { title: "Ошибка", detail: "Подробности" }),
    { title: "Ошибка", detail: "Подробности" },
  );
});
