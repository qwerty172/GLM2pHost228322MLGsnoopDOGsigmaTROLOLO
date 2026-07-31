# DecentralHub Marathon — живой бэклог

> **Активный цикл:** Cycle 2 — Web UI  
> **Automation:** Cursor Automation `DecentralHub Marathon — следующий цикл` (cron пн/чт 09:00)  
> **Хостинг / окна / тесты:** [HOSTING.md](./HOSTING.md)  
> **Последнее обновление:** 2026-07-31 (Cycle 6 REDESIGN + grooming каждые 5 запусков)

## Как пользоваться

1. Automation (или агент в чате) берёт **первую** задачу со статусом `pending` в активном цикле.
2. Переводит в `in_progress` → выполняет acceptance → `done` или `blocked`.
3. Записывает находки в [TESTLOG.md](./TESTLOG.md).
4. Базовая верификация: `pnpm typecheck`, api/host-agent tests, `pnpm smoke:invite`.

**Источники задач:** этот файл — единый бэклог для automation; [PLAN.md](./PLAN.md), [REDESIGN.md](./REDESIGN.md) и [HOSTING.md](./HOSTING.md) — справочники (импорт в Cycle 5–6 / grooming каждые 5 запусков).

**Статусы:** `pending` | `in_progress` | `done` | `blocked`  
**Owner:** `agent` | `human`

---

## Cycle 1 — API Server

| ID | Задача | Priority | Status | Owner | Acceptance |
|----|--------|----------|--------|-------|------------|
| C1-S01 | Инвентаризация auth (URL/query vs headers) | P0 | done | agent | Таблица в TESTLOG #marathon-c1 |
| C1-S02 | SSE `/events/stream` auth + rate limit | P0 | done | agent | 401 без токена; limiter 30/min |
| C1-S03 | Объединить timingSafe модули | P1 | done | agent | Один timingSafe.ts |
| C1-S04 | Workers audit | P1 | done | agent | TESTLOG |
| C1-S05 | Signaling WS auth audit | P0 | done | agent | ws-ticket documented |
| C1-S06 | Storage ACL legacy public read | P1 | pending | agent | Backlog |
| C1-S07 | Rate limits enrich + loans read | P2 | done | agent | enrichLimiter + readLimiter |
| C1-S08 | joinCodes deprecation | P2 | done | agent | Deprecation header |
| C1-D01 | Smoke + ledger | P0 | done | agent | CI |
| C1-D02 | Economy E2E | P1 | done | agent | vitest |
| C1-D03 | Security pass | P1 | done | agent | SSE closed |
| C1-F01 | timingSafe merge | P0 | done | agent | timingSafeEqual.ts removed |
| C1-F02 | SSE auth | P0 | done | agent | events.ts |
| C1-F03 | Vitest unify | P1 | done | agent | __tests__ in vitest |
| C1-F04 | Routes smoke | P1 | done | agent | routes.smoke.test.ts |
| C1-F05 | Central auth middleware | P2 | pending | agent | Backlog |

## Cycle 2 — Web UI

| ID | Задача | Priority | Status | Owner |
|----|--------|----------|--------|-------|
| C2-S01 | Raw fetch audit | P1 | done | agent |
| C2-S02 | embed/admin codegen | P1 | pending | agent |
| C2-S03 | landing hosts dup | P2 | done | agent |
| C2-S04 | RU browser-play | P1 | done | agent |
| C2-S05 | a11y player | P1 | done | agent |
| C2-S06 | /wallet route | P2 | done | agent |
| C2-S07 | shadcn sr-only RU | P3 | pending | agent |
| C2-S08 | nav Играть | P2 | done | agent |
| C2-D01 | pages-api-smoke | P1 | done | agent |
| C2-D02 | OpenAPI gaps | P1 | done | agent |
| C2-D03 | invite flow | P1 | done | agent |
| C2-F01 | browser-play RU | P1 | done | agent |
| C2-F02 | play a11y | P1 | done | agent |
| C2-F03 | landing codegen | P2 | done | agent |
| C2-F04 | skip-link | P2 | done | agent |
| C2-B01 | `PATCH /players/me/credit-settings` (PLAN 3.4) | P1 | pending | agent | API + OpenAPI; toggle в profile.tsx работает |
| C2-B02 | raw fetch → hooks: landing, play, game-detail | P1 | pending | agent | Нет raw `fetch` на эндпоинты из OpenAPI |

## Cycle 3 — Host Agent

| ID | Задача | Priority | Status | Owner |
|----|--------|----------|--------|-------|
| C3-S01 | save zip traversal | P0 | done | agent |
| C3-S02 | pushSave confirm | P0 | done | agent |
| C3-S03 | focus-guard | P1 | done | agent |
| C3-S04 | captureMode native | P1 | done | agent |
| C3-S05 | limited-user launch | P2 | pending | agent |
| C3-S06 | RTMP drift | P2 | pending | agent |
| C3-S07 | ViGEm packaging | P2 | pending | agent |
| C3-S08 | renderer split | P3 | pending | agent |
| C3-D01 | unit tests | P1 | done | agent |
| C3-D02 | agent-api-smoke | P1 | done | agent |
| C3-D03 | Windows E2E | P0 | blocked | human |
| C3-F01 | save-sync | P0 | done | agent |
| C3-F02 | focus-guard fix | P1 | done | agent |
| C3-F03 | captureMode | P1 | done | agent |
| C3-S09 | HWND/PID match вместо title (HOSTING H-01) | P1 | pending | agent | После spawn — match по PID, не по title |
| C3-S10 | Browser watch по hostname (HOSTING H-02) | P1 | pending | agent | Не считать «любой Chrome» живым |
| C3-S11 | Unit tests capture/focus (HOSTING H-07) | P2 | pending | agent | Тесты findBrowserCaptureSource, focus-guard |
| C3-S12 | HWND match после spawn (HOSTING H-08) | P2 | pending | agent | Foreground HWND процесса после launch |

## Cycle 4 — Cross-cutting

| ID | Задача | Status | Owner |
|----|--------|--------|-------|
| C4-S01 | schema drift | done | agent |
| C4-S02 | OpenAPI parity | pending | agent |
| C4-S03 | CI gaps | done | agent |
| C4-S04 | scripts parity | done | agent |
| C4-S05 | .env.example | done | agent |
| C4-S06 | TESTPLAN phase 6 | blocked | human |
| C4-S07 | api-client typecheck | pending | agent |
| C4-S08 | dist hygiene | done | agent |
| C4-D01 | full regression | done | agent |
| C4-D02 | quotas/vds/embed | blocked | human |
| C4-D03 | CI hardening | done | agent |
| C4-B01 | Аудит статусов Wave UX (синхрон с ветками) | P2 | pending | agent | UX-02…06: done только если код в main |
| C4-B02 | Сверка PLAN.md ↔ MARATHON.md | P2 | pending | agent | Таблица импорта в TESTLOG |
| C4-B03 | Acceptance criteria на все pending | P3 | pending | agent | У каждой pending — измеримый acceptance |
| C4-S09 | Rate-limit Redis/PostgreSQL (PLAN 3.7) | P1 | pending | agent | Лимиты общие для 2+ инстансов api-server |

## Wave UX

| ID | Task | Status |
|----|------|--------|
| UX-01 | setup bind docs | done |
| UX-02 | dashboard agent | pending |
| UX-03 | TURN/STUN hints | pending |
| UX-04 | wallet labels | done |
| UX-05 | quotas validation | pending |
| UX-06 | API errors RU | pending |
| UX-07 | spinner RU | done |
| UX-08 | skip-link | done |

## Wave Regression

| ID | Task | Status | Owner |
|----|------|--------|-------|
| REG-01 | typecheck + build | done | agent |
| REG-02 | smokes | done | agent |
| REG-03 | Windows manual | blocked | human |
| REG-04 | TESTLOG summary | done | agent |
| REG-05 | TESTPLAN 5-7 | done | agent |

## Cycle 5 — PLAN import ([PLAN.md](./PLAN.md))

> Задачи из 30-пунктового плана, не покрытые циклами 1–4. Ссылка `PLAN X.Y` = раздел в PLAN.md.

| ID | Задача | Priority | Status | Owner | Acceptance |
|----|--------|----------|--------|-------|------------|
| P5-1.2 | Запоминать выбранное окно захвата | P1 | pending | agent | Повторный запуск той же игры — без пикера |
| P5-1.3 | ViGEm геймпад E2E (PLAN 1.3) | P1 | pending | agent | Тач-оверлей → SendInput в игре; см. C3-S07 |
| P5-2.1 | NSIS-установщик агента (.exe) | P1 | pending | agent | CI собирает .exe; ZIP остаётся fallback |
| P5-2.8 | Авто-подхват квоты агентом | P2 | pending | agent | Тост «найдена квота» перед сессией |
| P5-2.9 | Фильтр квот по железу ПК | P2 | pending | agent | Неподходящие квоты серым + причина |
| P5-2.10 | VDS-игры полкой «Всегда онлайн» | P2 | pending | agent | Отдельная секция в каталоге games |
| P5-3.9 | Частичное финансирование займов | P2 | pending | agent | Прогресс-бар на заявке; 100% → активация |
| P5-3.10 | Проценты по займам + напоминания | P2 | pending | agent | Ежедневные проценты; тост за 24ч до срока |
| P5-1.5 | HUD: живой баланс + минуты до конца (PLAN 1.5) | P1 | pending | agent | Баланс ~15с; жёлтая плашка <2 мин |
| P5-1.8 | Правый стик на мобильном оверлее (PLAN 1.8) | P2 | pending | agent | Два стика в DataChannel |
| P5-2.2 | Вход в агент по 6-значному коду (PLAN 2.2) | P1 | pending | agent | Подключение <30с без копирования токена |
| P5-2.6 | Уведомления о модерации заявок (PLAN 2.6) | P2 | pending | agent | Плашка на дашборде: pending/approved/rejected |
| P5-3.2 | Депозиты → стабильный USD-кредит (PLAN 3.2) | P2 | pending | agent | Курс в записи депозита; баланс не плавает |
| P5-3.3 | Долг в профиле и на бирже (PLAN 3.3) | P2 | pending | agent | Секция «Обязательства»; не в кошельке |

## Cycle 6 — REDESIGN import ([REDESIGN.md](./REDESIGN.md))

| ID | Задача | Priority | Status | Owner | Acceptance |
|----|--------|----------|--------|-------|------------|
| R6-A1 | Общие компоненты: game-card, host-card, empty-state | P2 | pending | agent | Один компонент карточки на landing/games/library |
| R6-A3 | SettingsSheet (шестерёнка → Sheet) | P2 | pending | agent | Переиспользуемый settings-sheet.tsx |
| R6-A4 | Скелетоны вместо fullscreen spinner | P2 | pending | agent | games, hosts, wallet, exchange |
| R6-B1 | Лендинг: убрать UUID/мусор из полки | P1 | pending | agent | Только каталог с обложкой; ≤6 карточек |
| R6-B2 | Каталог: фильтры в Sheet, не сайдбар | P2 | pending | agent | Поиск + сетка; фильтры по кнопке |
| R6-B3 | Русификация жанров (genre-names.ts) | P2 | pending | agent | Нет англ. жанров в UI игрока |
| R6-B5 | Play HUD: ≤5 элементов, остальное в Sheet | P1 | pending | agent | settings-sheet; play.tsx разгрузить |
| R6-B6 | Онбординг первого запуска (3 шага) | P3 | pending | agent | localStorage-флаг; один раз |

## Backlog grooming (каждый 5-й запуск automation)

Счётчик запусков: **`marathon_run_count`** в automation memory (`marathon.md`).

**В начале каждого cron-запуска (до основной задачи):**
1. Прочитать memory → `marathon_run_count` (если нет — `0`) → `+1` → записать обратно.
2. Если `count % 5 == 0` — **grooming-запуск** (ниже). Иначе — обычная первая `pending` задача.
3. Grooming не отменяет основную работу: после добавления задач всё равно взять первую `pending` (если осталось время).

**Grooming-запуск (`count % 5 == 0`):**
1. Просмотреть [PLAN.md](./PLAN.md), [REDESIGN.md](./REDESIGN.md), [HOSTING.md](./HOSTING.md) §10, [TESTLOG.md](./TESTLOG.md) (остаточные пробелы, баги).
2. Добавить **до 5** новых строк со статусом `pending` (уникальные ID: `P5-*`, `R6-*`, `C*-B*`, `H-*`).
3. Не дублировать по смыслу; если уже в main — `done` + запись в TESTLOG.
4. Пометить уже сделанное в ветках — `C4-B01` или сразу `done`.
5. Commit: `docs(marathon): backlog grooming run <count>`.

**Префиксы ID для новых задач:**

| Префикс | Источник |
|---------|----------|
| `P5-X.Y` | PLAN.md фазы 1–3 |
| `R6-*` | REDESIGN.md блоки A–E |
| `C3-S*` / `H-*` | HOSTING.md backlog |
| `C2-B*` / `C4-B*` | Пробелы код ↔ спека ↔ UI |

## Automation prompt

```
Прочитай MARATHON.md. Секция «Backlog grooming»: инкремент marathon_run_count в automation memory.
Если count кратен 5 — grooming (до 5 новых pending из PLAN/REDESIGN/HOSTING/TESTLOG), commit.
Затем возьми первую pending задачу в активном цикле. Выполни acceptance.
pnpm typecheck && pnpm --filter @workspace/api-server test && pnpm --filter @workspace/host-agent test.
Обнови MARATHON.md и TESTLOG.md. Commit и push.
```
