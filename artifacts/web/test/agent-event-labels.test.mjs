import { test } from "node:test";
import assert from "node:assert/strict";

const { localizeAgentEventMessage } = await import("../src/lib/agent-event-labels.ts");

test("localizeAgentEventMessage maps known telemetry to Russian", () => {
  assert.equal(localizeAgentEventMessage("Input injector ready"), "Инжектор ввода готов");
  assert.equal(
    localizeAgentEventMessage("Failed to init input module"),
    "Не удалось инициализировать ввод",
  );
  assert.equal(
    localizeAgentEventMessage("SendInput error code 5"),
    "Ошибка SendInput — запусти агент от имени администратора",
  );
  assert.equal(
    localizeAgentEventMessage("Host token expired"),
    "Неверный или просроченный токен хоста",
  );
  assert.equal(
    localizeAgentEventMessage("EADDRINUSE on port 18080"),
    "Порт занят — закрой другой экземпляр агента",
  );
  assert.equal(
    localizeAgentEventMessage("fetch failed: network"),
    "Нет связи с сервером — проверь интернет",
  );
  assert.equal(
    localizeAgentEventMessage("Agent started successfully"),
    "Агент успешно запущен",
  );
});

test("localizeAgentEventMessage returns original text when no pattern matches", () => {
  const raw = "Custom diagnostic line 42";
  assert.equal(localizeAgentEventMessage(raw), raw);
});
