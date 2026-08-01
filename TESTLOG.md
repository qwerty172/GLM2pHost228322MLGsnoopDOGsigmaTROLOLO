# DecentralHub — Журнал тестирования

> Заполняй по мере прохождения [TESTPLAN.md](./TESTPLAN.md).

## Прогресс по фазам

| Фаза | Статус | Примечание |
|---|---|---|
| 0–1 | done | healthz ok, smoke-api зелёный (Windows 2026-07-24) |
| 2 | **verified (Windows browser)** | обход 11 URL + регистрация игрока/хоста |
| 3 | **verified (Windows P2P)** | signaling + lifecycle + billing; browser-host ↔ player P2P |
| 4 | **verified (Windows agent)** | unit/test/build/zip, ping :18080, Electron UI стартует, SendInput injector ready |
| 5 | in progress | Экономика, биллинг (расширенный) |
| 6 | blocked (human) | Квоты, VDS, embed — ручной Windows |
| 7 | agent done | Регресс CI + MARATHON backlog |
| **marathon** | **2026-07-27** | 4-cycle audit: SSE auth, save-sync, RU/a11y, CI hardening — см. MARATHON.md |

## Матрица проверок (Windows 2026-07-24)

| Проверка | Статус | Скрипт / как |
|---|---|---|
| signaling-smoke | verified | `node scripts/signaling-smoke.mjs` |
| session end, no ghost | verified | `./scripts/session-lifecycle.sh` (+ `scripts/sql-query.mjs`) |
| billing tick | verified | `BILLING_SMOKE=1 ./scripts/session-lifecycle.sh` (heartbeats) |
| pages walkthrough | verified | browser MCP :5000 |
| host-agent test | verified | `pnpm --filter @workspace/host-agent run test` (10/10) |
| ping :18080 | verified | `scripts/ping-server-smoke.mjs` / agent-api-smoke |
| agent-auth Ed25519 | verified | `scripts/agent-auth-smoke.mjs` |
| host-agent.zip | verified | `./scripts/agent-api-smoke.sh` |
| WebRTC P2P connect | verified | 2 вкладки browser-host + player → ПОДКЛЮЧЕНО / P2P |
| browser-host heartbeat | fixed | сессии больше не мрут через ~60с |
| Electron UI start | verified | `pnpm --filter @workspace/host-agent run dev` |
| SendInput injector init | verified | лог `Input injector ready` |
| Steam scan → full game E2E | **manual** | нужен Steam + реальная игра |
| ViGEm gamepad | skipped | known limitation |
| **invite links** (`/play/i/:code`, by-invite API) | **verified** | `node scripts/features-smoke.mjs` + browser `/play/i/…` → redirect |
| **session rating** (POST rate, host rating_avg) | **verified** | `node scripts/features-smoke.mjs` |
| **guest upgrade** (API + UI баннер) | **verified** | smoke: баланс 777+123 сохранён; browser: «BrowserGuest», баннер исчез |
| **browser-host WS reconnect** | **verified** | CDP offline 4с на host tab → CONNECTING, сессия не ended |
| **play dock UX** (без z-[100] overlay) | **verified** | DOM: inset-0 fixed = 0, z-[100] = 0 на `/play` |
| **stream-relay API** | **verified** | PATCH config + GET decrypt streamKey |
| **post-merge typecheck** | **verified** | `pnpm typecheck` — api-server, web, host-agent |
| **post-merge CI** | **verified** | `.github/workflows/ci.yml` (typecheck + tests + builds) |
| **invite-flow smoke script** | **added** | `pnpm smoke:invite` |
| **marathon W3 dedup** | **done** | inviteCode канон, joinCode deprecated, OpenAPI+hooks, ws-ticket route |
| **marathon W4 UX** | **done** | agent --bind-code, setup advanced banner, agent port discovery |
| **marathon W5 infra** | **done** | .env.example Redis/JWT/Sentry/migrations docs, worker math tests |

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
| 11 | `lib/db/drizzle.config.ts` | `drizzle-kit push` не видит schema на Windows | Absolute path через `path.join(__dirname)` | Relative `./src/schema/index.ts` | fixed |
| 12 | `browser-play.tsx` | Browser-host сессия умирает ~60с (`host_offline`) | Нет heartbeat, health worker режет | Heartbeat каждые 15с | fixed |
| 13 | `scripts/session-lifecycle.sh` | Billing smoke = 0 events на Windows | Health worker vs sleep 70с; `psql` URI ломается | `sql-query.mjs` + heartbeats в smoke | fixed |
| 14 | `scripts/agent-api-smoke.sh` | Node не читает `/tmp/...` на Windows | Git Bash `/tmp` ≠ Windows path | `.tmp-agent-smoke-body.json` в root | fixed |

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

- **Найдено / починено / отложено:** #11–14 fixed на Windows; Steam full E2E и ViGEm отложены
- **Работает end-to-end (Windows):** pages UI, signaling, session lifecycle, billing tick, browser-host P2P, agent ping/auth/zip, Electron start + SendInput init
- **Осталось вручную:** полный цикл Steam → сессия → SendInput в реальной игре; kill Electron → disconnect ≤30с на живом стриме
- **Топ рисков:** Electron `EADDRINUSE` если уже крутится ping-server; video frames в headless/automation иногда 0×0 (в UI HUD P2P ок)

## Marathon 4-cycle audit (2026-07-27) {#marathon-c1}

| Область | Фикс |
|---|---|
| API SSE | `/events/stream` требует host token + rate limit 30/min |
| API auth | `hostToken` query для EventSource; timingSafe unified |
| API limits | enrich + loans read limiters |
| Web | RU WebRTC labels, play a11y, landing codegen, mobile nav `/hosts`, skip-link |
| Agent | save-sync zip traversal fix; pushSave не удаляет локально; focus-guard cache |
| CI | ledger-invariant + smoke:invite steps |
| Backlog | [MARATHON.md](./MARATHON.md) — pending: OpenAPI gaps, central auth middleware, Windows E2E |

## Marathon C1-S06 — Storage ACL (2026-08-01) {#marathon-c1-s06}

| Изменение | Детали |
|---|---|
| `GET /storage/objects/*` | Объекты без ACL metadata больше не отдаются публично (401/403) |
| `POST /saves/confirm` | После upload выставляется private ACL `player:{id}` |
| `POST /players/me/saves/:gameId/commit` | Аналогично private ACL на commit |
| Тесты | `objectAcl.test.ts` — deny без metadata, public/private owner |
