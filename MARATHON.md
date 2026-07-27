# Marathon — очередь задач

> Hourly cron: берёт **первую** задачу со статусом `pending`, реализует, помечает `done`, обновляет TESTLOG.

## W6 — Block billing & reconnect (2026-07-27)

| ID | Задача | Статус |
|---|---|---|
| W6-1 | `blockMinsRemaining`: wire `enrichSession` в sessions routes + OpenAPI + play.tsx | done |
| W6-2 | Block reconnect idempotency: integration test (два reclaim → одно списание в ledger) | done |
| W6-3 | `renew-block` idempotency audit + тест | done |
| W6-4 | CI: `drizzle push` перед integration-тестами | done |

## W5 — done

Инфра: `.env.example`, worker math tests, agent UX.

## W4 — done

Agent `--bind-code`, setup banner, port discovery.

## W3 — done

InviteCode канон, joinCode deprecated, ws-ticket route.

## W7 — Wallet & billing UX (2026-07-27)

| ID | Задача | Статус |
|---|---|---|
| W7-1 | История кошелька: `block_reserve` → «Блок N мин — Игра» (PLAN 3.5) | done |
| W7-2 | Ledger invariant smoke в CI | done |
| W7-3 | Block end refund integration test | done |
| W7-4 | Block refund idempotency (ledger guard + double-end test) | done |
| W7-5 | Wallet `block_refund` описание с игрой | done |
| W7-6 | Shared integration test harness | done |

## W8 — Economy E2E & фаза 5 TESTPLAN (2026-07-27)

| ID | Задача | Статус |
|---|---|---|
| W8-1 | Economy E2E integration test: deposit → play → block → loan → repay → withdraw (PLAN 3.8) | done |
| W8-2 | Ghost-billing: integration test — нет тиков после session end | done |
| W8-3 | Brute-force токенов: wire `recordFailedAttempt` на wallet/session lookup | done |
| W8-4 | Пере-замер пинга в каталоге каждые 60с (PLAN 1.9) | done |
| W8-5 | Крипто без нод: аудит русских сообщений «временно недоступно» | done |
| W8-6 | `credit-settings` API + toggle в профиле (PLAN 3.4) | done |

## W9 — UX & хост (2026-07-27)

| ID | Задача | Статус |
|---|---|---|
| W9-1 | Уведомление «любимая игра снова онлайн» (PLAN 1.10) | done |
| W9-2 | Валидация обложек ≥300×170 (PLAN 2.7) | done |
| W9-3 | Отзыв ключа агента с дашборда (PLAN 2.3) | done |
| W9-4 | Авто-воркер крипто-выплат (PLAN 3.1) | pending |
