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
  assert.deepEqual(extractApiErrorPayload("  host offline  "), { message: "host offline" });
  assert.deepEqual(extractApiErrorPayload({ error: "host_busy", message: "Host is busy" }), {
    error: "host_busy",
    message: "Host is busy",
  });
  assert.deepEqual(
    extractApiErrorPayload({ data: { error: "game_not_found", detail: "missing" } }),
    { error: "game_not_found", detail: "missing" },
  );
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
  assert.equal(
    formatApiError({ error: "HOST_BUSY", message: "Busy" }),
    "У хоста уже идёт сессия — выбери другого или подожди.",
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

test("formatApiError matches English patterns and keeps Russian text", () => {
  assert.equal(
    formatApiError({ message: "Insufficient funds for this purchase" }),
    "Недостаточно средств на кошельке. Пополни баланс и попробуй снова.",
  );
  assert.equal(
    formatApiError({ message: "fetch failed: network timeout" }),
    "Ошибка сети. Проверь подключение и попробуй снова.",
  );
  assert.equal(
    formatApiError({ message: "Сессия уже завершена администратором" }),
    "Сессия уже завершена администратором",
  );
});

test("formatApiError uses fallback for unknown payloads", () => {
  const fallback = "Кастомная ошибка";
  assert.equal(formatApiError(null, fallback), fallback);
  assert.equal(formatApiError({ title: "Only title" }, fallback), fallback);
  assert.equal(
    formatApiError({ message: "Some unknown English diagnostic" }),
    "Some unknown English diagnostic",
  );
});

test("formatApiErrorPanel maps title by code and detail via formatApiError", () => {
  assert.deepEqual(
    formatApiErrorPanel(
      { error: "key_balance_exhausted", message: "Balance exhausted" },
      { title: "Ошибка", detail: "Подробности" },
    ),
    {
      title: "Баланс API-ключа исчерпан",
      detail: "Баланс API-ключа исчерпан. Пополните кошелёк ключа.",
    },
  );
  assert.deepEqual(
    formatApiErrorPanel(null, { title: "Заголовок", detail: "Детали" }),
    { title: "Заголовок", detail: "Детали" },
  );
  assert.deepEqual(
    formatApiErrorPanel(
      { error: "invite_expired", message: "Invite expired" },
      { title: "Ошибка", detail: "Подробности" },
    ),
    {
      title: "Приглашение истекло",
      detail: "Ссылка-приглашение истекла.",
    },
  );
});
