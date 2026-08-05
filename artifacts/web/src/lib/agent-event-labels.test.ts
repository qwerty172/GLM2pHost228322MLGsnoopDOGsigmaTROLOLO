import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { localizeAgentEventMessage } from "./agent-event-labels.ts";

describe("localizeAgentEventMessage", () => {
  it("maps input injector ready", () => {
    assert.equal(localizeAgentEventMessage("Input injector ready"), "Инжектор ввода готов");
  });

  it("maps SendInput errors", () => {
    assert.equal(
      localizeAgentEventMessage("SendInput failed with code 5"),
      "Ошибка SendInput — запусти агент от имени администратора",
    );
  });

  it("maps invalid host token", () => {
    assert.equal(
      localizeAgentEventMessage("Host token is invalid"),
      "Неверный или просроченный токен хоста",
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

  it("maps capture failures", () => {
    assert.equal(
      localizeAgentEventMessage("desktopCapturer: no sources"),
      "Не удалось захватить экран — проверь разрешения Windows",
    );
  });

  it("maps startup success", () => {
    assert.equal(localizeAgentEventMessage("Agent started successfully"), "Агент успешно запущен");
  });

  it("maps shutdown", () => {
    assert.equal(localizeAgentEventMessage("Agent shutdown complete"), "Агент завершил работу");
  });

  it("returns original message when no pattern matches", () => {
    const raw = "Custom diagnostic line 42";
    assert.equal(localizeAgentEventMessage(raw), raw);
  });
});
