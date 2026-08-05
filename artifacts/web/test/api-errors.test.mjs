import { test } from "node:test";
import assert from "node:assert/strict";

const {
  extractApiErrorPayload,
  formatApiError,
  formatApiErrorPanel,
} = await import("../src/lib/api-errors.ts");

test("extractApiErrorPayload parses string and nested data", () => {
  assert.equal(extractApiErrorPayload(null), null);
  assert.equal(extractApiErrorPayload(""), null);
  assert.equal(extractApiErrorPayload("  "), null);
  assert.deepEqual(extractApiErrorPayload("host offline"), { message: "host offline" });

  assert.deepEqual(extractApiErrorPayload({ error: "host_busy", message: "Host is busy" }), {
    error: "host_busy",
    message: "Host is busy",
  });

  assert.deepEqual(
    extractApiErrorPayload({
      data: { error: "game_not_found", detail: "Game missing" },
    }),
    { error: "game_not_found", detail: "Game missing" },
  );

  assert.deepEqual(extractApiErrorPayload({ message: "HTTP 404 Not Found" }), {
    message: "HTTP 404 Not Found",
  });
  assert.deepEqual(extractApiErrorPayload({ message: "plain error" }), { message: "plain error" });
});

test("formatApiError maps error codes and exact English messages to Russian", () => {
  assert.equal(
    formatApiError({ error: "host_offline", message: "Host is offline" }),
    "Хост сейчас офлайн. Выбери другого или попробуй позже.",
  );
  assert.equal(formatApiError({ message: "user not found" }), "Пользователь не найден.");
  assert.equal(formatApiError({ error: "invalid_api_key" }), "Неверный API-ключ.");
  assert.equal(
    formatApiError({ error: "HOST_BUSY", message: "Session in progress" }),
    "У хоста уже идёт сессия — выбери другого или подожди.",
  );
});

test("formatApiError uses pattern matching and preserves Cyrillic messages", () => {
  assert.equal(
    formatApiError({ message: "Insufficient balance for this action" }),
    "Недостаточно средств на кошельке. Пополни баланс и попробуй снова.",
  );
  assert.equal(
    formatApiError({ message: "fetch failed: network unreachable" }),
    "Ошибка сети. Проверь подключение и попробуй снова.",
  );
  assert.equal(
    formatApiError({ message: "Сервер временно недоступен" }),
    "Сервер временно недоступен",
  );
  assert.equal(formatApiError(null, "Запасной текст"), "Запасной текст");
  assert.equal(formatApiError({ message: "Unknown English diagnostic" }), "Unknown English diagnostic");
});

test("formatApiErrorPanel maps title by code and detail via formatApiError", () => {
  const defaults = { title: "Ошибка", detail: "Попробуйте позже." };
  assert.deepEqual(formatApiErrorPanel({ error: "key_balance_exhausted" }, defaults), {
    title: "Баланс API-ключа исчерпан",
    detail: "Баланс API-ключа исчерпан. Пополните кошелёк ключа.",
  });
  assert.deepEqual(formatApiErrorPanel({ error: "hosts_busy" }, defaults), {
    title: "Все хосты заняты",
    detail: "Все хосты заняты — попробуйте позже.",
  });
  assert.deepEqual(formatApiErrorPanel(null, defaults), defaults);
});
