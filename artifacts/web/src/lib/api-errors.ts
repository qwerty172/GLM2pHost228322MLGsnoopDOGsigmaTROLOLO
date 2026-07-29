/**
 * UX-06: централизованный перевод ошибок API в русские сообщения для UI.
 */

type ApiErrorBody = {
  error?: string;
  message?: string;
};

const CYRILLIC = /[а-яА-ЯёЁ]/;

/** Машинные коды API → русский текст. */
const ERROR_CODE_RU: Record<string, string> = {
  host_not_found: "Хост не найден",
  host_busy: "Хост занят — попробуй позже",
  host_offline: "Хост сейчас офлайн",
  host_unavailable: "Хост сейчас недоступен",
  session_not_found: "Сессия не найдена",
  session_ended: "Сессия уже завершена",
  session_not_active: "Сессия не активна",
  session_already_claimed: "Сессия уже занята другим игроком",
  not_your_session: "Это не ваша сессия",
  invalid_host_token: "Неверный токен хоста",
  unknown_host_token: "Неизвестный токен хоста",
  unknown_hosttoken: "Неизвестный токен хоста",
  not_authenticated: "Требуется авторизация",
  user_not_found: "Пользователь не найден",
  player_wallet_not_found: "Кошелёк игрока не найден",
  game_not_found: "Игра не найдена",
  quota_not_found: "Квота не найдена",
  not_your_quota: "Это не ваша квота",
  quota_not_active: "Квота не активна",
  invite_not_found: "Приглашение не найдено",
  invite_expired: "Ссылка-приглашение истекла",
  too_many_requests: "Слишком много запросов, попробуйте позже",
  storage_unavailable: "Хранилище объектов не настроено",
  encryption_unavailable: "Шифрование недоступно — проверьте настройки сервера",
  insufficient_balance: "Недостаточно средств на кошельке",
  embed_session_not_claimable: "Сессию embed нельзя занять напрямую",
  key_balance_exhausted: "Баланс API-ключа исчерпан",
  invalid_api_key: "Неверный API-ключ",
  key_disabled: "API-ключ отключён",
  missing_params: "Не хватает параметров запроса",
  network_error: "Ошибка сети",
  no_game: "У хоста нет игры для тест-сессии",
  no_vds_configured: "VDS не настроен",
  file_not_found: "Файл не найден",
  object_not_found: "Объект не найден",
  submission_not_found: "Заявка не найдена",
  not_your_submission: "Это не ваша заявка",
  internal_server_error: "Внутренняя ошибка сервера",
  internal_error: "Внутренняя ошибка сервера",
  dev_key_no_withdrawal: "API-ключи не могут выводить средства",
};

/** Английские фразы API → русский (regex). */
const ENGLISH_PATTERNS: Array<[RegExp, string]> = [
  [/host not found/i, "Хост не найден"],
  [/host is not currently available/i, "Хост сейчас недоступен"],
  [/host is not reachable/i, "Хост недоступен с платформы"],
  [/host.?offline/i, "Хост сейчас офлайн"],
  [/host_busy/i, "Хост занят — попробуй позже"],
  [/session not found/i, "Сессия не найдена"],
  [/session has ended/i, "Сессия уже завершена"],
  [/session not active/i, "Сессия не активна"],
  [/session already claimed/i, "Сессия уже занята другим игроком"],
  [/not your session/i, "Это не ваша сессия"],
  [/invalid host token/i, "Неверный токен хоста"],
  [/unknown host token/i, "Неизвестный токен хоста"],
  [/unknown hosttoken/i, "Неизвестный токен хоста"],
  [/not authenticated/i, "Требуется авторизация"],
  [/user not found/i, "Пользователь не найден"],
  [/player wallet not found/i, "Кошелёк игрока не найден"],
  [/game not found/i, "Игра не найдена"],
  [/quota not found/i, "Квота не найдена"],
  [/not your quota/i, "Это не ваша квота"],
  [/quota is not active/i, "Квота не активна"],
  [/invite not found/i, "Приглашение не найдено"],
  [/too many/i, "Слишком много попыток, подождите"],
  [/insufficient balance/i, "Недостаточно средств на кошельке"],
  [/failed to create session/i, "Не удалось создать сессию"],
  [/failed to create test session/i, "Не удалось создать тест-сессию"],
  [/failed to update host/i, "Не удалось обновить хост"],
  [/failed to store clip/i, "Не удалось сохранить клип"],
  [/missing x-host-token/i, "Требуется токен хоста"],
  [/x-host-token required/i, "Требуется токен хоста"],
  [/missing x-player/i, "Требуется токен кошелька игрока"],
  [/no file uploaded/i, "Файл не загружен"],
  [/file not found/i, "Файл не найден"],
  [/object not found/i, "Объект не найден"],
  [/internal (server )?error/i, "Внутренняя ошибка сервера"],
  [/timed out/i, "Превышено время ожидания"],
  [/pledger limit/i, "Pledger-лимит равен нулю — сначала сделай депозит или вывод"],
  [/amountlzt exceeds/i, "Сумма превышает Pledger-лимит"],
  [/termDays must be/i, "Срок займа слишком короткий"],
  [/not open/i, "Заявка уже не в открытом статусе"],
  [/own request/i, "Нельзя финансировать собственную заявку"],
  [/insufficient lender/i, "Недостаточно баланса для финансирования"],
  [/not your loan/i, "Это не твой займ"],
  [/not repayable/i, "Займ нельзя погасить"],
  [/withdrawal failed/i, "Не удалось выполнить вывод"],
  [/no route for/i, "Запрошенный API-метод не найден"],
  [/^required$/i, "Обязательное поле"],
  [/string must contain at least/i, "Слишком короткое значение"],
  [/expected .+, received/i, "Некорректный формат данных"],
];

function normalizeCode(code: string): string {
  return code.trim().toLowerCase().replace(/\s+/g, "_");
}

function isCyrillic(text: string): boolean {
  return CYRILLIC.test(text);
}

function stripHttpPrefix(text: string): string {
  const match = text.match(/^HTTP \d+[^:]*:\s*(.+)$/s);
  return (match ? match[1] : text).trim();
}

function getErrorBody(err: unknown): ApiErrorBody | null {
  if (typeof err !== "object" || err === null) return null;

  const withData = err as { data?: unknown };
  if (withData.data && typeof withData.data === "object" && withData.data !== null) {
    const body = withData.data as ApiErrorBody;
    if (body.error || body.message) return body;
  }

  const direct = err as ApiErrorBody;
  if (direct.error || direct.message) return direct;

  return null;
}

function rawMessageFromError(err: unknown): string {
  if (typeof err === "string") return stripHttpPrefix(err);
  if (err instanceof Error) return stripHttpPrefix(err.message);
  if (typeof err === "object" && err && "message" in err) {
    return stripHttpPrefix(String((err as { message: unknown }).message));
  }
  return "";
}

/** Переводит машинный код ошибки API. */
export function formatApiErrorCode(code: string, serverMessage?: string): string {
  const normalized = normalizeCode(code);
  const mapped = ERROR_CODE_RU[normalized] ?? ERROR_CODE_RU[code];
  if (mapped) return mapped;

  if (serverMessage && isCyrillic(serverMessage)) return serverMessage;

  const fromEnglish = translateEnglishText(code);
  if (fromEnglish !== code) return fromEnglish;

  if (serverMessage) {
    const msgRu = translateEnglishText(serverMessage);
    if (msgRu !== serverMessage) return msgRu;
    if (isCyrillic(serverMessage)) return serverMessage;
  }

  return code.replace(/_/g, " ");
}

/** Переводит английский текст ошибки (в т.ч. Zod). */
export function translateEnglishText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  if (isCyrillic(trimmed)) return trimmed;

  for (const [pattern, ru] of ENGLISH_PATTERNS) {
    if (pattern.test(trimmed)) return ru;
  }
  return trimmed;
}

/**
 * Универсальный форматтер ошибок API для toast/inline UI.
 * Понимает ApiError (orval), plain fetch JSON и Error.
 */
export function formatApiError(err: unknown, fallback = "Ошибка"): string {
  const body = getErrorBody(err);

  if (body?.message && isCyrillic(body.message)) {
    return body.message;
  }

  if (body?.error) {
    return formatApiErrorCode(body.error, body.message);
  }

  const raw = rawMessageFromError(err);
  if (!raw) return fallback;

  const translated = translateEnglishText(raw);
  if (translated !== raw || isCyrillic(translated)) return translated;

  return raw || fallback;
}
