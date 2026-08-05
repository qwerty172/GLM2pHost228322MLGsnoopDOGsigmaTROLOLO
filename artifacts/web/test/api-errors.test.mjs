import { test } from "node:test";
import assert from "node:assert/strict";

const {
  extractApiErrorPayload,
  formatApiError,
  formatApiErrorPanel,
} = await import("../src/lib/api-errors.ts");

test("extractApiErrorPayload returns null for empty values", () => {
  assert.equal(extractApiErrorPayload(null), null);
  assert.equal(extractApiErrorPayload(undefined), null);
  assert.equal(extractApiErrorPayload(""), null);
  assert.equal(extractApiErrorPayload(42), null);
});

test("extractApiErrorPayload parses plain string", () => {
  assert.deepEqual(extractApiErrorPayload("  host offline  "), { message: "host offline" });
});

test("extractApiErrorPayload reads fields from object and nested data", () => {
  assert.deepEqual(
    extractApiErrorPayload({ error: "host_busy", message: "Host is busy" }),
    { error: "host_busy", message: "Host is busy" },
  );
  assert.deepEqual(
    extractApiErrorPayload({ data: { error: "game_not_found", detail: "Game 42" } }),
    { error: "game_not_found", detail: "Game 42" },
  );
});

test("extractApiErrorPayload keeps HTTP status in message field when passed directly", () => {
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

test("formatApiError translates exact English messages", () => {
  assert.equal(
    formatApiError({ message: "User not found" }),
    "Пользователь не найден.",
  );
  assert.equal(
    formatApiError({ message: "Session already claimed by another player" }),
    "Сессия уже занята другим игроком.",
  );
});

test("formatApiError keeps Russian messages as-is", () => {
  const ru = "Сервер временно недоступен";
  assert.equal(formatApiError({ message: ru }), ru);
});

test("formatApiError matches English patterns", () => {
  assert.equal(
    formatApiError({ message: "fetch failed: network timeout" }),
    "Ошибка сети. Проверь подключение и попробуй снова.",
  );
  assert.equal(
    formatApiError({ message: "Too many requests, slow down" }),
    "Слишком много попыток. Подожди немного и попробуй снова.",
  );
});

test("formatApiError returns fallback when payload is missing", () => {
  const fallback = "Что-то пошло не так";
  assert.equal(formatApiError(null, fallback), fallback);
  assert.equal(formatApiError({}, fallback), fallback);
});

test("formatApiErrorPanel uses code-specific title and translated detail", () => {
  const defaults = { title: "Ошибка", detail: "Попробуйте позже" };
  const panel = formatApiErrorPanel(
    { error: "key_balance_exhausted", message: "Balance exhausted" },
    defaults,
  );
  assert.equal(panel.title, "Баланс API-ключа исчерпан");
  assert.equal(panel.detail, "Баланс API-ключа исчерпан. Пополните кошелёк ключа.");
});

test("formatApiErrorPanel returns defaults when error is empty", () => {
  const defaults = { title: "Ошибка", detail: "Попробуйте позже" };
  assert.deepEqual(formatApiErrorPanel(null, defaults), defaults);
});
