/**
 * Централизованный перевод кодов и сообщений API на русский (UX-06).
 * Если сервер уже вернул кириллицу — показываем как есть.
 */

const CYRILLIC = /[а-яА-ЯёЁ]/;

/** Коды ошибок API → пользовательский текст */
export const API_ERROR_CODES_RU: Record<string, string> = {
  host_busy: "Хост занят — дождись окончания текущей сессии",
  host_offline: "Хост сейчас не в сети",
  no_game: "У хоста нет выбранной игры — выбери игру в агенте",
  invite_expired: "Ссылка-приглашение истекла",
  already_rated: "Вы уже оценили эту сессию",
  too_many_requests: "Слишком много запросов — подожди немного",
  rate_limited: "Слишком много запросов — подожди немного",
  not_found: "Ресурс не найден",
  cors_forbidden: "Запрос заблокирован политикой CORS",
  encryption_unavailable: "Шифрование на сервере недоступно — обратись к администратору",
  storage_unavailable: "Хранилище файлов недоступно",
  host_auth_required: "Нужна авторизация хоста",
  quota_key_exclusive: "Эта квота привязана к API-ключу",
  ai_unavailable: "ИИ-ассистент временно недоступен",
  save_not_found: "Облачное сохранение не найдено",
  save_upload_not_found: "Загрузка сохранения не найдена",
  embed_session_not_claimable: "Embed-сессию нельзя привязать к кошельку",
  dev_key_no_withdrawal: "API-ключи не поддерживают вывод — только пополнение",
  invalid_api_key: "Неверный API-ключ",
  key_disabled: "API-ключ отключён",
  key_balance_exhausted: "Баланс API-ключа исчерпан",
  game_not_found: "Игра не найдена",
  no_eligible_host: "Нет подходящего хоста для этой игры",
  quota_requirements_unmet: "Требования квоты не выполнены",
  hosts_busy: "Все хосты заняты — попробуй позже",
  admin_disabled: "Админ-панель отключена",
  admin_secret_required: "Нужен секрет администратора",
};

/** Английские фразы из API (полные строки или подстроки) */
const ENGLISH_MESSAGE_PATTERNS: Array<{ test: RegExp; ru: string }> = [
  { test: /user not found/i, ru: "Пользователь не найден" },
  { test: /host not found/i, ru: "Хост не найден" },
  { test: /game not found/i, ru: "Игра не найдена" },
  { test: /session not found/i, ru: "Сессия не найдена" },
  { test: /quota not found/i, ru: "Квота не найдена" },
  { test: /invite not found/i, ru: "Приглашение не найдено" },
  { test: /player wallet not found/i, ru: "Кошелёк игрока не найден" },
  { test: /player not found/i, ru: "Игрок не найден" },
  { test: /not authenticated/i, ru: "Нужна авторизация" },
  { test: /unknown host/i, ru: "Неизвестный токен хоста" },
  { test: /invalid host token/i, ru: "Неверный токен хоста" },
  { test: /hosttoken required/i, ru: "Нужен токен хоста" },
  { test: /not your (quota|session|submission)/i, ru: "Нет доступа к чужому ресурсу" },
  { test: /not owner/i, ru: "Только владелец может выполнить это действие" },
  { test: /forbidden/i, ru: "Доступ запрещён" },
  { test: /host is not currently available/i, ru: "Хост сейчас недоступен" },
  { test: /session has ended/i, ru: "Сессия уже завершена" },
  { test: /session not active/i, ru: "Сессия не активна" },
  { test: /session already claimed/i, ru: "Сессия уже занята другим игроком" },
  { test: /insufficient balance/i, ru: "Недостаточно средств на балансе" },
  { test: /quota is not active/i, ru: "Квота не активна" },
  { test: /failed to create/i, ru: "Не удалось создать — попробуй ещё раз" },
  { test: /failed to store clip/i, ru: "Не удалось сохранить клип" },
  { test: /file not found/i, ru: "Файл не найден" },
  { test: /no file uploaded/i, ru: "Файл не загружен" },
  { test: /vt lookup failed/i, ru: "Не удалось проверить файл в VirusTotal" },
  { test: /internal error/i, ru: "Внутренняя ошибка сервера" },
  { test: /timed out/i, ru: "Превышено время ожидания" },
  { test: /pledger limit/i, ru: "Pledger-лимит равен нулю — сначала сделай хотя бы один депозит или вывод" },
  { test: /amountlzt exceeds/i, ru: "Сумма превышает твой Pledger-лимит" },
  { test: /termdays must be/i, ru: "Срок займа слишком короткий" },
  { test: /not open/i, ru: "Заявка уже не в открытом статусе" },
  { test: /own request/i, ru: "Нельзя финансировать собственную заявку" },
  { test: /insufficient lender/i, ru: "Недостаточно баланса для финансирования" },
  { test: /not your loan/i, ru: "Это не твой займ" },
  { test: /not repayable/i, ru: "Займ нельзя погасить (возможно, уже закрыт)" },
  { test: /this api key already has a linked quota/i, ru: "У этого API-ключа уже есть привязанная квота" },
  { test: /api keys cannot withdraw/i, ru: "API-ключи не поддерживают вывод — только пополнение" },
];

function isRussian(text: string): boolean {
  return CYRILLIC.test(text);
}

/** Переводит одну строку (код или сообщение) на русский. */
export function translateApiMessage(raw: string | undefined | null, fallback = "Ошибка"): string {
  if (!raw?.trim()) return fallback;
  const trimmed = raw.trim();
  if (isRussian(trimmed)) return trimmed;

  const byCode = API_ERROR_CODES_RU[trimmed];
  if (byCode) return byCode;

  for (const { test, ru } of ENGLISH_MESSAGE_PATTERNS) {
    if (test.test(trimmed)) return ru;
  }

  return trimmed;
}

type ApiErrorPayload = {
  error?: string;
  message?: string;
};

/** Переводит тело ответа API `{ error, message }`. */
export function translateApiError(
  payload: ApiErrorPayload | string | undefined | null,
  fallback = "Ошибка",
): string {
  if (!payload) return fallback;
  if (typeof payload === "string") return translateApiMessage(payload, fallback);

  const { error, message } = payload;
  if (message?.trim()) {
    const translatedMessage = translateApiMessage(message, "");
    if (translatedMessage) return translatedMessage;
  }
  if (error?.trim()) return translateApiMessage(error, fallback);
  return fallback;
}

/** Извлекает и переводит ошибку из unknown (React Query / fetch). */
export function apiErrorFromUnknown(err: unknown, fallback = "Ошибка сети"): string {
  if (!err) return fallback;
  if (typeof err === "string") return translateApiMessage(err, fallback);
  if (err instanceof Error && err.message) return translateApiMessage(err.message, fallback);

  const e = err as {
    data?: ApiErrorPayload;
    response?: { data?: ApiErrorPayload };
    status?: number;
  };

  const payload = e.data ?? e.response?.data;
  if (payload) return translateApiError(payload, fallback);

  if (e.status === 404) return "Не найдено";
  if (e.status === 401 || e.status === 403) return "Нет доступа";
  if (e.status === 429) return API_ERROR_CODES_RU.too_many_requests;
  if (e.status === 503) return "Сервис временно недоступен";

  return fallback;
}
