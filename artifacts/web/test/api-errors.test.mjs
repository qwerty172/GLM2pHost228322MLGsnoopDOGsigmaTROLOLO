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
  assert.equal(extractApiErrorPayload("   "), null);
  assert.equal(extractApiErrorPayload(42), null);
});

test("extractApiErrorPayload parses string and object shapes", () => {
  assert.deepEqual(extractApiErrorPayload("host offline"), { message: "host offline" });
  assert.deepEqual(extractApiErrorPayload({ error: "host_offline" }), { error: "host_offline" });
  assert.deepEqual(extractApiErrorPayload({ message: "Game not found" }), {
    message: "Game not found",
  });
  assert.deepEqual(
    extractApiErrorPayload({ data: { error: "session_not_found", detail: "expired" } }),
    { error: "session_not_found", detail: "expired" },
  );
});

test("extractApiErrorPayload keeps HTTP-prefixed message when set explicitly", () => {
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
  assert.equal(formatApiError({ error: "game_not_found" }), "Игра не найдена.");
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

test("formatApiError matches common English patterns", () => {
  assert.equal(
    formatApiError({ message: "Too many requests, slow down" }),
    "Слишком много попыток. Подожди немного и попробуй снова.",
  );
  assert.equal(
    formatApiError({ message: "fetch failed: network unreachable" }),
    "Ошибка сети. Проверь подключение и попробуй снова.",
  );
});

test("formatApiError keeps Russian text and uses fallback", () => {
  assert.equal(formatApiError({ message: "Сервер перегружен" }), "Сервер перегружен");
  assert.equal(formatApiError(null, "Запасной текст"), "Запасной текст");
  assert.equal(formatApiError({ title: "ignored" }), "Произошла ошибка. Попробуй ещё раз.");
});

test("formatApiErrorPanel maps title by code and detail via formatApiError", () => {
  const panel = formatApiErrorPanel(
    { error: "key_balance_exhausted", message: "balance exhausted" },
    { title: "Ошибка", detail: "Попробуйте позже." },
  );
  assert.equal(panel.title, "Баланс API-ключа исчерпан");
  assert.equal(
    panel.detail,
    "Баланс API-ключа исчерпан. Пополните кошелёк ключа.",
  );
});

test("formatApiErrorPanel returns defaults when payload is missing", () => {
  const defaults = { title: "Не удалось подключиться", detail: "Проверьте ссылку." };
  assert.deepEqual(formatApiErrorPanel(null, defaults), defaults);
});
