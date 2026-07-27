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
