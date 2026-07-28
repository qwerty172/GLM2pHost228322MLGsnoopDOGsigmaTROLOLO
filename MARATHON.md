# DecentralHub Marathon — живой бэклог

> **Активный цикл:** Wave Ship (до стабильного локального запуска)  
> **Automation:** Cursor Automation `DecentralHub Marathon — следующий цикл` (cron пн/чт 09:00)  
> **Хостинг / окна / тесты:** [HOSTING.md](./HOSTING.md)  
> **Локальный запуск:** [LOCAL_SETUP.md](./LOCAL_SETUP.md)  
> **План фич:** [PLAN.md](./PLAN.md) · **Тест-план:** [TESTPLAN.md](./TESTPLAN.md)  
> **Админка:** `/admin` (экономика) · `/admin/games` deprecated  
> **Ветка разработки:** `cursor/marathon-markdown-file-bfc8` · PR #34  
> **Последнее обновление:** 2026-07-28

## Как пользоваться

1. Берёт **первую** задачу со статусом `pending` (owner `agent` — automation; `human` — вручную).
2. `in_progress` → acceptance → `done` или `blocked`.
3. Находки в [TESTLOG.md](./TESTLOG.md).
4. Верификация: `pnpm typecheck`, `pnpm --filter @workspace/api-server test`, `pnpm --filter @workspace/host-agent test`, `pnpm smoke:invite`.

**Статусы:** `pending` | `in_progress` | `done` | `blocked`  
**Owner:** `agent` | `human`

---

## Wave Ship — до работоспособного состояния

> Критический путь: мерж → env → миграции → админ → P2P → Windows-агент.

| ID | Задача | Priority | Status | Owner | Acceptance |
|----|--------|----------|--------|-------|------------|
| SHIP-01 | Смержить PR #34 в `main` | P0 | pending | human | `main` содержит W12–W15, storage ACL, tier pricing |
| SHIP-02 | LOCAL_SETUP: env checklist + bootstrap админа | P0 | done | agent | LOCAL_SETUP § env + bootstrap |
| SHIP-03 | setup-local: миграция `0004_economy_admin` | P0 | done | agent | setup-local.bat/sh + push |
| SHIP-04 | `pnpm typecheck` зелёный (auth-verifier) | P0 | done | agent | auth-verifier paramString |
| SHIP-05 | OpenAPI: admin submissions approve/reject | P1 | pending | agent | endpoints в openapi.yaml + codegen |
| SHIP-06 | `/admin` + `/embed` на React Query hooks | P1 | pending | agent | C2-S02 done; raw fetch убран |
| SHIP-07 | TURN/coturn: док + smoke ice-config | P1 | pending | agent | HOSTING/LOCAL_SETUP + curl ice-config |
| SHIP-08 | CI: typecheck в workflow не skip auth-verifier | P2 | pending | agent | `.github/workflows/ci.yml` |
| SHIP-09 | Скрипт `scripts/bootstrap-admin.mjs` | P2 | done | agent | node scripts/bootstrap-admin.mjs |
| SHIP-10 | README: checkout `main` после мержа, не prep-9755 | P2 | pending | agent | README + TESTPLAN ветки |

## Windows manual (human)

| ID | Задача | Priority | Status | Owner | Acceptance |
|----|--------|----------|--------|-------|------------|
| WIN-01 | Steam → сессия → SendInput в реальной игре | P0 | blocked | human | TESTPLAN фаза 4 |
| WIN-02 | Kill Electron → disconnect ≤30с | P1 | blocked | human | TESTLOG |
| WIN-03 | Квоты `/quotas/new` без AI | P1 | blocked | human | TESTPLAN фаза 6 |
| WIN-04 | VDS SSH ошибки + minSpecs | P1 | blocked | human | TESTPLAN фаза 6 |
| WIN-05 | `/embed` + devKeys E2E | P1 | blocked | human | TESTPLAN фаза 6 |
| WIN-06 | P2P re-check после мержа | P1 | pending | human | 2 вкладки, HUD ПОДКЛЮЧЕНО |
| WIN-07 | `/admin` smoke: settings + drip + adjustment | P1 | pending | human | ADMIN_SECRET + is_admin |

---

## Cycle 1 — API Server

| ID | Задача | Priority | Status | Owner | Acceptance |
|----|--------|----------|--------|-------|------------|
| C1-S01 | Инвентаризация auth (URL/query vs headers) | P0 | done | agent | Таблица в TESTLOG #marathon-c1 |
| C1-S02 | SSE `/events/stream` auth + rate limit | P0 | done | agent | 401 без токена; limiter 30/min |
| C1-S03 | Объединить timingSafe модули | P1 | done | agent | Один timingSafe.ts |
| C1-S04 | Workers audit | P1 | done | agent | TESTLOG |
| C1-S05 | Signaling WS auth audit | P0 | done | agent | ws-ticket documented |
| C1-S06 | Storage ACL legacy public read | P1 | done | agent | uploads/* legacy public; saves private ACL |
| C1-S07 | Rate limits enrich + loans read | P2 | done | agent | enrichLimiter + readLimiter |
| C1-S08 | joinCodes deprecation | P2 | done | agent | Deprecation header |
| C1-D01 | Smoke + ledger | P0 | done | agent | CI |
| C1-D02 | Economy E2E | P1 | done | agent | vitest |
| C1-D03 | Security pass | P1 | done | agent | SSE closed |
| C1-F01 | timingSafe merge | P0 | done | agent | timingSafeEqual.ts removed |
| C1-F02 | SSE auth | P0 | done | agent | events.ts |
| C1-F03 | Vitest unify | P1 | done | agent | __tests__ in vitest |
| C1-F04 | Routes smoke | P1 | done | agent | routes.smoke.test.ts |
| C1-F05 | Central auth middleware | P2 | pending | agent | Единый requireHost/requirePlayer |

## Cycle 2 — Web UI

| ID | Задача | Priority | Status | Owner |
|----|--------|----------|--------|-------|
| C2-S01 | Raw fetch audit | P1 | done | agent |
| C2-S02 | embed/admin codegen | P1 | pending | agent | = SHIP-06 |
| C2-S03 | landing hosts dup | P2 | done | agent |
| C2-S04 | RU browser-play | P1 | done | agent |
| C2-S05 | a11y player | P1 | done | agent |
| C2-S06 | /wallet route | P2 | pending | agent |
| C2-S07 | shadcn sr-only RU | P3 | pending | agent |
| C2-S08 | nav Играть | P2 | done | agent |
| C2-D01 | pages-api-smoke | P1 | done | agent |
| C2-D02 | OpenAPI gaps | P1 | pending | agent | = SHIP-05 + parity |
| C2-D03 | invite flow | P1 | done | agent |
| C2-F01 | browser-play RU | P1 | done | agent |
| C2-F02 | play a11y | P1 | done | agent |
| C2-F03 | landing codegen | P2 | done | agent |
| C2-F04 | skip-link | P2 | done | agent |

## Cycle 3 — Host Agent

| ID | Задача | Priority | Status | Owner |
|----|--------|----------|--------|-------|
| C3-S01 | save zip traversal | P0 | done | agent |
| C3-S02 | pushSave confirm | P0 | done | agent |
| C3-S03 | focus-guard | P1 | done | agent |
| C3-S04 | captureMode native | P1 | done | agent |
| C3-S05 | limited-user launch | P2 | pending | agent |
| C3-S06 | RTMP drift | P2 | pending | agent |
| C3-S07 | ViGEm packaging | P2 | pending | agent | PLAN 1.3 |
| C3-S08 | renderer split | P3 | pending | agent |
| C3-D01 | unit tests | P1 | done | agent |
| C3-D02 | agent-api-smoke | P1 | done | agent |
| C3-D03 | Windows E2E | P0 | blocked | human | = WIN-01 |
| C3-F01 | save-sync | P0 | done | agent |
| C3-F02 | focus-guard fix | P1 | done | agent |
| C3-F03 | captureMode | P1 | done | agent |

## Cycle 4 — Cross-cutting

| ID | Задача | Status | Owner |
|----|--------|--------|-------|
| C4-S01 | schema drift | done | agent |
| C4-S02 | OpenAPI parity | pending | agent |
| C4-S03 | CI gaps | done | agent |
| C4-S04 | scripts parity | done | agent |
| C4-S05 | .env.example | done | agent |
| C4-S06 | TESTPLAN phase 6 | blocked | human | WIN-03–05 |
| C4-S07 | api-client typecheck | pending | agent |
| C4-S08 | dist hygiene | done | agent |
| C4-D01 | full regression | done | agent |
| C4-D02 | quotas/vds/embed | blocked | human |
| C4-D03 | CI hardening | done | agent |

## Wave UX

| ID | Task | Status | Notes |
|----|------|--------|-------|
| UX-01 | setup bind docs | done | |
| UX-02 | dashboard agent troubleshoot | pending | частично в других PR (#29–32) |
| UX-03 | TURN/STUN hints RU | pending | PR #33, не в bfc8 |
| UX-04 | wallet labels | done | |
| UX-05 | quotas validation | pending | |
| UX-06 | API errors RU | pending | |
| UX-07 | spinner RU | done | |
| UX-08 | skip-link | done | |

## Wave Regression

| ID | Task | Status | Owner |
|----|------|--------|-------|
| REG-01 | typecheck + build | done | agent |
| REG-02 | smokes | done | agent |
| REG-03 | Windows manual | blocked | human |
| REG-04 | TESTLOG summary | done | agent |
| REG-05 | TESTPLAN 5-7 | done | agent |

## W9–W11 — Host & economy sprints (done, в ветке bfc8)

| ID | Задача | PLAN | Статус |
|----|--------|------|--------|
| W9-1 | Уведомление «игра снова онлайн» | 1.10 | done |
| W9-2 | Валидация обложек ≥300×170 | 2.7 | done |
| W9-3 | Отзыв ключа агента с дашборда | 2.3 | done |
| W9-4 | Авто-воркер крипто-выплат | 3.1 | done |
| W10-1 | Активные сессии в библиотеке хоста | 2.4 | done |
| W11-1 | Цены по тирам bronze/silver/gold | 2.5 | done |

## W12–W15 — Admin economy (merged 2026-07-28)

| ID | Задача | Статус |
|----|--------|--------|
| W12-1 | `platform_settings` + API `/admin/economy/settings` | done |
| W12-2 | `interestWorker` читает rate из БД | done |
| W12-3 | Welcome bonus / лимиты из settings | done |
| W12-4 | Admin UI `/admin`: «Настройки» | done |
| W12-5 | Admin UI: таб «Резервы» | done |
| W13-1 | Admin API dev keys + top-up | done |
| W13-2 | Admin UI: «API-ключи» | done |
| W14-1 | `drip_schedules` + dripWorker | done |
| W14-2 | Admin API/UI drips | done |
| W14-3 | Ledger `drip_payout`, wallet history | done |
| W15-1 | Manual credit/debit + ledger audit | done |
| W15-2 | POST marathon-task webhook | done |

## Economy backlog (PLAN фаза 3)

| ID | Задача | Priority | Status | Owner | PLAN |
|----|--------|----------|--------|-------|------|
| ECO-01 | deposit USD-lock | P1 | pending | agent | 3.2 |
| ECO-02 | Долг в профиле и на бирже | P1 | pending | agent | 3.3 |
| ECO-03 | «Играй в кредит» по умолчанию | P1 | pending | agent | 3.4 |
| ECO-04 | История блочных списаний в кошельке | P2 | pending | agent | 3.5 |
| ECO-05 | Bruteforce токенов (расширить) | P2 | pending | agent | 3.6 |
| ECO-06 | Redis/shared rate-limit | P2 | pending | agent | 3.7 |
| ECO-07 | E2E экономика full scenario | P2 | pending | agent | 3.8 |
| ECO-08 | Partial loans на бирже | P2 | pending | agent | 3.9 |
| ECO-09 | Loan reminders + accrued interest UI | P2 | pending | agent | 3.10 |
| ECO-10 | Удалить `/admin/games`, заявки в `/admin` | P2 | pending | agent | |

## PLAN Phase 1 — gameplay (остаток)

| ID | Задача | Priority | Status | Owner | PLAN |
|----|--------|----------|--------|-------|------|
| PLAN-1.1 | E2E ввод мышь/клавиатура в игре | P0 | blocked | human | 1.1 |
| PLAN-1.2 | Запоминать окно захвата | P2 | pending | agent | 1.2 |
| PLAN-1.3 | ViGEm геймпад | P2 | pending | agent | 1.3 = C3-S07 |
| PLAN-1.5 | HUD баланс + минуты до нуля | P1 | pending | agent | 1.5 |
| PLAN-1.6 | Block timer после F5 | P1 | pending | agent | 1.6 |
| PLAN-1.7 | Reconnect block idempotency | P1 | pending | agent | 1.7 |
| PLAN-1.8 | Правый стик тач-оверлея | P2 | pending | agent | 1.8 |

## PLAN Phase 2 — host (остаток)

| ID | Задача | Priority | Status | Owner | PLAN |
|----|--------|----------|--------|-------|------|
| PLAN-2.1 | NSIS установщик агента + CI | P1 | pending | agent | 2.1 |
| PLAN-2.2 | Вход в агент по bind-code (доделать) | P1 | pending | agent | 2.2 |
| PLAN-2.6 | Тосты заработка хоста | P2 | pending | agent | 2.6 |
| PLAN-2.7 | Валидация обложек | P2 | done | agent | W9-2 |
| PLAN-2.8 | Steam scan → библиотека | P2 | pending | agent | 2.8 |
| PLAN-2.9 | RTMP relay настройка в UI | P2 | pending | agent | 2.9 |
| PLAN-2.10 | VDS-игры полка «Всегда онлайн» | P2 | pending | agent | 2.10 |

## Отложено (не в очереди)

| Задача | Почему |
|--------|--------|
| Микрофон игрок→хост | после ядра |
| Клипы с аудио | полировка |
| Центр уведомлений | тосты |
| Авто-обновление агента | после 2.1 |
| Пагинация истории кошелька >100 | техдолг |

## Automation prompt

```
Прочитай MARATHON.md. Возьми первую pending с owner=agent (или первую pending если human недоступен). Выполни acceptance. pnpm typecheck && pnpm --filter @workspace/api-server test && pnpm --filter @workspace/host-agent test. Обнови MARATHON.md и TESTLOG.md.
```
