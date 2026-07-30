/** Map raw agent telemetry strings to Russian dashboard copy. */

const AGENT_EVENT_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /input injector ready/i, label: "Инжектор ввода готов" },
  { pattern: /failed to (init|initialize) input/i, label: "Не удалось инициализировать ввод" },
  { pattern: /sendinput/i, label: "Ошибка SendInput — запусти агент от имени администратора" },
  { pattern: /token.*(invalid|expired|missing)/i, label: "Неверный или просроченный токен хоста" },
  { pattern: /host token/i, label: "Проверь токен хоста в окне агента" },
  { pattern: /eaddrinuse|port.*in use/i, label: "Порт занят — закрой другой экземпляр агента" },
  { pattern: /econnrefused|network|fetch failed/i, label: "Нет связи с сервером — проверь интернет" },
  { pattern: /node.*not found|enoent/i, label: "Node.js не найден — установи Node.js 20+" },
  { pattern: /npm install|dependencies/i, label: "Ошибка установки зависимостей — перезапусти start.bat" },
  { pattern: /capture|desktopcapturer/i, label: "Не удалось захватить экран — проверь разрешения Windows" },
  { pattern: /started|startup|ready/i, label: "Агент успешно запущен" },
  { pattern: /shutdown|exit/i, label: "Агент завершил работу" },
];

export function localizeAgentEventMessage(message: string): string {
  for (const { pattern, label } of AGENT_EVENT_PATTERNS) {
    if (pattern.test(message)) return label;
  }
  return message;
}
