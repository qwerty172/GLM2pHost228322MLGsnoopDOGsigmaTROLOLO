import { test } from "node:test";
import assert from "node:assert/strict";

const { extractApiErrorPayload, formatApiError, formatApiErrorPanel } = await import(
  "../src/lib/api-errors.ts"
);

test("extractApiErrorPayload parses string and object shapes", () => {
  assert.equal(extractApiErrorPayload(null), null);
  assert.equal(extractApiErrorPayload(""), null);
  assert.deepEqual(extractApiErrorPayload("  host offline  "), { message: "host offline" });
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
    formatApiError({ message: "Session not found" }),
    "Сессия не найдена или уже завершена.",
  );
  assert.equal(
    formatApiError({ message: "Invalid host token" }),
    "Неверный токен хоста.",
  );
});

test("formatApiError keeps Russian text and matches English patterns", () => {
  assert.equal(formatApiError({ message: "Сессия уже завершена" }), "Сессия уже завершена");
  assert.equal(
    formatApiError({ message: "fetch failed: network" }),
    "Ошибка сети. Проверь подключение и попробуй снова.",
  );
  assert.equal(formatApiError(null, "Запасной текст"), "Запасной текст");
});

test("formatApiErrorPanel uses code-specific title and formatted detail", () => {
  const panel = formatApiErrorPanel(
    { error: "key_balance_exhausted", message: "Balance exhausted" },
    { title: "Ошибка", detail: "Попробуй позже" },
  );
  assert.equal(panel.title, "Баланс API-ключа исчерпан");
  assert.equal(panel.detail, "Баланс API-ключа исчерпан. Пополните кошелёк ключа.");

  const defaults = formatApiErrorPanel(null, { title: "Ошибка", detail: "Попробуй позже" });
  assert.deepEqual(defaults, { title: "Ошибка", detail: "Попробуй позже" });
});
