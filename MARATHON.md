# DecentralHub — Marathon (hourly automation queue)

> Cron-автоматизация берёт **первую задачу со статусом `pending`**, реализует, помечает `done`, обновляет TESTLOG.
> Контекст: `.cursorrules`, `PLAN.md`, `TESTPLAN.md`.

---

## Неделя 6 — Блочный биллинг (точность + идемпотентность)

| ID | Задача | Статус | Критерий готово |
|---|---|---|---|
| W6-1 | `blockMinsRemaining` в API + play HUD | pending | `enrichSession` в routes; F5 показывает реальный остаток |
| W6-2 | Идемпотентность reclaim блочной сессии | pending | `debitBlockReserve` в claim; 2 reclaim → 1 `block_reserve` в ledger |
| W6-3 | Идемпотентность `renew-block` | **done** | `idempotencyKey` в body; ledger `block_renew`; повтор → без двойного списания |
| W6-4 | OpenAPI + codegen для renew-block | pending | `openapi.yaml` → `pnpm --filter @workspace/api-spec run codegen` |
| W6-5 | Интеграционный тест reclaim (Postgres CI) | pending | `DATABASE_URL_TEST` + drizzle push; 2× reclaim в одном тесте |

---

## Недели 1–5 (завершены)

См. [TESTLOG.md](./TESTLOG.md) — marathon W3 dedup, W4 UX, W5 infra.

---

## Как брать задачу

1. Первая строка с `pending` в таблице выше.
2. После фикса: статус → `done`, запись в TESTLOG.
3. `pnpm --filter @workspace/api-server test` + smoke при изменении API.
