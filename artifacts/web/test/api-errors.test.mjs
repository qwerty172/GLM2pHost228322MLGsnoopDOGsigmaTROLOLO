import { test } from "node:test";
import assert from "node:assert/strict";

const {
  extractApiErrorPayload,
  formatApiError,
  formatApiErrorPanel,
} = await import("../src/lib/api-errors.ts");

test("extractApiErrorPayload returns null for empty input", () => {
  assert.equal(extractApiErrorPayload(null), null);
  assert.equal(extractApiErrorPayload(undefined), null);
  assert.equal(extractApiErrorPayload(""), null);
  assert.equal(extractApiErrorPayload(42), null);
});

test("extractApiErrorPayload parses string and object payloads", () => {
  assert.deepEqual(extractApiErrorPayload("host offline"), { message: "host offline" });
  assert.deepEqual(extractApiErrorPayload({ error: "host_offline" }), { error: "host_offline" });
  assert.deepEqual(
    extractApiErrorPayload({ data: { message: "Session not found", error: "session_not_found" } }),
    { message: "Session not found", error: "session_not_found" },
  );
  assert.deepEqual(extractApiErrorPayload({ message: "HTTP 404 Not Found" }), {
    message: "HTTP 404 Not Found",
  });
});

test("formatApiError translates known error codes to Russian", () => {
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
  assert.equal(formatApiError({ message: "User not found" }), "Пользователь не найден.");
  assert.equal(
    formatApiError({ message: "Session already claimed by another player" }),
    "Сессия уже занята другим игроком.",
  );
});

test("formatApiError keeps Russian messages and matches patterns for English", () => {
  assert.equal(formatApiError({ message: "Сервер недоступен" }), "Сервер недоступен");
  assert.equal(
    formatApiError({ message: "fetch failed: network timeout" }),
    "Ошибка сети. Проверь подключение и попробуй снова.",
  );
  assert.equal(
    formatApiError({ message: "Too many requests" }),
    "Слишком много попыток. Подожди немного и попробуй снова.",
  );
});

test("formatApiError uses fallback when payload is missing; keeps unknown English text", () => {
  const fallback = "Кастомный fallback";
  assert.equal(formatApiError(null, fallback), fallback);
  assert.equal(
    formatApiError({ message: "Some obscure English diagnostic" }, fallback),
    "Some obscure English diagnostic",
  );
});

test("formatApiErrorPanel maps API key errors to titled panels", () => {
  const panel = formatApiErrorPanel(
    { error: "key_balance_exhausted", message: "Balance exhausted" },
    { title: "Ошибка", detail: "Детали" },
  );
  assert.equal(panel.title, "Баланс API-ключа исчерпан");
  assert.equal(
    panel.detail,
    "Баланс API-ключа исчерпан. Пополните кошелёк ключа.",
  );
});

test("formatApiErrorPanel falls back to defaults for unknown errors", () => {
  const defaults = { title: "Заголовок", detail: "Подробности" };
  assert.deepEqual(formatApiErrorPanel(null, defaults), defaults);
});
