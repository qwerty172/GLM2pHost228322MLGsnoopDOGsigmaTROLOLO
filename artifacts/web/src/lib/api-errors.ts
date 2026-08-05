/**
 * Централизованный перевод кодов и текстов ошибок API в пользовательские сообщения на русском.
 * Используется в toast, inline-ошибках и экранах embed/play.
 */

export type ApiErrorPayload = {
  error?: string;
  message?: string;
  title?: string;
  detail?: string;
  reason?: string;
};

const ERROR_CODE_RU: Record<string, string> = {
  host_busy: "У хоста уже идёт сессия — выбери другого или подожди.",
  host_offline: "Хост сейчас офлайн. Выбери другого или попробуй позже.",
  no_game: "В каталоге нет ни одной игры — обратитесь к администратору.",
  game_not_found: "Игра не найдена.",
  game_unavailable: "Игра сейчас недоступна на этом хосте.",
  host_not_found: "Хост не найден.",
  session_not_found: "Сессия не найдена или уже завершена.",
  session_has_ended: "Сессия уже завершена.",
  session_not_active: "Сессия не активна.",
  session_already_claimed: "Сессия уже занята другим игроком.",
  embed_session_not_claimable: "Эта сессия создана через API-ключ и недоступна для обычного игрока.",
  invite_expired: "Ссылка-приглашение истекла.",
  invite_not_found: "Приглашение не найдено.",
  insufficient_balance: "Недостаточно средств на кошельке. Пополни баланс и попробуй снова.",
  insufficient_balance_block: "Недостаточно средств для резервирования блока.",
  insufficient_balance_renew: "Недостаточно средств для продления блока.",
  too_many_requests: "Слишком много запросов. Подожди немного и попробуй снова.",
  rate_limited: "Слишком много попыток. Подожди немного и попробуй снова.",
  not_authenticated: "Требуется авторизация.",
  invalid_host_token: "Неверный токен хоста.",
  not_your_session: "Это не ваша сессия.",
  forbidden: "Доступ запрещён.",
  player_wallet_not_found: "Кошелёк игрока не найден.",
  user_not_found: "Пользователь не найден.",
  quota_not_found: "Квота не найдена.",
  not_your_quota: "Это не ваша квота.",
  quota_not_active: "Квота не активна.",
  ai_unavailable: "ИИ-подсказки временно недоступны.",
  encryption_unavailable: "Шифрование не настроено на сервере.",
  storage_unavailable: "Хранилище файлов временно недоступно.",
  save_not_found: "Сохранение не найдено.",
  save_upload_not_found: "Загрузка сохранения не найдена.",
  already_rated: "Вы уже оценили эту сессию.",
  invalid_api_key: "Неверный API-ключ.",
  key_disabled: "API-ключ отключён.",
  key_balance_exhausted: "Баланс API-ключа исчерпан. Пополните кошелёк ключа.",
  no_eligible_host: "Нет подходящего хоста для этой игры.",
  hosts_busy: "Все хосты заняты — попробуйте позже.",
  quota_requirements_unmet: "Требования квоты не выполнены на доступных хостах.",
  dev_key_no_withdrawal: "API-ключи не могут выводить средства — только пополнение.",
  host_auth_required: "Используйте авторизацию хоста (Bearer hostToken).",
  quota_key_exclusive: "Квота привязана к другому API-ключу.",
  missing_params: "Не хватает обязательных параметров.",
  network_error: "Не удалось связаться с сервером.",
  not_found: "Ресурс не найден.",
  cors_forbidden: "Запрос отклонён политикой CORS.",
  file_not_found: "Файл не найден.",
  unknown_host_token: "Неизвестный токен хоста.",
  submission_not_found: "Заявка не найдена.",
  not_your_submission: "Это не ваша заявка.",
  vt_lookup_failed: "Не удалось проверить файл в VirusTotal.",
  purchase_failed: "Не удалось выполнить покупку.",
  withdrawal_failed: "Не удалось запросить вывод.",
  publish_failed: "Не удалось опубликовать.",
  pause_failed: "Не удалось поставить на паузу.",
  close_failed: "Не удалось закрыть.",
  funding_failed: "Не удалось профинансировать.",
  repay_failed: "Не удалось погасить займ.",
  ai_request_failed: "Ошибка запроса к ИИ.",
  failed_to_create_session: "Не удалось создать сессию.",
  failed_to_create_browser_host: "Не удалось создать сессию в браузере.",
  failed_to_create_test_session: "Не удалось создать тест-сессию.",
  failed_to_store_clip: "Не удалось сохранить клип.",
  internal_error: "Внутренняя ошибка сервера.",
  host_not_reachable: "Хост недоступен с платформы.",
  no_vds_configured: "VDS не настроен.",
  no_file_uploaded: "Файл не загружен.",
  preview_cooldown: "Превью для этого хоста на паузе — попробуйте чуть позже.",
};

/** Точное совпадение английских сообщений API (без учёта регистра). */
const EXACT_EN_RU: Record<string, string> = {
  "user not found": "Пользователь не найден.",
  "not authenticated": "Требуется авторизация.",
  "host not found": "Хост не найден.",
  "session not found": "Сессия не найдена или уже завершена.",
  "session has ended": "Сессия уже завершена.",
  "session not active": "Сессия не активна.",
  "session already claimed by another player": "Сессия уже занята другим игроком.",
  "host is not currently available": "Хост сейчас недоступен.",
  "host's minute price is invalid": "У хоста указана некорректная цена за минуту.",
  "quota is not active": "Квота не активна.",
  "invalid host token": "Неверный токен хоста.",
  "not your session": "Это не ваша сессия.",
  "player wallet not found": "Кошелёк игрока не найден.",
  "game not found": "Игра не найдена.",
  "insufficient balance to reserve the block": "Недостаточно средств для резервирования блока.",
  "insufficient balance to renew block": "Недостаточно средств для продления блока.",
  "only the session player can rate": "Оценить может только игрок этой сессии.",
  "session must be ended before rating": "Оценить можно только после завершения сессии.",
  "wallet does not match session": "Кошелёк не совпадает с сессией.",
  "not a block session": "Это не блочная сессия.",
  "quota not found": "Квота не найдена.",
  "not your quota": "Это не ваша квота.",
  "host is not reachable from the platform": "Хост недоступен с платформы.",
  "internal error": "Внутренняя ошибка сервера.",
  "file not found": "Файл не найден.",
  "missing x-host-token header": "Отсутствует заголовок X-Host-Token.",
  "missing x-host-token header or hosttoken query param":
    "Отсутствует токен хоста (заголовок или query).",
  "unknown host token": "Неизвестный токен хоста.",
  "unknown hosttoken": "Неизвестный токен хоста.",
  "missing x-player-wallet-token header": "Отсутствует заголовок X-Player-Wallet-Token.",
  "missing x-player-wallet-token": "Отсутствует заголовок X-Player-Wallet-Token.",
  "no file uploaded": "Файл не загружен.",
  "failed to store clip": "Не удалось сохранить клип.",
  "failed to create session": "Не удалось создать сессию.",
  "failed to create browser host": "Не удалось создать сессию в браузере.",
  "failed to create test session": "Не удалось создать тест-сессию.",
  "amountlzt must be a positive integer": "Сумма LZT должна быть положительным целым числом.",
  "api keys cannot withdraw — deposit-only wallet":
    "API-ключи не могут выводить средства — только пополнение.",
  "unknown or invalid api key": "Неверный API-ключ.",
  "this api key has been disabled": "API-ключ отключён.",
  "vt lookup failed": "Не удалось проверить файл в VirusTotal.",
  "x-host-token required": "Требуется X-Host-Token.",
  "ownerToken required": "Требуется ownerToken.",
  "gameId required": "Требуется gameId.",
  "inviteCode required": "Требуется код приглашения.",
  "playerWalletToken required": "Требуется токен кошелька игрока.",
  "hostToken required": "Требуется токен хоста.",
  "session id required": "Требуется идентификатор сессии.",
  "blockMinutes must be 10, 15, or 25": "blockMinutes должен быть 10, 15 или 25.",
};

const EN_PATTERN_RU: Array<{ test: RegExp; message: string }> = [
  {
    test: /insufficient|balance|недостаточно|exhausted/i,
    message: "Недостаточно средств на кошельке. Пополни баланс и попробуй снова.",
  },
  {
    test: /already.?claimed|уже занят|claimed by another/i,
    message: "Сессия уже занята другим игроком.",
  },
  {
    test: /host.?offline|host_offline/i,
    message: "Хост сейчас офлайн. Выбери другого или попробуй позже.",
  },
  {
    test: /not.?found|404|не найден/i,
    message: "Запрошенный ресурс не найден.",
  },
  {
    test: /rate.?limit|too many/i,
    message: "Слишком много попыток. Подожди немного и попробуй снова.",
  },
  {
    test: /network|fetch failed|failed to fetch/i,
    message: "Ошибка сети. Проверь подключение и попробуй снова.",
  },
];

function normalizeCode(code: string): string {
  return code.trim().toLowerCase().replace(/\s+/g, "_");
}

function isMostlyAscii(text: string): boolean {
  return /^[\x00-\x7F\s.,:;!?'"()\-–—/\\@#$%&*+=<>[\]{}|`~^]+$/.test(text);
}

export function extractApiErrorPayload(err: unknown): ApiErrorPayload | null {
  if (!err) return null;

  if (typeof err === "string") {
    const trimmed = err.trim();
    return trimmed ? { message: trimmed } : null;
  }

  if (typeof err !== "object") return null;

  const record = err as Record<string, unknown>;
  const data =
    record.data && typeof record.data === "object"
      ? (record.data as Record<string, unknown>)
      : record;

  const payload: ApiErrorPayload = {};
  for (const key of ["error", "message", "title", "detail", "reason"] as const) {
    const value = data[key] ?? record[key];
    if (typeof value === "string" && value.trim()) {
      payload[key] = value.trim();
    }
  }

  if (!payload.message && !payload.error && typeof record.message === "string") {
    const raw = record.message.trim();
    if (raw && !raw.startsWith("HTTP ")) {
      payload.message = raw;
    }
  }

  return payload.error || payload.message || payload.detail ? payload : null;
}

function translateExactEnglish(text: string): string | null {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return null;
  return EXACT_EN_RU[normalized] ?? null;
}

function translateByPattern(text: string): string | null {
  for (const { test, message } of EN_PATTERN_RU) {
    if (test.test(text)) return message;
  }
  return null;
}

function translateErrorCode(code: string): string | null {
  const normalized = normalizeCode(code);
  return ERROR_CODE_RU[normalized] ?? null;
}

/**
 * Преобразует ошибку API (ApiError, fetch, строка) в короткое сообщение для UI.
 */
export function formatApiError(err: unknown, fallback = "Произошла ошибка. Попробуй ещё раз."): string {
  const payload = extractApiErrorPayload(err);
  if (!payload) return fallback;

  if (payload.message) {
    const fromCode = payload.error ? translateErrorCode(payload.error) : null;
    if (fromCode && isMostlyAscii(payload.message)) return fromCode;

    const exact = translateExactEnglish(payload.message);
    if (exact) return exact;

    if (!isMostlyAscii(payload.message)) return payload.message;

    const pattern = translateByPattern(payload.message);
    if (pattern) return pattern;
  }

  if (payload.detail && !isMostlyAscii(payload.detail)) return payload.detail;
  if (payload.error) {
    const fromCode = translateErrorCode(payload.error);
    if (fromCode) return fromCode;
  }

  if (payload.message && isMostlyAscii(payload.message)) {
    const pattern = translateByPattern(payload.message);
    if (pattern) return pattern;
    return fallback;
  }

  if (payload.detail) {
    const exact = translateExactEnglish(payload.detail);
    if (exact) return exact;
    if (!isMostlyAscii(payload.detail)) return payload.detail;
  }

  return fallback;
}

/** Заголовок + детали для полноэкранных ошибок (embed и т.п.). */
export function formatApiErrorPanel(
  err: unknown,
  defaults: { title: string; detail: string },
): { title: string; detail: string } {
  const payload = extractApiErrorPayload(err);
  if (!payload) return defaults;

  const code = payload.error ? normalizeCode(payload.error) : "";
  const titleByCode: Record<string, string> = {
    key_balance_exhausted: "Баланс API-ключа исчерпан",
    invalid_api_key: "Неверный API-ключ",
    key_disabled: "API-ключ отключён",
    missing_params: "Не хватает параметров",
    network_error: "Ошибка сети",
    host_offline: "Хост офлайн",
    hosts_busy: "Все хосты заняты",
    no_eligible_host: "Нет подходящего хоста",
    game_not_found: "Игра не найдена",
    invite_expired: "Приглашение истекло",
  };

  const title = (code && titleByCode[code]) || defaults.title;
  const detail = formatApiError(err, defaults.detail);
  return { title, detail };
}
