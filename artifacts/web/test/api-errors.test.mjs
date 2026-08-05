import { test } from "node:test";
import assert from "node:assert/strict";

const { extractApiErrorPayload, formatApiError, formatApiErrorPanel } = await import(
  "../src/lib/api-errors.ts"
);

test("extractApiErrorPayload returns null for empty values", () => {
  assert.equal(extractApiErrorPayload(null), null);
  assert.equal(extractApiErrorPayload(undefined), null);
  assert.equal(extractApiErrorPayload(""), null);
  assert.equal(extractApiErrorPayload(42), null);
});

test("extractApiErrorPayload parses plain strings", () => {
  assert.deepEqual(extractApiErrorPayload("host offline"), { message: "host offline" });
});

test("extractApiErrorPayload reads top-level and nested data fields", () => {
  assert.deepEqual(extractApiErrorPayload({ error: "host_busy", message: "Host is busy" }), {
    error: "host_busy",
    message: "Host is busy",
  });

  assert.deepEqual(
    extractApiErrorPayload({
      data: { error: "game_not_found", detail: "Game not found" },
    }),
    { error: "game_not_found", detail: "Game not found" },
  );
});

test("formatApiError translates HTTP status lines via pattern matching", () => {
  assert.equal(
    formatApiError({ message: "HTTP 404 Not Found" }),
    "Запрошенный ресурс не найден.",
  );
});

test("formatApiError translates known error codes", () => {
  assert.equal(
    formatApiError({ error: "host_busy", message: "Host is busy" }),
    "У хоста уже идёт сессия — выбери другого или подожди.",
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

test("formatApiError keeps Russian messages as-is", () => {
  const ru = "Сервер временно недоступен — попробуйте позже.";
  assert.equal(formatApiError({ message: ru }), ru);
});

test("formatApiError matches common English patterns", () => {
  assert.equal(
    formatApiError({ message: "Insufficient funds on wallet" }),
    "Недостаточно средств на кошельке. Пополни баланс и попробуй снова.",
  );
  assert.equal(
    formatApiError({ message: "Too many requests, slow down" }),
    "Слишком много попыток. Подожди немного и попробуй снова.",
  );
  assert.equal(
    formatApiError({ message: "fetch failed: network timeout" }),
    "Ошибка сети. Проверь подключение и попробуй снова.",
  );
});

test("formatApiError returns fallback when payload is missing", () => {
  const fallback = "Что-то пошло не так.";
  assert.equal(formatApiError(null, fallback), fallback);
});

test("formatApiErrorPanel uses code-specific titles and translated detail", () => {
  const defaults = { title: "Ошибка", detail: "Попробуйте снова." };
  assert.deepEqual(
    formatApiErrorPanel({ error: "key_balance_exhausted", message: "Balance exhausted" }, defaults),
    {
      title: "Баланс API-ключа исчерпан",
      detail: "Баланс API-ключа исчерпан. Пополните кошелёк ключа.",
    },
  );
});

test("formatApiErrorPanel returns defaults when error is empty", () => {
  const defaults = { title: "Ошибка", detail: "Попробуйте снова." };
  assert.deepEqual(formatApiErrorPanel(null, defaults), defaults);
});
