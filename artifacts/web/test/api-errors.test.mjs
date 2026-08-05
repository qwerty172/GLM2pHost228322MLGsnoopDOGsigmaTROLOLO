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

test("extractApiErrorPayload parses string and object shapes", () => {
  assert.deepEqual(extractApiErrorPayload("host offline"), { message: "host offline" });
  assert.deepEqual(extractApiErrorPayload({ error: "host_busy", message: "Host is busy" }), {
    error: "host_busy",
    message: "Host is busy",
  });
  assert.deepEqual(
    extractApiErrorPayload({ data: { error: "game_not_found", detail: "No such game" } }),
    { error: "game_not_found", detail: "No such game" },
  );
});

test("extractApiErrorPayload reads message field including HTTP wrappers", () => {
  assert.deepEqual(extractApiErrorPayload({ message: "HTTP 404 Not Found" }), {
    message: "HTTP 404 Not Found",
  });
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
    formatApiError({ message: "Session not found" }),
    "Сессия не найдена или уже завершена.",
  );
  assert.equal(
    formatApiError({ message: "Not authenticated" }),
    "Требуется авторизация.",
  );
});

test("formatApiError keeps Russian text and matches common patterns", () => {
  const ru = "Сервер временно недоступен";
  assert.equal(formatApiError({ message: ru }), ru);
  assert.equal(
    formatApiError({ message: "Too many requests, slow down" }),
    "Слишком много попыток. Подожди немного и попробуй снова.",
  );
  assert.equal(
    formatApiError({ message: "fetch failed: network timeout" }),
    "Ошибка сети. Проверь подключение и попробуй снова.",
  );
});

test("formatApiError uses custom fallback when payload is missing", () => {
  assert.equal(formatApiError(null), "Произошла ошибка. Попробуй ещё раз.");
  assert.equal(formatApiError(null, "Своя ошибка"), "Своя ошибка");
});

test("formatApiErrorPanel maps title by code and detail via formatApiError", () => {
  assert.deepEqual(
    formatApiErrorPanel(null, { title: "Ошибка", detail: "Подробности" }),
    { title: "Ошибка", detail: "Подробности" },
  );
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
    formatApiErrorPanel(
      { error: "invite_expired", message: "Invite expired" },
      { title: "Ошибка", detail: "Подробности" },
    ),
    { title: "Приглашение истекло", detail: "Ссылка-приглашение истекла." },
  );
});
