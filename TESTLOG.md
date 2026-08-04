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

## Marathon M-40 (2026-08-04 12:28 UTC) {#marathon-m-40}

| Проверка | Результат |
|---|---|
| game-detail.tsx | 6 raw fetch → `useSteamLookup`, `useListPublicGameHosts`, `useBrowserPingMs` (shared hook), `createPreviewSession`, `getPublicIceConfig`, `publicPing` |
| typecheck | PASS (`@workspace/web`) |
| marathon-scan | game-detail.tsx больше не в raw hits F |

**Следующий pick:** M-41 `web: raw fetch → codegen (3 calls)` — embed.tsx.

## Marathon M-39 (2026-08-04 11:44 UTC) {#marathon-m-39}

| Проверка | Результат |
|---|---|
| games.tsx | raw fetch VDS → `useListGames({ vdsOnly: true, liveOnly: true })` |
| typecheck | PASS (monorepo) |
| marathon-scan | games.tsx больше не в raw hits F |

**Следующий pick:** M-40 `web: raw fetch → codegen (6 calls)` — game-detail.tsx.

## Marathon M-38 (2026-08-04 10:58 UTC) {#marathon-m-38}

| Проверка | Результат |
|---|---|
| browser-play.tsx | raw fetch ice-config → `getPublicIceConfig` (санитизация ICE URIs сохранена) |
| typecheck | PASS (monorepo) |
| marathon-scan | browser-play.tsx больше не в raw hits F |

**Следующий pick:** M-39 `web: raw fetch → codegen (1 call)` — games.tsx.

## Marathon M-37 (2026-08-04 10:36 UTC) {#marathon-m-37}

| Проверка | Результат |
|---|---|
| library.tsx | apiFetch удалён; `rawgSearch`, `steamLookup`, `useSubmitGame`, `usePatchSubmissionPendingConfig` |
| typecheck | PASS (monorepo) |
| marathon-scan | library.tsx больше не в raw hits F |

**Следующий pick:** M-38 `web: raw fetch → codegen (1 call)` — browser-play.tsx.

## Marathon M-36 (2026-08-04 08:32 UTC) {#marathon-m-36}

| Проверка | Результат |
|---|---|
| play.tsx | 6 raw fetch → `uploadStorageClip`, `issueWsTicket`, `getPublicIceConfig`, `renewSessionBlock`, `rateSession` + `putBlobToUrl` (внешний S3) |
| typecheck | PASS (monorepo) |
| marathon-scan | play.tsx больше не в raw hits F |

**Следующий pick:** M-39 `web: raw fetch → codegen (1 call)` — games.tsx.

## Marathon M-35 (2026-08-04 08:18 UTC) {#marathon-m-35}

| Проверка | Результат |
|---|---|
| profile.tsx | 2 raw fetch → `useListMyVds`, `useUpdatePlayerCreditSettings` |
| OpenAPI | PATCH `/players/me/credit-settings` + api-server route |
| typecheck | PASS (monorepo) |
| marathon-scan | profile.tsx больше не в raw hits F |

**Следующий pick:** M-36 `web: raw fetch → codegen (6 calls)` — play.tsx.

## Marathon M-34 (2026-08-04 08:00 UTC) {#marathon-m-34}

| Проверка | Результат |
|---|---|
| quota-new.tsx | 3 raw fetch → `useTestQuotaVdsConnection`, `useSaveQuotaVds`, `useAiSuggestQuotaSpecs` |
| typecheck | PASS (@workspace/web) |
| marathon-scan | quota-new.tsx больше не в raw hits F |

**Следующий pick:** M-35 `web: raw fetch → codegen (2 calls)` — profile.tsx.

## Marathon M-47 (2026-08-04 07:00 UTC) {#marathon-m-47}

| Проверка | Результат |
|---|---|
| H-08 | `spawn-hwnd.ts` — HWND match по PID после spawn; `findCaptureSourceByHwnds` |
| IPC | `app:get-spawn-hwnds` → renderer `getSpawnHwnds()` |
| unit tests | `window-match.test.mjs` +2, `capture.test.mjs` HWND test — 73 tests PASS |
| typecheck | PASS (@workspace/host-agent) |
| HOSTING | H-08 → fixed |

**Следующий pick:** M-34 `web: raw fetch → codegen (3 calls)`.

## Marathon M-46 (2026-08-04 06:44 UTC) {#marathon-m-46}

| Проверка | Результат |
|---|---|
| H-07 | `resolveTargetExeName` в `window-match.ts`; capture + focus-guard unit tests |
| unit tests | `window-match.test.mjs` +2, `capture.test.mjs` 4, `focus-guard.test.mjs` 7 — 70 tests PASS |
| typecheck | PASS (@workspace/host-agent) |
| HOSTING | H-07 → fixed |

**Следующий pick:** M-34 `web: raw fetch → codegen (3 calls)`.

## Marathon M-45 (2026-08-04 06:18 UTC) {#marathon-m-45}

| Проверка | Результат |
|---|---|
| H-02 | `browserWindowStillOpen` — любой browser title hint = alive |
| unit tests | `window-match.test.mjs` — H-02 Chrome-without-host test PASS |
| typecheck | PASS (@workspace/host-agent) |
| HOSTING | H-02 → fixed |

**Следующий pick:** M-46 `HOSTING H-07` Unit tests capture/focus.

## Marathon M-44 (2026-08-04 06:08 UTC) {#marathon-m-44}

| Проверка | Результат |
|---|---|
| host-agent | `shared/window-match.ts` — title-based capture matching (no HWND/PID) |
| refactor | `capture.ts`, `app-launcher.ts` use shared heuristics |
| unit tests | `window-match.test.mjs` — 9 tests PASS |
| typecheck | PASS (@workspace/host-agent) |
| HOSTING | H-01 → fixed |

**Следующий pick:** M-45 `HOSTING H-02` Browser watch.

## Marathon M-13 (2026-08-03 13:38 UTC) {#marathon-m-13}

| Проверка | Результат |
|---|---|
| unit tests | 18 renderer modules → 19 test files, 49 tests PASS |
| deps | linkedom (DOM stub для renderer-тестов) |
| typecheck | PASS (@workspace/host-agent) |
| marathon-scan | renderer/*.ts больше не в raw hits — Marathon idle |

**Следующий pick:** idle (сканер пуст).

## Marathon M-12 (2026-08-03 13:16 UTC) {#marathon-m-12}

| Проверка | Результат |
|---|---|
| OpenAPI | `POST /vt/scan`, `GET /vt/lookup` + VtScanBody/VtResult schemas |
| codegen | orval → `scanVt`, `lookupVt` |
| typecheck | PASS |
| marathon-scan | vt.ts больше не в raw hits (1/1) |

**Следующий pick:** M-13 `renderer/*.ts` unit-тесты.

## Marathon M-11 (2026-08-03 13:12 UTC) {#marathon-m-11}

| Проверка | Результат |
|---|---|
| OpenAPI | `POST /quotas/vds/test-connection`, `POST/GET/DELETE /quotas/{quotaId}/vds`, `GET /vds/mine` + QuotaVds/VdsSaveBody schemas |
| codegen | orval → `testQuotaVdsConnection`, `saveQuotaVds`, `getQuotaVds`, `deleteQuotaVds`, `listMyVds` |
| typecheck | PASS |
| marathon-scan | vds.ts больше не в raw hits (2/2) |

**Следующий pick:** M-12 `routes/vt.ts`.

## Marathon M-10 (2026-08-03 13:08 UTC) {#marathon-m-10}

| Проверка | Результат |
|---|---|
| OpenAPI | `POST /games/submit`, `PATCH /games/submissions/{id}/pending-config`, `GET /games/submissions/my` + SubmitGameBody/HostGameSubmission schemas |
| codegen | orval → api-client-react + api-zod (`submitGame`, `patchSubmissionPendingConfig`, `listMyGameSubmissions`) |
| typecheck | PASS |
| marathon-scan | submissions.ts больше не в raw hits (3/3) |

**Следующий pick:** M-11 `routes/vds.ts`.

## Marathon M-09 (2026-08-03 13:00 UTC) {#marathon-m-09}

| Проверка | Результат |
|---|---|
| OpenAPI | `GET /storage/public-objects/*filePath`, `GET /storage/objects/*path`, `POST /storage/clip-upload` + PlayerWalletToken + ClipUploadResponse |
| codegen | orval → api-client-react + api-zod (`getStoragePublicObject`, `getStorageObject`, `uploadStorageClip`) |
| typecheck | PASS (api-zod tsconfig +dom для File/Blob) |
| marathon-scan | storage.ts больше не в raw hits (4/4) |
| meta | `MARATHON_AUTOMATION_PROMPT.txt`; groom `--should-run` → `agentInstruction` |

**Следующий pick:** M-10 `routes/submissions.ts`.

## Marathon M-08 (2026-08-03 12:56 UTC) {#marathon-m-08}

| Проверка | Результат |
|---|---|
| OpenAPI | `POST /sessions/{id}/metrics` + SessionMetricSample/PostSessionMetricsBody/Response |
| codegen | orval → api-client-react + api-zod (`postSessionMetrics`) |
| typecheck | PASS |
**Следующий pick:** M-09 `routes/storage.ts`. (2026-08-03 12:48 UTC) {#marathon-m-07}

| Проверка | Результат |
|---|---|
| OpenAPI | `GET /public/games` + PublicGameCatalogItem |
| codegen | orval → api-client-react + api-zod (`listPublicGames`) |
| typecheck | PASS |
| marathon-scan | public.ts больше не в raw hits (6/6) |
| groom | DRAFT PR не блокирует should-run (fix deadlock) |

**Следующий pick:** M-08 `routes/sessions.ts`.

## Marathon M-06 (2026-08-03 12:39 UTC) {#marathon-m-06}

| Проверка | Результат |
|---|---|
| OpenAPI | `POST /premium/purchase` + PremiumPurchaseBody/Response |
| codegen | orval → api-client-react + api-zod |
| typecheck | PASS |
| marathon-scan | premium.ts больше не в raw hits (7/7) |

**Следующий pick:** M-07 `routes/public.ts`.

## Marathon meta (2026-08-03 12:38 UTC) {#marathon-meta-no-recent-run}

**Проблема:** cron каждую минуту, но `recent_run` (45min) пропускал run при 9 pending M-NN.

| Проверка | Результат |
|---|---|
| `marathon-groom.mjs` | убран MIN_RUN_INTERVAL / recent_run — cron не skip по времени |
| should-run skip | только `pr_in_flight` или `in_progress_active` |
| M-05 | OpenAPI POST `/players/claim-guest` + codegen |

**Следующий pick:** M-06 `routes/premium.ts`.

## Marathon M-05 (2026-08-03 12:38 UTC) {#marathon-m-05}

| Проверка | Результат |
|---|---|
| OpenAPI | `POST /players/claim-guest` + ClaimGuestPlayerBody/Response |
| codegen | orval → api-client-react + api-zod |
| marathon-scan | players.ts больше не в raw hits (8/8) |

**Следующий pick:** M-06 `routes/premium.ts`.

## Marathon meta (2026-08-03 12:26 UTC) {#marathon-meta-mark-skipped}

**Проблема:** cron каждую минуту; агенты без `--should-run` дублировали run; skip обновлял Date → 45min таймер никогда не истекал.

| Проверка | Результат |
|---|---|
| `marathon-groom.mjs --mark-skipped` | обновляет только Result, Date Last run сохраняется |
| automation prompt | короткий шаблон с `--should-run --mark-skipped` первым шагом |
| should-run | exit 2 `recent_run`, ageMin=2, next M-05 |

**Следующий pick:** M-05 `routes/players.ts` (после 45min от 12:26 UTC).

## Marathon M-04 (2026-08-03 12:00 UTC) {#marathon-m-04}

**Задача:** OpenAPI gap `routes/hosts.ts` — 8 маршрутов (legacy config/debtors/stream-relay, pc-specs, speedtest, steam-auto-hostable, bulk-publish).

| Проверка | Результат |
|---|---|
| openapi.yaml | 8 paths + schemas (`UpdateHostPcSpecsBody`, `HostDebtorsResponse`, `SteamAutoHostable*`, `BulkPublish*`) |
| codegen | `pnpm --filter @workspace/api-spec run codegen` OK |
| marathon-scan | hosts.ts больше не в raw hits (9/9) |
| typecheck | `@workspace/api-server` + codegen OK |
| meta | groom `--should-run`: `pr_in_flight` + 45min interval (фикс дублей PR #180–182) |

**Следующий pick:** M-05 `routes/players.ts`.

## Marathon M-03 (2026-08-03 11:57 UTC) {#marathon-m-03}

**Задача:** OpenAPI gap `routes/events.ts` — `GET /events/stream` (SSE).

| Проверка | Результат |
|---|---|
| openapi.yaml | path `/events/stream` + schema `PlatformEvent` + tag `events` |
| codegen | `pnpm --filter @workspace/api-spec run codegen` OK |
| marathon-scan | events.ts больше не в raw hits (10/10) |
| typecheck | `pnpm typecheck` OK |

**Следующий pick:** M-04 `routes/hosts.ts`.

## Marathon M-02 (2026-08-03 11:55 UTC) {#marathon-m-02}

**Задача:** OpenAPI gap `routes/enrich.ts` — `GET /games/rawg-search`.

| Проверка | Результат |
|---|---|
| openapi.yaml | path `/games/rawg-search` + schema `RawgSearchResultItem` |
| codegen | `pnpm --filter @workspace/api-spec run codegen` OK |
| marathon-scan | enrich.ts больше не в raw hits (11/11) |
| typecheck | `pnpm typecheck` OK |

**Meta:** `marathon-groom.mjs --should-run` — защита от дублирующих cron-run (<45 мин).

**Следующий pick:** M-03 `routes/events.ts`.

## Marathon M-01 (2026-08-03 11:48 UTC) {#marathon-m-01}

**Задача:** OpenAPI gap `routes/downloads.ts` — `GET /downloads/host-agent.zip`, `GET /downloads/host-agent.exe`.

| Проверка | Результат |
|---|---|
| openapi.yaml | paths + tag `downloads` добавлены |
| codegen | `pnpm --filter @workspace/api-spec run codegen` OK |
| marathon-scan | downloads.ts больше не в raw hits (12/12) |
| typecheck | `pnpm typecheck` OK |

**Следующий pick:** M-02 `routes/enrich.ts`.

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
| Backlog | [MARATHON.md](./MARATHON.md) — pending: C2-S07 sr-only RU, C2-D02 OpenAPI gaps, C1-F05 auth middleware, C3-S05–S08 agent, Windows E2E |

## Marathon C1-S06 — storage ACL (2026-08-02) {#marathon-c1-s06}

| Изменение | Детали |
|---|---|
| GET `/storage/objects/*` | Объекты без ACL metadata → 403, кроме обложек в `games` / `game_submissions` |
| POST `/storage/uploads/confirm` | После presigned PUT выставляет `visibility: public` для cover uploads |
| OpenAPI + codegen | `confirmUpload` в api-client-react / api-zod |
| Тесты | `normalizeStorageObjectPath` unit tests; api-server 29/29, host-agent 12/12 |

## Marathon C2-S02 embed/admin codegen (2026-08-02) {#marathon-c2-s02}

| Компонент | Изменение |
|---|---|
| OpenAPI | `adminListGameSubmissions`, `adminApproveGameSubmission`, `adminRejectGameSubmission` + схемы |
| `embed.tsx` | `createEmbedSession`, `getPublicIceConfig`, `useGetSessionByPlayerToken` — raw fetch убран |
| `admin/games.tsx` | `useAdminListGames`, `useAdminListGameSubmissions`, imperative mutations через codegen |
| Верификация | `pnpm --filter @workspace/web typecheck`; api-server + host-agent tests |

## Marathon C2-S06 /wallet route (2026-08-03) {#marathon-c2-s06}

| Изменение | Детали |
|---|---|
| `/wallet` | Standalone для игроков — без `HostAuthGuard` |
| `/host/wallet` | Кошелёк в панели хоста — внутри `HostLayout` + `HostAuthGuard` |
| `layout.tsx` | Навигация хоста ведёт на `/host/wallet` |
| `site-nav.tsx` | `isHostActive` учитывает `/host/wallet` и `/wallet` |
| `pages-api-smoke.sh` | Добавлен smoke для `/host/wallet` |
| `auth-verifier` | typecheck fix: `req.params.id` → `string` |
| Верификация | `pnpm typecheck`; api-server 29/29, host-agent 12/12 |

## Marathon grooming — audit pending (2026-08-03) {#marathon-grooming-2026-08-03}

Аудит MARATHON.md vs `main`: сверка кода, git log, HOSTING.md.

| ID | Было | Стало | Причина |
|---|---|---|---|
| C4-S07 | pending | **done** | `lib/api-client-react` в root tsconfig; `pnpm typecheck` зелёный в CI |
| UX-02 | pending | **done** | `dashboard.tsx`: `AgentTroubleshootChecklist`, `AgentEventsCard`, agent telemetry |
| C2-S07 | pending | **done** | sr-only RU в shadcn UI (#94, merge-backlog) |
| C2-D02 | pending | **done** | OpenAPI P1 + codegen migration (#102) |
| C1-F05 | pending | **done** | `lib/authMiddleware.ts` + route wiring (#145) |
| C3-S05 | pending | **done** | `await tryLimitedLaunch` в `launchApp` (#130) |
| C3-S06 | pending | **done** | RTMP sync/restart (#130) |
| C3-S07 | pending | **done** | `ViGEmClient.dll` в electron-builder (#130) |
| C3-S08 | pending | **done** | renderer → 18 modules (#131) |
| C4-S02 | pending | **done** | admin/auth/agent/dev routes в openapi.yaml + codegen |
| UX-03 | pending | **done** | `connection-labels.ts` (#83) |
| UX-05 | pending | **done** | `quota-compatibility.ts` (#83) |
| UX-06 | pending | **done** | `api-errors.ts` (#80) |

## Marathon merge-backlog (2026-08-03) {#marathon-merge-backlog}

Смержено из ~100 unmerged веток в `main` (cherry-pick canonical PRs):

| ID | PR | Что |
|---|---|---|
| C1-F05 | #145 | `lib/authMiddleware.ts`, route wiring |
| C3-S05–S07 | #130 | limited-user launch, RTMP sync, ViGEm packaging |
| C3-S08 | #131 | renderer → 18 modules |
| C2-S07 | #94 | sr-only RU в shadcn UI |
| C2-D02 | #102 | OpenAPI P1 + codegen migration |
| UX-03/05 | #83 | connection-labels, quota-compatibility |
| UX-06 | #80 | `lib/api-errors.ts` |

Верификация: `pnpm typecheck` ✅; api-server 7/7; host-agent 12/12; codegen regen.

**Остаётся:** Blocked human: C3-D03, C4-S06/D02, REG-03. Agent backlog — Marathon idle.

## Marathon C4-S02 — OpenAPI parity (2026-08-03) {#marathon-c4-s02}

Задача: полная OpenAPI parity для admin/auth/agent/dev routes.

| Область | Статус | Детали |
|---|---|---|
| admin | done | 6/6 routes (submissions approve/reject уже в spec) |
| auth | done | +login/refresh/logout (C2-D02), +agent-pairing-code/status/pair |
| agent | done | +POST /agent-telemetry (GET agent-events уже был) |
| dev | done | +POST /dev-keys, PATCH /dev-keys/{apiKey}/rules |

Верификация: `pnpm --filter @workspace/api-spec run codegen`; `pnpm typecheck` ✅; api-server 39/39; host-agent 12/12.

## Marathon reconcile idle (2026-08-03 10:44 UTC) {#marathon-reconcile-idle}

Cron automation: `git pull origin main` → `marathon-reconcile.mjs --apply`.

| Проверка | Результат |
|---|---|
| reconcile evidence | 14/14 PASS (включая C4-S02 auto-check) |
| pending agent tasks | 0 — Marathon idle |
| blocked human | C3-D03, C4-S06/D02, REG-03 |

TESTLOG grooming table синхронизирована с merge-backlog — все agent-задачи зачтены.

## Marathon reconcile idle (2026-08-03 10:53 UTC) {#marathon-reconcile-idle-1053}

Cron automation: `git pull origin main` → `marathon-reconcile.mjs --apply`.

| Проверка | Результат |
|---|---|
| reconcile evidence | 14/14 PASS — статусы уже `done`, flip не требуется |
| pending agent tasks | 0 — Marathon idle |
| blocked human | C3-D03, C4-S06/D02, REG-03 |
| main sync | fast-forward +21 commits (merge-backlog + Wave Maintenance scripts) |

Все agent-задачи cycles 1–4, Wave UX и Wave Regression зачтены в `main`.

## Marathon reconcile idle (2026-08-03 10:56 UTC) {#marathon-reconcile-idle-1056}

Cron automation: `git pull origin main` → `marathon-reconcile.mjs --apply` → `marathon-scan.mjs --next`.

| Проверка | Результат |
|---|---|
| reconcile evidence | 14/14 PASS — flip не требуется |
| marathon-scan | исправлен (vendor games + нормализация путей OpenAPI); legacy idle |
| pending agent tasks | 0 — Marathon idle (legacy) |
| blocked human | C3-D03, C4-S06/D02, REG-03 |

Все изменения зачтены в `main`.

## Marathon M-NN queue sync (2026-08-03 11:00 UTC) {#marathon-mnn-sync-1100}

Ручной run: группировка сканера + seed таблицы Wave Maintenance.

| Метрика | Было | Стало |
|---|---|---|
| raw hits сканера | 144 (ложные: vendor games, /api prefix) → 51 | 13 grouped |
| pending M-NN в MARATHON | 0 (только placeholder) | **13** (M-01…M-13) |
| legacy agent pending | 0 | 0 (idle) |

**Группировка:** C OpenAPI — по route-файлу (29 routes → 12 задач); E renderer — 18 модулей → 1 задача.
**Следующий pick:** M-01 `routes/downloads.ts` (2 OpenAPI routes).

Команды: `marathon-scan.mjs --sync-marathon`, `--next` читает очередь из MARATHON.md.

## Marathon meta self-groom (2026-08-03 11:05 UTC) {#marathon-meta-groom-1105}

Добавлен `scripts/marathon-groom.mjs` — automation чинит сам процесс.

| Проверка | Действие (--apply) |
|---|---|
| phantom_pending | skip — задача в таблице, сканер не видит |
| stale_in_progress | reset → pending (>24ч) |
| duplicate_pending | skip дубль по Key |
| done_but_active | reopen → pending или fix scan |
| queue_drift | auto `--sync-marathon` |
| raw_explosion | флаг: улучшить группировку scan |

Workflow run: reconcile → **groom** → sync → next. Лимит: 1 M-NN или 1 meta за run.

## Marathon reconcile idle (2026-08-03 11:05 UTC) {#marathon-reconcile-idle-1105}

Cron automation: `git pull origin main` → `marathon-reconcile.mjs --apply` → `marathon-scan.mjs --sync-marathon`.

| Проверка | Результат |
|---|---|
| reconcile evidence | 14/14 PASS — flip не требуется |
| legacy agent pending | 0 — все cycles 1–4, Wave UX, Wave Regression зачтены |
| Wave Maintenance | 13 M-NN pending (M-01…M-13) — следующий pick M-01 |
| blocked human | C3-D03, C4-S06/D02, REG-03 |

Все изменения зачтены в `main`.

## Marathon reconcile idle (2026-08-03 11:11 UTC) {#marathon-reconcile-idle-1111}

Cron automation: `git pull origin main` → `marathon-reconcile.mjs --apply` → `marathon-groom.mjs --apply` → `marathon-scan.mjs --sync-marathon`.

| Проверка | Результат |
|---|---|
| git pull | main up to date (35682b1) |
| reconcile evidence | 14/14 PASS — flip не требуется |
| groom | 0 issues, 0 auto-fix |
| legacy agent pending | 0 — все cycles 1–4, Wave UX, Wave Regression зачтены |
| Wave Maintenance | 13 M-NN pending (M-01…M-13) — следующий pick M-01 |
| merge conflict | исправлен в MARATHON.md + TESTLOG.md (HEAD vs meta) |
| blocked human | C3-D03, C4-S06/D02, REG-03 |

Все изменения зачтены в `main`. Код не менялся.

## Marathon reconcile idle (2026-08-03 11:17 UTC) {#marathon-reconcile-idle-1117}

Cron automation: `git pull origin main` → `marathon-reconcile.mjs --apply` → `marathon-groom.mjs --apply` → `marathon-scan.mjs --sync-marathon`.

| Проверка | Результат |
|---|---|
| git pull | main up to date (f5a919d) |
| reconcile evidence | 14/14 PASS — flip не требуется |
| groom | 0 issues, 0 auto-fix |
| legacy agent pending | 0 — все cycles 1–4, Wave UX, Wave Regression зачтены |
| Wave Maintenance | 13 M-NN pending (M-01…M-13) — следующий pick M-01 |
| blocked human | C3-D03, C4-S06/D02, REG-03 |

Все изменения зачтены в `main`. Код не менялся.

## Marathon reconcile idle (2026-08-03 11:30 UTC) {#marathon-reconcile-idle-1130}

Cron automation: `git pull origin main` → `marathon-reconcile.mjs --apply` → `marathon-groom.mjs --apply` → `marathon-scan.mjs --sync-marathon`.

| Проверка | Результат |
|---|---|
| git pull | main up to date (449d2e5) |
| reconcile evidence | 14/14 PASS — flip не требуется |
| groom | 0 issues, 0 auto-fix |
| legacy agent pending | 0 — все cycles 1–4, Wave UX, Wave Regression зачтены |
| Wave Maintenance | 13 M-NN pending (M-01…M-13) — следующий pick M-01 |
| blocked human | C3-D03, C4-S06/D02, REG-03 |

Все изменения зачтены в `main`. Код не менялся.
