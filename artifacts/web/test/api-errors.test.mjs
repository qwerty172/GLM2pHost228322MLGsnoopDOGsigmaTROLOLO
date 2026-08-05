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

  assert.deepEqual(extractApiErrorPayload({ error: "host_busy", message: "Host is busy" }), {
    error: "host_busy",
    message: "Host is busy",
  });

  assert.deepEqual(
    extractApiErrorPayload({ data: { error: "game_not_found", detail: "No such game" } }),
    { error: "game_not_found", detail: "No such game" },
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

test("formatApiError keeps Russian text and uses pattern fallback for English", () => {
  assert.equal(
    formatApiError({ message: "Сервер временно недоступен" }),
    "Сервер временно недоступен",
  );
  assert.equal(
    formatApiError({ message: "Too many requests from this IP" }),
    "Слишком много попыток. Подожди немного и попробуй снова.",
  );
  assert.equal(
    formatApiError({ message: "fetch failed: network timeout" }),
    "Ошибка сети. Проверь подключение и попробуй снова.",
  );
});

test("formatApiError returns custom fallback for unknown errors", () => {
  const fallback = "Что-то пошло не так";
  assert.equal(formatApiError(null, fallback), fallback);
  assert.equal(formatApiError({}, fallback), fallback);
  assert.equal(formatApiError({ message: "Totally unknown xyz" }, fallback), "Totally unknown xyz");
});

test("formatApiErrorPanel uses code-specific title and translated detail", () => {
  const defaults = { title: "Ошибка", detail: "Попробуйте позже." };
  const panel = formatApiErrorPanel(
    { error: "key_balance_exhausted", message: "Balance exhausted" },
    defaults,
  );
  assert.equal(panel.title, "Баланс API-ключа исчерпан");
  assert.equal(
    panel.detail,
    "Баланс API-ключа исчерпан. Пополните кошелёк ключа.",
  );

  const fallback = formatApiErrorPanel(null, defaults);
  assert.deepEqual(fallback, defaults);
});
