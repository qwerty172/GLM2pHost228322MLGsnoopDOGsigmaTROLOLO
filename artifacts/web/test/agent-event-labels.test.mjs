import { test } from "node:test";
import assert from "node:assert/strict";
import { localizeAgentEventMessage } from "../src/lib/agent-event-labels.ts";

test("localizeAgentEventMessage maps input injector ready", () => {
  assert.equal(localizeAgentEventMessage("Input injector ready"), "Инжектор ввода готов");
});

test("localizeAgentEventMessage maps SendInput errors", () => {
  assert.equal(
    localizeAgentEventMessage("SendInput failed with code 5"),
    "Ошибка SendInput — запусти агент от имени администратора",
  );
});

test("localizeAgentEventMessage maps host token issues", () => {
  assert.equal(
    localizeAgentEventMessage("Host token is invalid"),
    "Неверный или просроченный токен хоста",
  );
});

test("localizeAgentEventMessage maps network failures", () => {
  assert.equal(
    localizeAgentEventMessage("fetch failed: ECONNREFUSED"),
    "Нет связи с сервером — проверь интернет",
  );
});

test("localizeAgentEventMessage maps capture errors", () => {
  assert.equal(
    localizeAgentEventMessage("desktopCapturer returned no sources"),
    "Не удалось захватить экран — проверь разрешения Windows",
  );
});

test("localizeAgentEventMessage returns original for unknown messages", () => {
  const raw = "Custom telemetry line 42";
  assert.equal(localizeAgentEventMessage(raw), raw);
});
