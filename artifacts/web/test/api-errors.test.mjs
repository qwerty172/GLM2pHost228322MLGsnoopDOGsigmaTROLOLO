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

  assert.deepEqual(extractApiErrorPayload({ error: "host_offline", message: "Host is offline" }), {
    error: "host_offline",
    message: "Host is offline",
  });

  assert.deepEqual(extractApiErrorPayload({ data: { error: "game_not_found", detail: "missing" } }), {
    error: "game_not_found",
    detail: "missing",
  });

  assert.deepEqual(extractApiErrorPayload({ message: "HTTP 404 Not Found" }), {
    message: "HTTP 404 Not Found",
  });
});

test("formatApiError translates known error codes and English messages", () => {
  assert.equal(
    formatApiError({ error: "host_offline", message: "Host is offline" }),
    "Хост сейчас офлайн. Выбери другого или попробуй позже.",
  );

  assert.equal(
    formatApiError({ message: "session already claimed by another player" }),
    "Сессия уже занята другим игроком.",
  );

  assert.equal(
    formatApiError({ error: "insufficient_balance" }),
    "Недостаточно средств на кошельке. Пополни баланс и попробуй снова.",
  );

  assert.equal(
    formatApiError({ message: "fetch failed: network" }),
    "Ошибка сети. Проверь подключение и попробуй снова.",
  );
});

test("formatApiError keeps Russian text and uses fallback", () => {
  const ru = "Сервер временно недоступен";
  assert.equal(formatApiError({ message: ru }), ru);
  assert.equal(formatApiError(null, "Запасной текст"), "Запасной текст");
  assert.equal(formatApiError({ message: "Unknown English glitch" }), "Unknown English glitch");
});

test("formatApiErrorPanel maps API key errors to panel title and detail", () => {
  const defaults = { title: "Ошибка", detail: "Что-то пошло не так" };

  assert.deepEqual(formatApiErrorPanel({ error: "invalid_api_key" }, defaults), {
    title: "Неверный API-ключ",
    detail: "Неверный API-ключ.",
  });

  assert.deepEqual(formatApiErrorPanel({ error: "key_balance_exhausted" }, defaults), {
    title: "Баланс API-ключа исчерпан",
    detail: "Баланс API-ключа исчерпан. Пополните кошелёк ключа.",
  });

  assert.deepEqual(formatApiErrorPanel(null, defaults), defaults);
});
