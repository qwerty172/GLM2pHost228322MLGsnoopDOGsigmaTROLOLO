import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { localizeAgentEventMessage } from "../src/lib/agent-event-labels.ts";

describe("localizeAgentEventMessage", () => {
  it("maps input injector ready", () => {
    assert.equal(localizeAgentEventMessage("Input injector ready"), "Инжектор ввода готов");
  });

  it("maps failed to init input", () => {
    assert.equal(
      localizeAgentEventMessage("Failed to initialize input module"),
      "Не удалось инициализировать ввод",
    );
  });

  it("maps SendInput errors", () => {
    assert.equal(
      localizeAgentEventMessage("SendInput returned 0"),
      "Ошибка SendInput — запусти агент от имени администратора",
    );
  });

  it("maps host token issues", () => {
    assert.equal(
      localizeAgentEventMessage("Host token expired"),
      "Неверный или просроченный токен хоста",
    );
    assert.equal(
      localizeAgentEventMessage("Check host token in settings"),
      "Проверь токен хоста в окне агента",
    );
  });

  it("maps port in use", () => {
    assert.equal(
      localizeAgentEventMessage("EADDRINUSE: port 18080 in use"),
      "Порт занят — закрой другой экземпляр агента",
    );
  });

  it("maps network errors", () => {
    assert.equal(
      localizeAgentEventMessage("fetch failed: ECONNREFUSED"),
      "Нет связи с сервером — проверь интернет",
    );
  });

  it("maps missing Node.js", () => {
    assert.equal(
      localizeAgentEventMessage("node not found ENOENT"),
      "Node.js не найден — установи Node.js 20+",
    );
  });

  it("maps dependency install errors", () => {
    assert.equal(
      localizeAgentEventMessage("npm install failed"),
      "Ошибка установки зависимостей — перезапусти start.bat",
    );
  });

  it("maps capture failures", () => {
    assert.equal(
      localizeAgentEventMessage("desktopCapturer failed"),
      "Не удалось захватить экран — проверь разрешения Windows",
    );
  });

  it("maps startup and shutdown", () => {
    assert.equal(localizeAgentEventMessage("Agent startup complete"), "Агент успешно запущен");
    assert.equal(localizeAgentEventMessage("Shutdown requested"), "Агент завершил работу");
  });

  it("returns original message when no pattern matches", () => {
    const raw = "Custom telemetry line 42";
    assert.equal(localizeAgentEventMessage(raw), raw);
  });
});
