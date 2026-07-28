# Marathon — очередь задач (экономика)

> Hourly cron: берёт **первую** задачу со статусом `pending`, реализует, помечает `done`, обновляет TESTLOG.
> Хостинг: [HOSTING.md](./HOSTING.md) · Админка: `/admin` · `/admin/games` deprecated

## W12 — Platform settings + admin shell

| ID | Задача | Статус |
|---|---|---|
| W12-1 | `platform_settings` в БД + API GET/PATCH `/admin/economy/settings` | done |
| W12-2 | `interestWorker` читает rate из БД (fallback env) | done |
| W12-3 | Регистрация игрока/гостя: лимиты и welcome bonus из settings | done |
| W12-4 | Admin UI `/admin`: таб «Настройки» | done |
| W12-5 | Admin UI: таб «Резервы» | done |

## W13 — API-ключи

| ID | Задача | Статус |
|---|---|---|
| W13-1 | Admin API: list/create/disable dev keys + manual top-up | done |
| W13-2 | Admin UI: таб «API-ключи» | done |

## W14 — Скриптованные выплаты (drip)

| ID | Задача | Статус |
|---|---|---|
| W14-1 | Схема `drip_schedules` + worker | done |
| W14-2 | Admin API/UI: создать drip | done |
| W14-3 | Ledger `drip_payout`, история в wallet | done |

## W15 — Ручные операции

| ID | Задача | Статус |
|---|---|---|
| W15-1 | Admin: manual credit/debit + audit в ledger | done |
| W15-2 | POST marathon-task (webhook / MARATHON.md) | done |

## Backlog

- deposit USD-lock (PLAN 3.2), partial loans (3.9), loan reminders (3.10), Redis rate-limit (3.7)
- удаление `/admin/games`

## Automation prompt

```
Прочитай MARATHON.md → первую pending. Acceptance + pnpm typecheck + pnpm --filter @workspace/api-server test. Обнови MARATHON + TESTLOG.
```
