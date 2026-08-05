import { test } from "node:test";
import assert from "node:assert/strict";

const {
  extractApiErrorPayload,
  formatApiError,
  formatApiErrorPanel,
} = await import("../src/lib/api-errors.ts");

test("extractApiErrorPayload parses string and object errors", () => {
  assert.equal(extractApiErrorPayload(null), null);
  assert.equal(extractApiErrorPayload(""), null);
  assert.deepEqual(extractApiErrorPayload("host offline"), { message: "host offline" });
  assert.deepEqual(extractApiErrorPayload({ error: "host_offline" }), { error: "host_offline" });
  assert.deepEqual(extractApiErrorPayload({ data: { message: "Game not found" } }), {
    message: "Game not found",
  });
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
  assert.equal(
    formatApiError({ error: "session_already_claimed" }),
    "Сессия уже занята другим игроком.",
  );
});

test("formatApiError translates exact English messages", () => {
  assert.equal(formatApiError({ message: "User not found" }), "Пользователь не найден.");
  assert.equal(formatApiError({ message: "SESSION NOT FOUND" }), "Сессия не найдена или уже завершена.");
  assert.equal(
    formatApiError({ message: "API keys cannot withdraw — deposit-only wallet" }),
    "API-ключи не могут выводить средства — только пополнение.",
  );
});

test("formatApiError matches patterns and preserves non-ASCII text", () => {
  assert.equal(
    formatApiError({ message: "fetch failed: network" }),
    "Ошибка сети. Проверь подключение и попробуй снова.",
  );
  assert.equal(
    formatApiError({ message: "Too many requests, slow down" }),
    "Слишком много попыток. Подожди немного и попробуй снова.",
  );
  assert.equal(
    formatApiError({ message: "У хоста уже идёт сессия" }),
    "У хоста уже идёт сессия",
  );
  assert.equal(formatApiError(null, "Запасной текст"), "Запасной текст");
});

test("formatApiErrorPanel maps title by error code and detail via formatApiError", () => {
  const panel = formatApiErrorPanel(
    { error: "key_balance_exhausted", message: "Balance exhausted" },
    { title: "Ошибка", detail: "Попробуйте позже." },
  );
  assert.equal(panel.title, "Баланс API-ключа исчерпан");
  assert.equal(panel.detail, "Баланс API-ключа исчерпан. Пополните кошелёк ключа.");

  const defaults = formatApiErrorPanel(null, { title: "Ошибка", detail: "Попробуйте позже." });
  assert.deepEqual(defaults, { title: "Ошибка", detail: "Попробуйте позже." });
});
