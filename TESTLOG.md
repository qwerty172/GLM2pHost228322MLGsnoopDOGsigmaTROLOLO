# DecentralHub — Журнал тестирования

> Заполняй по мере прохождения [TESTPLAN.md](./TESTPLAN.md).

## Прогресс по фазам

| Фаза | Статус | Примечание |
|---|---|---|
| 0–1 | done | healthz ok, API + Web на :8080 / :5000 |
| 2 | in progress | Обход страниц в браузере |
| 3 | pending | P2P browser-host |
| 4 | pending | Windows-агент |
| 5 | pending | Экономика, биллинг |
| 6 | pending | Квоты, VDS, embed |
| 7 | pending | Регресс + итог |

## Баги

| # | Где | Симптом | Причина | Фикс | Статус |
|---|-----|---------|---------|------|--------|
| 1 | `lib/integrations-anthropic-ai/src/client.ts` | API падает при старте без Anthropic-ключей | Eager throw при import | Lazy `getAnthropicClient()`, 503 в quotas | fixed |

## SQL-проверки

```sql
-- Инвариант леджера (фаза 5)
SELECT account, SUM(amount) FROM ledger GROUP BY account;
```

## Итог (фаза 7)

- **Найдено / починено / отложено:**
- **Работает end-to-end:**
- **Не проверено (Windows / внешние сервисы):**
- **Топ-5 рисков:**
