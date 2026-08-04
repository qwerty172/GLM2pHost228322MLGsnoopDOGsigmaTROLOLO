# DecentralHub — План тестирования и отладки (локальный ПК)

> Задача: поднять сервис локально на **вашем Windows-ПК**, прогнать каждый узел, найти и починить всё сломанное.
> Исходное допущение: **~80% функционала может не работать** — проверяй всё, ничему не доверяй.
> Порядок фаз важен. Одна фаза = один PR / сессия с Cursor Agent.

---

## Текущий прогресс

| Фаза | Что | Статус | Критерий «готово» |
|---|---|---|---|
| 0–1 | Окружение + API smoke | ✅ **DONE** | `http://localhost:8080/api/healthz` → `{"status":"ok"}` |
| 2 | Обход страниц в браузере | ✅ **verified (Windows)** | 11 URL + регистрация игрока/хоста |
| 3 | P2P browser-host ↔ player | ✅ **verified (Windows)** | signaling + lifecycle + billing + P2P HUD |
| 4 | Windows-агент (Electron) | ✅ **verified (Windows)** | test/build/zip + Electron start; Steam E2E manual |
| 5 | Экономика, биллинг | ✅ **agent verified** | vitest economy offline + ledger CI; Windows billing manual |
| 6 | Квоты, VDS, embed | **blocked (human)** | Форма без AI — нужен ручной прогон на Windows |
| 7 | Регресс + отчёт | ✅ **agent done** | CI + MARATHON; Windows P2P re-check — human |
| **marathon** | 4-cycle audit | ✅ **2026-07-27** | [MARATHON.md](./MARATHON.md); SSE auth, save-sync, UX |
| **post-merge** | CI + unit smoke | ✅ **2026-07-25** | `pnpm typecheck`, api/host-agent tests, unified `.github/workflows/ci.yml` |

**Если `healthz` ok и `:5000` открывается — фазы 0–1 пройдены, начинайте фазу 2.**

Журнал багов: [TESTLOG.md](./TESTLOG.md). Инструкция запуска: [LOCAL_SETUP.md](./LOCAL_SETUP.md). **Хостинг и привязка к окну:** [HOSTING.md](./HOSTING.md).

---

## Локальный Windows — быстрый старт

```bat
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git
cd GLM2pHost228322MLGsnoopDOGsigmaTROLOLO
pnpm infra:up
scripts\setup-local.bat
scripts\dev-local.bat
```

| Сервис | URL |
|---|---|
| Web | http://localhost:5000 |
| API | http://localhost:8080/api/healthz |
| Smoke-тест API | `scripts\smoke-api.bat` |
| Invite-flow smoke | `pnpm smoke:invite` (API + Postgres) |
| Features smoke (invite/rating/guest) | `pnpm smoke:features` |

**Уже настроено в репозитории:** `dotenv-cli`, Vite-прокси `/api` → `:8080` (с `ws: true`), `cross-env` для Windows, lazy Anthropic (баг #1 в TESTLOG — fixed).

**Разделение ролей:**
- **Вы на ПК** — браузер, WebRTC (2 окна), Electron-агент, описание багов
- **Cursor Agent** — правки кода, обновление TESTPLAN/TESTLOG
- **Не нужно** — заново clone/setup, если healthz ok и `dev-local.bat` уже запущен

---

## Правила отладки

1. **Веди журнал** в [TESTLOG.md](./TESTLOG.md): `| # | Где | Симптом | Причина | Фикс | Статус |`
2. **Чини корневую причину**, не симптом. Ошибки пользователю — на русском.
3. После фикса — повтори проверку и `pnpm run typecheck`.
4. Не меняй формат API-ответов и DataChannel без крайней необходимости.
5. UI — русский; код, логи, комментарии — английский.
6. Внешние сервисы (Replit Storage, Anthropic, крипто) — **деградируют с ошибкой**, не роняют сервер.

---

## ФАЗА 0–1 — Окружение и API (✅ пропустить, если healthz ok)

> **Быстрая проверка:** открой http://localhost:8080/api/healthz — если `{"status":"ok"}`, эта фаза пройдена.

### Что уже должно работать

- `scripts\setup-local.bat` — install + db push
- `scripts\dev-local.bat` — API :8080 + Web :5000
- `scripts\smoke-api.bat` (Windows) или `./scripts/smoke-api.sh` (Git Bash)

### Smoke-тест (фаза 1.2)

```bat
scripts\smoke-api.bat
```

Ожидаемые коды:

```bash
GET  /api/healthz              → 200  {"status":"ok"}
GET  /api/games                → 200  (не пустой после seedGames)
GET  /api/games/rogue-fable-3  → 200
GET  /api/hosts                → 200
GET  /api/quotas               → 200
GET  /api/loans/requests       → 200
POST /api/players/register     → 201  body: {"guest":true}
```

### Опционально (добивание фазы 1)

**1.3 Негативные проверки:**
```bash
curl -s localhost:8080/api/wallet/badtoken   # 404/401, не 500
curl -s localhost:8080/api/sessions/xxx      # аналогично
```

**1.4 WebSocket (ожидаем 401 на невалидный токен):**
```bash
npx wscat -c "ws://localhost:8080/api/signal?role=player&playerToken=test"
```

**1.1 Стабильность:** API ≥5 мин без крашей; крипто-воркеры не спамят лог каждые N сек.

### Полная установка (если healthz не ok)

<details>
<summary>Фаза 0 — детали</summary>

```bash
pnpm install
cp .env.example .env   # Windows: copy .env.example .env
```

Заполнить `.env`: `DATABASE_URL`, `WALLET_ENCRYPTION_KEY`, `ADMIN_SECRET`, `API_PROXY_TARGET=http://localhost:8080`.

```bash
pnpm --filter @workspace/db run push
pnpm run typecheck
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/web run build
```

</details>

---

## ФАЗА 2 — Web: обход всех страниц (→ СЕЙЧАС)

### 2.1 Предусловия

- API и Web запущены (`scripts\dev-local.bat`)
- http://localhost:5000 открывается
- http://localhost:8080/api/healthz → ok
- F12 → **Console** + **Network** — смотреть ошибки

### 2.2 Обход страниц

| # | Страница | Путь | Что проверить |
|---|---|---|---|
| 1 | Лендинг | `/` | Рендер, цифры, кнопки |
| 2 | Каталог | `/games` | Rogue Fable III из seedGames, поиск |
| 3 | Игра | `/games/rogue-fable-3` | Детали, пинг, «Играть» |
| 4 | Хосты | `/hosts` | Список, GPU/CPU, пинг |
| 5 | Кошелёк | `/wallet` | Балансы, история |
| 6 | Профиль | `/profile` | Статистика, транзакции |
| 7 | Биржа | `/exchange` | Каркас, кредиты |
| 8 | Квоты | `/quotas`, `/quotas/new` | Список, форма (AI может 503 — ок) |
| 9 | Хост | `/host/setup`, `/host`, `/host/library` | Онбординг, дашборд, библиотека |
| 10 | Embed | `/embed` | Виджет открывается |
| 11 | Плеер | `/play/:playerToken` | Фаза 3 |

Белая страница / спиннер / красные `/api` в Network → в TESTLOG.

### 2.3 Регистрация

1. **Игрок:** с лендинга → каталог; токен в localStorage
2. **Хост:** `/host/setup` → создание → дашборд `/host` показывает «агент не подключен» (ping `http://localhost:18080/ping`); токен в `streamline.hostToken`

**Критерий:** все страницы без ошибок консоли; игрок и хост создаются; данные с API приходят.

---

## ФАЗА 3 — P2P в браузере (без Windows-агента)

Браузерный хост: [`/host/play/:sessionId`](artifacts/web/src/pages/host/browser-play.tsx). Референс-игра: **Rogue Fable III** (`rogue-fable-3`).

### 3.1 Подготовка

- Два окна: A — хост, B — игрок (или обычное + инкогнито)
- Окно A: хост → browser-play → захват экрана/вкладки

### 3.2 Сигналинг

- Network: WS `/api/signal?role=host...` и `role=player...`, ICE-кандидаты
- Окно B: `/games/rogue-fable-3` → «Играть» → выбрать хоста из A

### 3.3 Чеклист

1. Видео у игрока ≤10 сек
2. HUD: пинг, баланс
3. Ввод доходит до хоста (`{type:"input",kind,action,button,x,y}`)
4. Закрыть окно A → «Хост отключился»
5. Reconnect без двойного списания (проверить `/wallet`)

### 3.4 Типовые баги

- ICE локально → прямое соединение без TURN
- Ghost-сессии: `SELECT * FROM sessions WHERE status='active';`
- Токены в URL плеера — известно, не блокер

**Критерий:** полный цикл видео + ввод + биллинг + disconnect.

### 3.5 Автономные проверки (cloud Linux)

API и Web должны быть запущены (`./scripts/dev-local.sh`).

```bash
node scripts/signaling-smoke.mjs      # WS host+player, offer/answer/ICE relay
./scripts/session-lifecycle.sh        # create → active → end, SQL ghost check
BILLING_SMOKE=1 ./scripts/session-lifecycle.sh   # + billing_events после ~70с
```

| Проверка | Скрипт | Cloud |
|---|---|---|
| Signaling relay | `signaling-smoke.mjs` | ✅ |
| Session end, no ghost | `session-lifecycle.sh` | ✅ |
| Billing tick | `BILLING_SMOKE=1 session-lifecycle.sh` | ✅ |
| WebRTC video | — | **blocked** |
| DataChannel input / browser UX | — | **blocked** |
| getDisplayMedia | — | **blocked** |

### 3.6 Ручные проверки (Windows / браузер)

Только пункты **blocked** выше — два окна браузера, захват экрана, disconnect UX.

---

## ФАЗА 4 — Windows-агент E2E

> **Подробный разбор привязки к окну, focus guard и чеклист:** [HOSTING.md](./HOSTING.md)

```bat
pnpm --filter @workspace/host-agent run test
pnpm --filter @workspace/host-agent run dev
```

1. API `http://localhost:8080` + токен хоста с дашборда
2. Дашборд → «Агент подключен» (ping :18080)
3. Полный цикл: Steam-скан → сессия → видео + SendInput
4. Kill агента → игрок «Хост отключился» ≤30 сек, сессия закрыта

ViGEm/gamepad inject — **не чинить** (известное ограничение).

### 4.1 Автономные проверки (cloud Linux)

```bash
pnpm --filter @workspace/host-agent run typecheck
pnpm --filter @workspace/host-agent run test      # ping-server 11 tests
pnpm --filter @workspace/host-agent run build
./scripts/agent-api-smoke.sh   # heartbeat, agent-auth, ice-config, zip, ping :18080
```

| Проверка | Скрипт / команда | Cloud |
|---|---|---|
| host-agent unit tests | `pnpm … run test` | ✅ |
| ping-server :18080 | `ping-server-smoke.mjs` (via agent-api-smoke) | ✅ |
| agent-auth Ed25519 | `agent-auth-smoke.mjs` | ✅ |
| host-agent.zip download | `agent-api-smoke.sh` | ✅ |
| Electron tray / Go online UI | — | **blocked** |
| SendInput в реальной игре | — | **blocked** |
| desktopCapturer / exe launch | — | **blocked** |

### 4.2 Ручные проверки (Windows)

Дашборд «Агент онлайн», полный цикл Steam → сессия → SendInput — только на Windows-ПК.

---

## ФАЗА 5 — Экономика

- Тестовый баланс через SQL (запиши в TESTLOG)
- Сессия 3+ мин → списания в `/wallet`; stop → нет ghost-billing
- Блочные тарифы: F5, reconnect без двойного списания
- Крипто без нод → «временно недоступно» по-русски

```sql
SELECT account, SUM(amount) FROM ledger GROUP BY account;
```

---

## ФАЗА 6 — Квоты, VDS, embed

1. Квота вручную через `/quotas/new` (без AI)
2. minSpecs-фильтр хостов
3. VDS без SSH → ошибка, не краш
4. `/embed` + devKeys
5. Битая обложка → внятная ошибка

---

## ФАЗА 7 — Регресс и отчёт

1. `scripts\smoke-api.bat` — все коды как в фазе 1
2. Повтор P2P (фаза 3)
3. Повтор обхода страниц (фаза 2)
4. `pnpm --filter @workspace/host-agent run test`
5. Итог в [TESTLOG.md](./TESTLOG.md)

---

## Карта кодовой базы

| Узел | Где |
|---|---|
| API-сервер | `artifacts/api-server/src/routes/` |
| Сигналинг WS | `artifacts/api-server/src/lib/signaling.ts` → `/api/signal` |
| Воркеры | `artifacts/api-server/src/lib/*Worker.ts` |
| Экономика | `artifacts/api-server/src/lib/economy.ts` |
| Web | `artifacts/web/src/pages/` |
| Плеер | `artifacts/web/src/pages/play.tsx` |
| Browser-host | `artifacts/web/src/pages/host/browser-play.tsx` |
| Windows-агент | `artifacts/host-agent/src/` |
| Ping агента | `127.0.0.1:18080` |
| Токен хоста | localStorage `streamline.hostToken` |

---

## Приложение: Cloud Agent (автономные фазы 2–4)

Agent может прогнать API/WS/SQL/build в Linux без браузера и Windows:

```bash
chmod +x scripts/*.sh scripts/*.mjs
./scripts/cloud-setup.sh
./scripts/dev-local.sh          # в отдельном терминале
./scripts/smoke-api.sh
./scripts/pages-api-smoke.sh    # фаза 2 API + web shell
node scripts/signaling-smoke.mjs
./scripts/session-lifecycle.sh
./scripts/agent-api-smoke.sh
pnpm --filter @workspace/host-agent run test
```

| Что | Cloud Agent | Windows / браузер |
|---|---|---|
| Install, API smoke, pages API | ✅ | ✅ |
| Signaling WS, session lifecycle | ✅ | ✅ |
| host-agent test/build/zip | ✅ | ✅ |
| Браузер, WebRTC video | **blocked** | ✅ |
| Windows-агент GUI, SendInput | **blocked** | ✅ |

Фазы 2–4 API — **прогнаны автономно** (см. [TESTLOG.md](./TESTLOG.md)). WebRTC/Electron — только на ПК.

---

## Pre-existing (не блокируют фазу 2)

- `pnpm run typecheck` — ошибки в автогене `lib/api-client-react`
- Object storage без Replit — upload может 500
- Крипто-воркеры — проверить спам в логе API ≥5 мин
