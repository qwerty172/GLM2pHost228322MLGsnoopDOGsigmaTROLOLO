import { test } from "node:test";
import assert from "node:assert/strict";
import { localizeAgentEventMessage } from "../src/lib/agent-event-labels.ts";

test("localizeAgentEventMessage maps known telemetry patterns", () => {
  assert.equal(localizeAgentEventMessage("input injector ready"), "Инжектор ввода готов");
  assert.equal(localizeAgentEventMessage("Failed to init input module"), "Не удалось инициализировать ввод");
  assert.equal(localizeAgentEventMessage("SendInput error code 5"), "Ошибка SendInput — запусти агент от имени администратора");
  assert.equal(localizeAgentEventMessage("host token invalid"), "Неверный или просроченный токен хоста");
  assert.equal(localizeAgentEventMessage("EADDRINUSE on port 18080"), "Порт занят — закрой другой экземпляр агента");
  assert.equal(localizeAgentEventMessage("fetch failed: ECONNREFUSED"), "Нет связи с сервером — проверь интернет");
  assert.equal(localizeAgentEventMessage("node.exe not found ENOENT"), "Node.js не найден — установи Node.js 20+");
  assert.equal(localizeAgentEventMessage("npm install failed"), "Ошибка установки зависимостей — перезапусти start.bat");
  assert.equal(localizeAgentEventMessage("desktopCapturer failed"), "Не удалось захватить экран — проверь разрешения Windows");
  assert.equal(localizeAgentEventMessage("agent startup complete"), "Агент успешно запущен");
  assert.equal(localizeAgentEventMessage("shutdown requested"), "Агент завершил работу");
});

test("localizeAgentEventMessage is case-insensitive for patterns", () => {
  assert.equal(localizeAgentEventMessage("INPUT INJECTOR READY"), "Инжектор ввода готов");
  assert.equal(localizeAgentEventMessage("FETCH FAILED"), "Нет связи с сервером — проверь интернет");
});

test("localizeAgentEventMessage returns original text when no pattern matches", () => {
  const custom = "Пользовательская диагностика: код 42";
  assert.equal(localizeAgentEventMessage(custom), custom);
  assert.equal(localizeAgentEventMessage("unknown diagnostic"), "unknown diagnostic");
});

test("localizeAgentEventMessage prefers first matching pattern", () => {
  assert.equal(localizeAgentEventMessage("startup failed to init input"), "Не удалось инициализировать ввод");
});
