# DecentralHub — Журнал тестирования

> Заполняй по мере прохождения [TESTPLAN.md](./TESTPLAN.md).

## Прогресс по фазам

| Фаза | Статус | Примечание |
|---|---|---|
| 0–1 | done | healthz ok, smoke-api зелёный, storage → 503 |
| 2 | verified (cloud) | `pages-api-smoke.sh` — API + web shell 200 |
| 3 | verified (cloud API) | signaling + lifecycle + billing; video/input blocked |
| 4 | verified (cloud API) | host-agent test/build/zip, agent-auth, ping :18080; Electron blocked |
| 5 | pending | Экономика, биллинг (расширенный) |
| 6 | pending | Квоты, VDS, embed |
| 7 | pending | Регресс + итог |

## Матрица автономных проверок (cloud)

| Проверка | Статус | Скрипт |
|---|---|---|
| signaling-smoke | verified | `node scripts/signaling-smoke.mjs` |
| session end, no ghost | verified | `./scripts/session-lifecycle.sh` |
| billing tick | verified | `BILLING_SMOKE=1 ./scripts/session-lifecycle.sh` |
| pages API + web shell | verified | `./scripts/pages-api-smoke.sh` |
| host-agent test | verified | `pnpm --filter @workspace/host-agent run test` |
| ping :18080 | verified | `scripts/ping-server-smoke.mjs` (в agent-api-smoke) |
| agent-auth Ed25519 | verified | `scripts/agent-auth-smoke.mjs` |
| host-agent.zip | verified | `./scripts/agent-api-smoke.sh` |
| WebRTC video | **blocked** | нужен браузер + 2 окна |
| getDisplayMedia / desktopCapturer | **blocked** | Windows / браузер |
| SendInput в игре | **blocked** | Windows + Electron |
| Electron tray / dashboard UI | **blocked** | Windows GUI |
| ViGEm gamepad | skipped | known limitation |

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
| 8 | `routes/hosts.ts`, `routes/vds.ts` | streamKey/SSH без crypto key → 500 | Uncaught encrypt | 503 на русском | fixed |
| 9 | `lib/signaling.ts` | WS player 401 на test session после claim | Balance gate для `isTest` | Skip balance check для `isTest` | fixed |
| 10 | `lib/signaling.ts` | Player не видит `peer-joined(host)` если хост подключился первым | Только broadcast новому peer | Отправка `peer-joined` newcomer о существующих peers | fixed |

## SQL-проверки

```sql
-- Ghost sessions после end (фаза 3)
SELECT id, status FROM sessions WHERE status = 'active';

-- Billing events (фаза 3 billing smoke)
SELECT session_id, count(*) FROM billing_events GROUP BY session_id;

-- Инвариант леджера (фаза 5)
SELECT account, SUM(amount) FROM ledger GROUP BY account;
```

## Итог (фаза 7)

- **Найдено / починено / отложено:**
- **Работает end-to-end (cloud):** signaling relay, session lifecycle, billing tick, agent-auth, ping-server, host-agent.zip
- **Не проверено (Windows / браузер):** WebRTC video, SendInput, Electron UI
- **Топ-5 рисков:**
