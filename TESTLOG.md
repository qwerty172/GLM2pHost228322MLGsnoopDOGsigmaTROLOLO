# DecentralHub — Журнал тестирования

> Заполняй по мере прохождения [TESTPLAN.md](./TESTPLAN.md).

## Прогресс по фазам

| Фаза | Статус | Примечание |
|---|---|---|
| 0–1 | done | healthz ok, smoke-api зелёный, storage → 503 |
| 2 | in progress | P0 web-фиксы применены, обход страниц на ПК |
| 3 | pending | P2P browser-host |
| 4 | pending | Windows-агент |
| 5 | pending | Экономика, биллинг |
| 6 | pending | Квоты, VDS, embed |
| 7 | pending | Регресс + итог |

## Баги

| # | Где | Симптом | Причина | Фикс | Статус |
|---|-----|---------|---------|------|--------|
| 1 | `lib/integrations-anthropic-ai/src/client.ts` | API падает при старте без Anthropic-ключей | Eager throw при import | Lazy `getAnthropicClient()`, 503 в quotas | fixed |
| 2 | `game-detail.tsx` | 404 на `/api/public/stats` в диалоге «Играть» | Неверный URL | `/api/public/ping` | fixed |
| 3 | `wallet.tsx`, `exchange.tsx`, `profile.tsx`, `site-nav.tsx` | Кошелёк/биржа/история пусты у игрока | Только `hostToken` | `playerWalletToken ?? hostToken` | fixed |
| 4 | `routes/storage.ts` | Storage без Replit → 500 | Generic catch | 503 + русское сообщение | fixed |
| 5 | `depositWorker.ts`, `walletOwner.ts` | Спам error при отсутствии crypto key | Нет guard | `isWalletCryptoEnabled()`, log once | fixed |
| 6 | `rateLimit.ts` | 429 на английском | Hardcoded string | Русское сообщение | fixed |
| 7 | `host/dashboard.tsx` | Карточка квоты пропадает при ошибке API | `if (!info) return null` | Сообщение об ошибке | fixed |

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
