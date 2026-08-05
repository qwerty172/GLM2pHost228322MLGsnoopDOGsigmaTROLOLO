import { test } from "node:test";
import assert from "node:assert/strict";

const { extractApiErrorPayload, formatApiError, formatApiErrorPanel } = await import(
  "../src/lib/api-errors.ts"
);

test("extractApiErrorPayload parses string, nested data and rejects empty", () => {
  assert.deepEqual(extractApiErrorPayload("host_offline"), { message: "host_offline" });
  assert.deepEqual(extractApiErrorPayload({ data: { error: "host_busy", message: "Host busy" } }), {
    error: "host_busy",
    message: "Host busy",
  });
  assert.equal(extractApiErrorPayload(null), null);
  assert.equal(extractApiErrorPayload("   "), null);
});

test("formatApiError translates error codes and exact English messages", () => {
  assert.equal(
    formatApiError({ error: "host_offline", message: "Host is offline" }),
    "Хост сейчас офлайн. Выбери другого или попробуй позже.",
  );
  assert.equal(
    formatApiError({ message: "User not found" }),
    "Пользователь не найден.",
  );
  assert.equal(
    formatApiError({ error: "insufficient_balance" }),
    "Недостаточно средств на кошельке. Пополни баланс и попробуй снова.",
  );
});

test("formatApiError keeps Russian text and uses fallback for unknown errors", () => {
  const ru = "Сервер временно недоступен";
  assert.equal(formatApiError({ message: ru }), ru);
  assert.equal(formatApiError(null), "Произошла ошибка. Попробуй ещё раз.");
  assert.equal(formatApiError({}, "Запасной текст"), "Запасной текст");
});

test("formatApiErrorPanel maps known codes to Russian title and detail", () => {
  const panel = formatApiErrorPanel(
    { error: "key_balance_exhausted", message: "Balance exhausted" },
    { title: "Ошибка", detail: "Попробуйте позже" },
  );
  assert.equal(panel.title, "Баланс API-ключа исчерпан");
  assert.equal(panel.detail, "Баланс API-ключа исчерпан. Пополните кошелёк ключа.");
});
