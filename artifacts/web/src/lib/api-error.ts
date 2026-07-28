/**
 * Человекочитаемые сообщения об ошибках API на русском.
 * Правило: что случилось + что делать; сетевые сбои — без англ. «Failed to fetch».
 */

type ErrorBody = { error?: string; message?: string };

const NETWORK_RE =
  /failed to fetch|networkerror|load failed|network request failed|network error/i;

/** Точные совпадения с телом `{ error: "..." }` или ApiError.message */
const EXACT_RU: Record<string, string> = {
  "Not authenticated": "Нужна авторизация — войдите как хост",
  "Unknown host token": "Ключ хоста не распознан. Получите новый на дашборде",
  "Unknown hostToken": "Ключ хоста не распознан. Получите новый на дашборде",
  "Missing X-Host-Token header": "Не передан ключ хоста — войдите на дашборде",
  "Missing X-Host-Token header or hostToken query param":
    "Не передан ключ хоста — войдите на дашборде",
  "Missing X-Player-Wallet-Token header": "Кошелёк игрока не найден — обновите страницу",
  "Unknown player wallet token": "Сессия кошелька устарела — обновите страницу",
  "Host not found": "Хост не найден — проверьте ключ или зарегистрируйтесь заново",
  "Host is not currently available": "Хост сейчас недоступен — попробуйте позже",
  host_busy: "Хост занят другой сессией — дождитесь завершения или выберите другого",
  "Failed to create session": "Не удалось создать сессию — попробуйте ещё раз",
  "Failed to create test session": "Не удалось создать тест-сессию — проверьте агента",
  "Failed to create browser host": "Не удалось запустить браузерный хост",
  "Session not found": "Сессия не найдена или уже завершена",
  "Session has ended": "Сессия уже завершена",
  "Session already claimed by another player": "Сессия уже занята другим игроком",
  "Session not active": "Сессия не активна",
  "Not a block session": "Это не блочная сессия",
  "Player wallet not found": "Кошелёк игрока не найден — обновите страницу",
  "Game not found": "Игра не найдена",
  "User not found": "Пользователь не найден",
  "Quota not found": "Квота не найдена",
  "Not your quota": "Это не ваша квота",
  "Quota is not active": "Квота не активна — опубликуйте её на дашборде",
  "No VDS configured": "VDS не настроен — укажите SSH в настройках квоты",
  "Host is not reachable from the platform":
    "Платформа не достучалась до VDS — проверьте SSH и файрвол",
  "Internal error": "Внутренняя ошибка сервера — попробуйте позже",
  "File not found": "Файл не найден",
  "No file uploaded": "Файл не выбран",
  "Failed to store clip": "Не удалось сохранить клип — попробуйте ещё раз",
  "Invalid host token": "Неверный ключ хоста",
  "Not your session": "Это не ваша сессия",
  "Only the session player can rate": "Оценить может только игрок этой сессии",
  "Session must be ended before rating": "Оценить можно только после завершения сессии",
  "Insufficient balance to reserve the block":
    "Недостаточно средств для бронирования блока — пополните кошелёк",
  "Insufficient balance to renew block":
    "Недостаточно средств для продления блока — пополните кошелёк",
  "Wallet does not match session": "Кошелёк не совпадает с сессией",
  "Invite not found": "Ссылка-приглашение не найдена",
  invite_expired: "Ссылка-приглашение истекла — попросите новую у хоста",
  embed_session_not_claimable: "Embed-сессию нельзя занять через обычный интерфейс",
  no_game: "У хоста не выбрана игра для тест-сессии",
  encryption_unavailable:
    "Шифрование на сервере недоступно — обратитесь к администратору",
  dev_key_no_withdrawal: "API-ключи не могут выводить средства — только пополнение",
  "VT lookup failed": "Не удалось проверить файл в VirusTotal",
  "Timed out after 10s": "Таймаут SSH-подключения (10 с) — проверьте хост и ключ",
  "ssh2 module unavailable": "SSH-модуль недоступен на сервере",
  "Submission not found": "Заявка не найдена",
  "Not your submission": "Это не ваша заявка",
  "Requested game is not in host's library or is disabled":
    "Игра не в библиотеке хоста или отключена",
  "This game does not support browser-host mode":
    "Эта игра не поддерживает браузерный хост",
  "Invalid access code for private quota": "Неверный код доступа к приватной квоте",
  "Host's minute price is invalid": "У хоста некорректная цена за минуту",
  "amountLzt must be a positive integer": "Сумма должна быть положительным целым числом LZT",
};

function hasCyrillic(text: string): boolean {
  return /[а-яА-ЯёЁ]/.test(text);
}

function stripHttpPrefix(message: string): string {
  const match = message.match(/^HTTP \d{3}[^:]*:\s*(.+)$/s);
  return match ? match[1].trim() : message.trim();
}

function readErrorBody(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const body = data as ErrorBody;
  const msg = body.message?.trim();
  const err = body.error?.trim();
  if (msg && err && msg !== err) return msg;
  return msg || err;
}

function extractRaw(err: unknown): string | undefined {
  if (typeof err === "string") return err.trim() || undefined;
  if (!err || typeof err !== "object") return undefined;

  if ("data" in err) {
    const fromData = readErrorBody((err as { data: unknown }).data);
    if (fromData) return fromData;
  }

  if ("response" in err) {
    const response = (err as { response?: { data?: unknown } }).response;
    const fromResponse = readErrorBody(response?.data);
    if (fromResponse) return fromResponse;
  }

  if (err instanceof Error && err.message) {
    return stripHttpPrefix(err.message);
  }

  return undefined;
}

function isNetworkFailure(err: unknown, raw?: string): boolean {
  if (raw && NETWORK_RE.test(raw)) return true;
  if (err instanceof TypeError && NETWORK_RE.test(err.message)) return true;
  if (err instanceof Error && err.name === "ResponseParseError") {
    return true;
  }
  return false;
}

function translateByPattern(raw: string): string | undefined {
  const lower = raw.toLowerCase();

  if (/insufficient.*balance|недостаточно/i.test(raw)) {
    return "Недостаточно средств на кошельке — пополните баланс";
  }
  if (/rate.?limit|too many/i.test(raw)) {
    return "Слишком много запросов — подождите минуту и попробуйте снова";
  }
  if (/not found|не найден/i.test(raw)) {
    return "Запись не найдена";
  }
  if (/unauthorized|forbidden|not authenticated/i.test(raw)) {
    return "Нет доступа — войдите в аккаунт";
  }
  if (/required|обязательн/i.test(raw)) {
    return "Заполните обязательные поля";
  }
  if (/invalid.*url|must be a valid http/i.test(raw)) {
    return "Укажите корректный URL (http:// или https://)";
  }
  if (/expected .+ received/i.test(raw)) {
    return "Некорректный формат данных в форме";
  }
  if (/already exists|already claimed|уже занят/i.test(raw)) {
    return "Уже существует или занято — выберите другое значение";
  }
  if (lower.includes("internal server error") || /^5\d{2}$/.test(raw)) {
    return "Ошибка сервера — попробуйте позже";
  }

  return undefined;
}

/** Переводит сырую строку `error` из JSON-ответа API. */
export function formatApiErrorText(
  raw: string | null | undefined,
  fallback = "Что-то пошло не так — попробуйте ещё раз",
): string {
  if (!raw?.trim()) return fallback;
  const text = raw.trim();
  if (EXACT_RU[text]) return EXACT_RU[text];
  if (hasCyrillic(text)) return text;
  const byPattern = translateByPattern(text);
  if (byPattern) return byPattern;
  return fallback;
}

/** Универсальный хелпер для catch-блоков и React Query onError. */
export function formatUserError(
  err: unknown,
  fallback = "Что-то пошло не так — попробуйте ещё раз",
): string {
  if (isNetworkFailure(err, extractRaw(err))) {
    return "Нет связи с сервером — проверьте интернет и попробуйте снова";
  }

  const raw = extractRaw(err);
  if (!raw) return fallback;

  if (EXACT_RU[raw]) return EXACT_RU[raw];
  if (hasCyrillic(raw)) return raw;

  const byPattern = translateByPattern(raw);
  if (byPattern) return byPattern;

  return fallback;
}
