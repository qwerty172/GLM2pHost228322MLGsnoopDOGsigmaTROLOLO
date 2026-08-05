import { test } from "node:test";
import assert from "node:assert/strict";

const { extractApiErrorPayload, formatApiError, formatApiErrorPanel } = await import(
  "../src/lib/api-errors.ts"
);

test("extractApiErrorPayload parses string and nested data", () => {
  assert.deepEqual(extractApiErrorPayload("  host offline  "), { message: "host offline" });
  assert.equal(extractApiErrorPayload(""), null);
  assert.equal(extractApiErrorPayload(null), null);

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

test("formatApiError translates known error codes to Russian", () => {
  assert.equal(
    formatApiError({ error: "host_offline", message: "Host is offline" }),
    "Хост сейчас офлайн. Выбери другого или попробуй позже.",
  );
  assert.equal(
    formatApiError({ error: "insufficient_balance" }),
    "Недостаточно средств на кошельке. Пополни баланс и попробуй снова.",
  );
  assert.equal(formatApiError({ error: "session_not_found" }), "Сессия не найдена или уже завершена.");
});

test("formatApiError maps exact English API messages", () => {
  assert.equal(
    formatApiError({ message: "Session already claimed by another player" }),
    "Сессия уже занята другим игроком.",
  );
  assert.equal(formatApiError({ message: "User not found" }), "Пользователь не найден.");
  assert.equal(
    formatApiError({ message: "Insufficient balance to reserve the block" }),
    "Недостаточно средств для резервирования блока.",
  );
});

test("formatApiError applies pattern fallback for English text", () => {
  assert.equal(
    formatApiError({ message: "fetch failed: network timeout" }),
    "Ошибка сети. Проверь подключение и попробуй снова.",
  );
  assert.equal(
    formatApiError({ message: "Too many requests from this IP" }),
    "Слишком много попыток. Подожди немного и попробуй снова.",
  );
});

test("formatApiError keeps Russian messages and uses custom fallback", () => {
  assert.equal(formatApiError({ message: "Сессия уже завершена" }), "Сессия уже завершена");
  assert.equal(formatApiError(null, "Своя ошибка"), "Своя ошибка");
  assert.equal(formatApiError({ message: "Unknown English diagnostic" }), "Unknown English diagnostic");
});

test("formatApiErrorPanel picks title by code and detail via formatApiError", () => {
  const panel = formatApiErrorPanel(
    { error: "key_balance_exhausted", message: "Balance exhausted" },
    { title: "Ошибка", detail: "Попробуйте позже." },
  );
  assert.equal(panel.title, "Баланс API-ключа исчерпан");
  assert.equal(panel.detail, "Баланс API-ключа исчерпан. Пополните кошелёк ключа.");

  const defaults = formatApiErrorPanel(null, { title: "Заголовок", detail: "Детали" });
  assert.deepEqual(defaults, { title: "Заголовок", detail: "Детали" });
});
