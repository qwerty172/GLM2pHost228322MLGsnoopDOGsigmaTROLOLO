import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { localizeAgentEventMessage } from "../src/lib/agent-event-labels.ts";

describe("localizeAgentEventMessage", () => {
  it("maps known agent telemetry to Russian labels", () => {
    assert.equal(localizeAgentEventMessage("input injector ready"), "Инжектор ввода готов");
    assert.equal(
      localizeAgentEventMessage("failed to init input module"),
      "Не удалось инициализировать ввод",
    );
    assert.equal(
      localizeAgentEventMessage("SendInput returned 0"),
      "Ошибка SendInput — запусти агент от имени администратора",
    );
    assert.equal(
      localizeAgentEventMessage("host token is invalid"),
      "Неверный или просроченный токен хоста",
    );
    assert.equal(
      localizeAgentEventMessage("EADDRINUSE on port 18080"),
      "Порт занят — закрой другой экземпляр агента",
    );
    assert.equal(
      localizeAgentEventMessage("fetch failed to api"),
      "Нет связи с сервером — проверь интернет",
    );
    assert.equal(
      localizeAgentEventMessage("Agent startup complete"),
      "Агент успешно запущен",
    );
    assert.equal(localizeAgentEventMessage("shutdown requested"), "Агент завершил работу");
  });

  it("returns original message when no pattern matches", () => {
    const raw = "custom diagnostic xyz";
    assert.equal(localizeAgentEventMessage(raw), raw);
  });

  it("is case-insensitive for English patterns", () => {
    assert.equal(localizeAgentEventMessage("INPUT INJECTOR READY"), "Инжектор ввода готов");
    assert.equal(localizeAgentEventMessage("desktopCapturer error"), "Не удалось захватить экран — проверь разрешения Windows");
  });
});
