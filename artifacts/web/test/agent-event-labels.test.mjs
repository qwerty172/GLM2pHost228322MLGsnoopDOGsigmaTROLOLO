import { test } from "node:test";
import assert from "node:assert/strict";

const { localizeAgentEventMessage } = await import("../src/lib/agent-event-labels.ts");

test("localizeAgentEventMessage maps known agent telemetry strings", () => {
  assert.equal(localizeAgentEventMessage("input injector ready"), "Инжектор ввода готов");
  assert.equal(
    localizeAgentEventMessage("SendInput failed with error 5"),
    "Ошибка SendInput — запусти агент от имени администратора",
  );
  assert.equal(
    localizeAgentEventMessage("ECONNREFUSED to api.example.com"),
    "Нет связи с сервером — проверь интернет",
  );
  assert.equal(localizeAgentEventMessage("Agent startup complete"), "Агент успешно запущен");
  assert.equal(localizeAgentEventMessage("graceful shutdown"), "Агент завершил работу");
});

test("localizeAgentEventMessage returns original text when no pattern matches", () => {
  const raw = "Custom diagnostic line 42";
  assert.equal(localizeAgentEventMessage(raw), raw);
});
