import { test } from "node:test";
import assert from "node:assert/strict";

const {
  extractApiErrorPayload,
  formatApiError,
  formatApiErrorPanel,
} = await import("../src/lib/api-errors.ts");

test("extractApiErrorPayload parses string and object shapes", () => {
  assert.deepEqual(extractApiErrorPayload("host offline"), { message: "host offline" });
  assert.deepEqual(extractApiErrorPayload(""), null);
  assert.deepEqual(extractApiErrorPayload(null), null);

  assert.deepEqual(
    extractApiErrorPayload({ error: "host_offline", message: "Host is offline" }),
    { error: "host_offline", message: "Host is offline" },
  );

  assert.deepEqual(
    extractApiErrorPayload({ data: { error: "game_not_found", detail: "missing" } }),
    { error: "game_not_found", detail: "missing" },
  );

  assert.deepEqual(extractApiErrorPayload({ message: "HTTP 404 Not Found" }), {
    message: "HTTP 404 Not Found",
  });
});

test("formatApiError maps error codes to Russian", () => {
  assert.equal(
    formatApiError({ error: "host_offline", message: "Host is offline" }),
    "Хост сейчас офлайн. Выбери другого или попробуй позже.",
  );
  assert.equal(
    formatApiError({ error: "insufficient_balance" }),
    "Недостаточно средств на кошельке. Пополни баланс и попробуй снова.",
  );
  assert.equal(
    formatApiError({ message: "session not found" }),
    "Сессия не найдена или уже завершена.",
  );
});

test("formatApiError preserves Russian messages and uses patterns for English", () => {
  assert.equal(formatApiError({ message: "Уже занят другим игроком" }), "Уже занят другим игроком");
  assert.equal(
    formatApiError({ message: "Too many requests, slow down" }),
    "Слишком много попыток. Подожди немного и попробуй снова.",
  );
  assert.equal(
    formatApiError({ message: "fetch failed: network error" }),
    "Ошибка сети. Проверь подключение и попробуй снова.",
  );
});

test("formatApiError returns fallback for unknown errors", () => {
  const fallback = "Своя ошибка";
  assert.equal(formatApiError(null, fallback), fallback);
  assert.equal(formatApiError({ message: "Unknown diagnostic xyz" }), "Unknown diagnostic xyz");
});

test("formatApiErrorPanel maps title by code and detail via formatApiError", () => {
  const panel = formatApiErrorPanel(
    { error: "key_balance_exhausted", message: "Balance exhausted" },
    { title: "Ошибка", detail: "Детали" },
  );
  assert.equal(panel.title, "Баланс API-ключа исчерпан");
  assert.equal(
    panel.detail,
    "Баланс API-ключа исчерпан. Пополните кошелёк ключа.",
  );

  const defaults = { title: "Ошибка", detail: "Детали" };
  assert.deepEqual(formatApiErrorPanel(null, defaults), defaults);
});

test("formatApiErrorPanel uses default title when code has no panel title", () => {
  const panel = formatApiErrorPanel(
    { error: "host_busy", message: "Host busy" },
    { title: "Не удалось подключиться", detail: "Попробуй позже" },
  );
  assert.equal(panel.title, "Не удалось подключиться");
  assert.equal(
    panel.detail,
    "У хоста уже идёт сессия — выбери другого или подожди.",
  );
});
