import { test } from "node:test";
import assert from "node:assert/strict";

const {
  extractApiErrorPayload,
  formatApiError,
  formatApiErrorPanel,
} = await import("../src/lib/api-errors.ts");

test("extractApiErrorPayload parses string and object shapes", () => {
  assert.deepEqual(extractApiErrorPayload("host offline"), { message: "host offline" });
  assert.equal(extractApiErrorPayload(""), null);
  assert.equal(extractApiErrorPayload(null), null);

  assert.deepEqual(extractApiErrorPayload({ error: "host_busy", message: "Host busy" }), {
    error: "host_busy",
    message: "Host busy",
  });

  assert.deepEqual(
    extractApiErrorPayload({ data: { error: "game_not_found", detail: "no such game" } }),
    { error: "game_not_found", detail: "no such game" },
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

test("formatApiError maps exact English API messages", () => {
  assert.equal(
    formatApiError({ message: "Session not found" }),
    "Сессия не найдена или уже завершена.",
  );
  assert.equal(
    formatApiError({ message: "User not found" }),
    "Пользователь не найден.",
  );
});

test("formatApiError keeps Russian messages and applies patterns for ASCII text", () => {
  assert.equal(
    formatApiError({ message: "Сессия уже завершена" }),
    "Сессия уже завершена",
  );
  assert.equal(
    formatApiError({ message: "fetch failed: network error" }),
    "Ошибка сети. Проверь подключение и попробуй снова.",
  );
  assert.equal(
    formatApiError({ message: "Too many requests" }),
    "Слишком много попыток. Подожди немного и попробуй снова.",
  );
});

test("formatApiError uses fallback for unknown errors", () => {
  const fallback = "Кастомный fallback";
  assert.equal(formatApiError(undefined, fallback), fallback);
  assert.equal(
    formatApiError({ message: "Some obscure diagnostic" }, fallback),
    "Some obscure diagnostic",
  );
});

test("formatApiErrorPanel returns titled panel with translated detail", () => {
  const panel = formatApiErrorPanel(
    { error: "key_balance_exhausted", message: "Balance exhausted" },
    { title: "Ошибка", detail: "Попробуй снова" },
  );
  assert.equal(panel.title, "Баланс API-ключа исчерпан");
  assert.equal(
    panel.detail,
    "Баланс API-ключа исчерпан. Пополните кошелёк ключа.",
  );
});

test("formatApiErrorPanel keeps defaults when payload is empty", () => {
  const defaults = { title: "Заголовок", detail: "Детали" };
  assert.deepEqual(formatApiErrorPanel(null, defaults), defaults);
});
