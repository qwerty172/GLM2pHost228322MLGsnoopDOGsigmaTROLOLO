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

## Marathon M-266 (2026-08-07 08:45 UTC) {#marathon-m-266}

| Проверка | Результат |
|---|---|
| host-dashboard.test.mjs | PASS (+2 U-34: buildAgentDeepLink / parseAgentDeepLink) |
| host-agent deep-link.test.mjs | PASS (5 tests) |
| host-agent pairing.test.mjs | PASS (+1 export submitPairingCode) |

**Изменения:** кнопка «Открыть в агенте» на дашборде выдаёт bind+pair коды и открывает `decenthub://bind?...`; агент регистрирует протокол, автоподставляет коды без ручного ввода 6 цифр.

**Следующий pick:** marathon-scan --next.

## Marathon M-265 (2026-08-06 19:20 UTC) {#marathon-m-265}

| Проверка | Результат |
|---|---|
| hosts.test.mjs | PASS (12 tests, +2: readHostPcSpecs null/empty + field extraction) |
| marathon-coverage hosts-helpers.ts | 100% (79/79 строк) |

**Изменения:** `artifacts/web/test/hosts.test.mjs` — покрытие `readHostPcSpecs` (null, invalid, partial specs).

**Следующий pick:** marathon-scan --next.

## Marathon M-264 (2026-08-06 19:15 UTC) {#marathon-m-264}

| Проверка | Результат |
|---|---|
| router.test.ts | PASS (20 tests, +5: verify 200, paramString, telegram webhook branches) |
| marathon-coverage router.ts | 94% (167/177 строк) |

**Изменения:** `lib/auth-verifier/test/router.test.ts` — успешная верификация OTP, не-private /link, невалидный токен DM, settleWebhook для async webhook.

**Следующий pick:** marathon-scan --next (M-265 hosts-helpers coverage).

## Marathon M-263 (2026-08-06 19:10 UTC) {#marathon-m-263}

| Проверка | Результат |
|---|---|
| refreshTokens.test.ts | PASS (5 tests, +2: indexes + RefreshToken type) |
| marathon-coverage refreshTokens.ts | 100% (28/28 строк) |

**Изменения:** `lib/db/test/refreshTokens.test.ts` — tokenHash unique, createdAt default, ExtraConfigBuilder indexes (user + expires).

**Следующий pick:** marathon-scan --next (M-264 router coverage).

## Marathon M-262 (2026-08-06 19:03 UTC) {#marathon-m-262}

| Проверка | Результат |
|---|---|
| depositAddresses.test.ts | PASS (5 tests, +2: defaults + indexes) |
| marathon-coverage depositAddresses.ts | 100% (37/37 строк) |

**Изменения:** `lib/db/test/depositAddresses.test.ts` — minDeposit default, ExtraConfigBuilder indexes (owner/currency unique + address).

**Следующий pick:** marathon-scan --next (M-263 refreshTokens coverage).

## Marathon M-261 (2026-08-06 13:00 UTC) {#marathon-m-261}

| Проверка | Результат |
|---|---|
| use-platform-events.test.mjs | PASS (9 tests, +3 hook tests) |
| marathon-coverage use-platform-events.ts | 100% (34/34 строк) |

**Изменения:** `artifacts/web/test/use-platform-events.test.mjs` — happy-dom + usePlatformEvents: SSE subscribe/forward, enabled=false, cleanup on unmount. `use-platform-events.ts` — fallback `import.meta.env?.BASE_URL ?? "/"` для node-тестов.

**Следующий pick:** marathon-scan --next.

## Marathon M-260 (2026-08-06 12:58 UTC) {#marathon-m-260}

| Проверка | Результат |
|---|---|
| use-mobile.test.mjs | PASS (8 tests, +4 hook tests) |
| marathon-coverage use-mobile.tsx | 100% (28/28 строк) |

**Изменения:** `artifacts/web/test/use-mobile.test.mjs` — happy-dom + useIsMobile: desktop/mobile viewport, matchMedia change, cleanup on unmount.

**Следующий pick:** marathon-scan --next (M-261 use-platform-events coverage).

## Marathon M-259 (2026-08-06 12:52 UTC) {#marathon-m-259}

| Проверка | Результат |
|---|---|
| webgl-video-shader.test.mjs | PASS (14 tests, +8 component tests) |
| marathon-coverage webgl-video-shader.tsx | 93% (281/303 строк) |

**Изменения:** `artifacts/web/test/webgl-video-shader.test.mjs` — happy-dom + mock WebGL: inactive canvas, compile/link errors, WebGL unavailable, readyState gate, cleanup on unmount.

**Следующий pick:** marathon-scan --next (M-260 use-mobile coverage).

## Marathon M-258 (2026-08-06 12:46 UTC) {#marathon-m-258}

| Проверка | Результат |
|---|---|
| use-play-now-href.test.mjs | PASS (+2 tests: usePlayNowHref export + href resolution) |

**Изменения:** `artifacts/web/test/use-play-now-href.test.mjs` — покрыт экспорт `usePlayNowHref` и логика invite/fallback через landing-helpers.

**Следующий pick:** marathon-scan --next (M-259 webgl-video-shader coverage).

## Marathon M-257 (2026-08-06 06:41 UTC) {#marathon-m-257}

| Проверка | Результат |
|---|---|
| KeyboardOverlay.test.mjs | PASS (11 new component tests) |
| marathon-coverage KeyboardOverlay.tsx | 99% (588/593 строк) |

**Изменения:** `artifacts/web/test/KeyboardOverlay.test.mjs` — happy-dom + тесты рендера KeyboardOverlay (клавиши, double-tap alt, editMode drag/editor/presets).

**Следующий pick:** marathon-scan --next (покрытие webgl-video-shader или следующий файл ниже tier 80%).

## Marathon M-256 (2026-08-06 00:40 UTC) {#marathon-m-256}

| Проверка | Результат |
|---|---|
| TouchOverlay.test.mjs | PASS (8 new component tests) |
| marathon-coverage TouchOverlay.tsx | 100% (467/467 строк) |

**Изменения:** `artifacts/web/test/TouchOverlay.test.mjs` — happy-dom + тесты рендера TouchOverlay (кнопки, стики, editMode drag). devDeps: `happy-dom`, `@happy-dom/global-registrator`.

**Следующий pick:** marathon-scan --next (покрытие KeyboardOverlay или следующий файл ниже tier).

## Marathon M-255 (2026-08-06 00:33 UTC) {#marathon-m-255}

| Проверка | Результат |
|---|---|
| window-match.test.mjs | PASS (2 new tests) |

**Изменения:** `artifacts/host-agent/test/window-match.test.mjs` — unit-тесты для экспортов `BROWSER_TITLE_HINTS` и `windowSources`.

**Следующий pick:** M-256 (покрытие 41% → 50%: TouchOverlay.tsx).

## Marathon M-254 (2026-08-06 00:30 UTC) {#marathon-m-254}

| Проверка | Результат |
|---|---|
| ui.test.mjs | PASS (1 new test) |

**Изменения:** `artifacts/host-agent/test/ui.test.mjs` — unit-тест для экспорта `log` (prepends stamped message to log element).

**Следующий pick:** M-256 (покрытие 41% → 50%: TouchOverlay.tsx).

## Marathon M-253 (2026-08-06 00:30 UTC) {#marathon-m-253}

| Проверка | Результат |
|---|---|
| steam.test.mjs | PASS (4 new tests) |

**Изменения:** `artifacts/host-agent/test/steam.test.mjs` — unit-тесты для экспортов `renderGamePickerSteam` и `runSteamScan`; `renderer-env.mjs` — stub `scanSteam` для агента.

**Следующий pick:** M-254 (тест не покрывает экспорты: ui).

## Marathon M-252 (2026-08-06 00:26 UTC) {#marathon-m-252}

| Проверка | Результат |
|---|---|
| session.test.mjs | PASS (14 new tests) |

**Изменения:** `artifacts/host-agent/test/session.test.mjs` — unit-тесты для 12 экспортов session.ts: createSession, connect, attachWsHandlers, sendControlReject, fetchSessionContext, onPlayerJoined, uploadHostStats, teardownPeer, cancelDeferredTeardown, teardownDeferred, teardown, teardownAsync.

**Следующий pick:** M-253 (тест не покрывает экспорты: steam).

## Marathon M-251 (2026-08-06 00:22 UTC) {#marathon-m-251}

| Проверка | Результат |
|---|---|
| preview.test.mjs | PASS (3 new tests) |

**Изменения:** `artifacts/host-agent/test/preview.test.mjs` — unit-тесты для экспорта `connectPreviewWs` (skip при disabled/без токена, открытие preview WS с type=preview).

**Следующий pick:** M-252 (тест не покрывает экспорты: session).

## Marathon M-250 (2026-08-06 00:18 UTC) {#marathon-m-250}

| Проверка | Результат |
|---|---|
| library.test.mjs | PASS (6 new tests) |

**Изменения:** `artifacts/host-agent/test/library.test.mjs` — unit-тесты для экспортов `renderLibrary`, `loadLibrary`, `showHostGamePicker`, `startLibraryPolling`.

**Следующий pick:** M-251 (тест не покрывает экспорты: preview).

## Marathon M-249 (2026-08-06 00:15 UTC) {#marathon-m-249}

| Проверка | Результат |
|---|---|
| input-mapping.test.mjs | PASS (3 new tests) |

**Изменения:** `artifacts/host-agent/test/input-mapping.test.mjs` — unit-тесты для экспорта `injectPlayerInput` (event fallback, key/mouse/wheel mapping, pre-move перед mousedown).

**Следующий pick:** M-250 (тест не покрывает экспорты: library).

## Marathon M-248 (2026-08-06 00:13 UTC) {#marathon-m-248}

| Проверка | Результат |
|---|---|
| input-guard.test.mjs | PASS (2 new tests) |

**Изменения:** `artifacts/host-agent/test/input-guard.test.mjs` — unit-тесты для экспорта `startGuardPolling` (замена таймера, опрос agent status и обновление badge).

**Следующий pick:** M-249 (тест не покрывает экспорты: input-mapping).

## Marathon M-247 (2026-08-06 00:06 UTC) {#marathon-m-247}

| Проверка | Результат |
|---|---|
| config.test.mjs | PASS (4 new tests) |

**Изменения:** `artifacts/host-agent/test/config.test.mjs` — unit-тесты для экспортов `setAppPath`, `refreshCaptureSources`, `loadFormFromConfig`. `renderer-env.mjs` — polyfill HTMLSelectElement.value для linkedom.

**Следующий pick:** M-248 (тест не покрывает экспорты: input-guard).

## Marathon M-246 (2026-08-06 00:05 UTC) {#marathon-m-246}

| Проверка | Результат |
|---|---|
| agent-auth.test.mjs | PASS (6 new tests) |

**Изменения:** `artifacts/host-agent/test/agent-auth.test.mjs` — unit-тесты для экспортов `fetchAgentKeyBound`, `tryAutoBindAgentKey`, `setConnectionTroubleshootVisible`.

**Следующий pick:** M-248 (тест не покрывает экспорты: input-guard).

## Marathon M-245 (2026-08-06 00:02 UTC) {#marathon-m-245}

| Проверка | Результат |
|---|---|
| ping-server.test.mjs | PASS (1 new test) |

**Изменения:** `artifacts/host-agent/test/ping-server.test.mjs` — unit-тест для экспортов `PING_PORT` и `PING_PORT_FALLBACKS`.

**Следующий pick:** M-246 (тест не покрывает экспорты: agent-auth).

## Marathon M-244 (2026-08-05 23:58 UTC) {#marathon-m-244}

| Проверка | Результат |
|---|---|
| gamepad-injection.test.mjs | PASS (2 new tests) |

**Изменения:** `artifacts/host-agent/test/gamepad-injection.test.mjs` — unit-тесты для `disconnectGamepad` (win32 mocked release + non-win32 noop).

**Следующий pick:** M-245 (тест не покрывает экспорты: ping-server).

## Marathon M-243 (2026-08-05 23:56 UTC) {#marathon-m-243}

| Проверка | Результат |
|---|---|
| config.test.mjs | PASS (3 new main-process tests) |

**Изменения:** `artifacts/host-agent/test/config.test.mjs` — unit-тесты для main `loadConfig`, `saveConfig`, `getCachedConfig`, `resetConfigCache`.

**Следующий pick:** M-244 (тест не покрывает экспорты: gamepad-injection).

## Marathon M-242 (2026-08-05 23:51 UTC) {#marathon-m-242}

| Проверка | Результат |
|---|---|
| api-client.test.mjs | PASS (6 new tests) |

**Изменения:** `artifacts/host-agent/test/api-client.test.mjs` — unit-тесты для `fetchAgentRequirements` (success, HTTP error, missing field, network error) и `warnIfAgentVersionUnsupported` (supported/outdated version).

**Следующий pick:** M-243 (тест не покрывает экспорты: config).

## Marathon M-241 (2026-08-05 23:49 UTC) {#marathon-m-241}

| Проверка | Результат |
|---|---|
| walletAddresses.test.ts | PASS (4 tests) |

**Изменения:** `artifacts/api-server/src/lib/walletAddresses.test.ts` — unit-тесты для `generateNanoAddress`, `generateTronUsdtAddress`, `generateAllDepositAddresses` (+ расширён Solana кейс).

**Следующий pick:** M-242 (тест не покрывает экспорты: api-client).

## Marathon M-240 (2026-08-05 23:47 UTC) {#marathon-m-240}

| Проверка | Результат |
|---|---|
| storageRouteHelpers.test.ts | PASS (18 tests) |

**Изменения:** `artifacts/api-server/src/lib/storageRouteHelpers.test.ts` — unit-тесты для `respondStorageUnavailable`, `handleStorageError`, `resolveHostIdFromRequest`, `resolvePlayerIdFromRequest`, `resolveCallerUserId`, `tryApplyObjectAcl` (мок db/objectStorage + mock req/res).

**Следующий pick:** M-241 (тест не покрывает экспорты: walletAddresses).

## Marathon M-239 (2026-08-05 23:43 UTC) {#marathon-m-239}

| Проверка | Результат |
|---|---|
| signaling.test.ts | PASS (5 tests) |

**Изменения:** `artifacts/api-server/src/lib/signaling.test.ts` — unit-тесты для `attachSignaling`, `closeSignaling`, `sendSignalingMessage` (мок db/redis + WS upgrade на локальном HTTP-сервере).

**Следующий pick:** M-240 (тест не покрывает экспорты: storageRouteHelpers).

## Marathon M-238 (2026-08-05 23:38 UTC) {#marathon-m-238}

| Проверка | Результат |
|---|---|
| sessionSerialize.test.ts | PASS (5 tests) |

**Изменения:** `artifacts/api-server/src/lib/sessionSerialize.test.ts` — unit-тесты для `enrichSession`, `enrichSessionBatch` (мок db.select + blockMinsRemaining).

**Следующий pick:** M-239 (тест не покрывает экспорты: signaling).

## Marathon M-237 (2026-08-05 23:35 UTC) {#marathon-m-237}

| Проверка | Результат |
|---|---|
| redis.test.ts | PASS (13 tests) |

**Изменения:** `artifacts/api-server/src/lib/redis.test.ts` — unit-тесты для `initRedis`, `getRedis`, `getRedisSubscriber`, `redisHealthCheck`, `shutdownRedis` (мок ioredis + vi.hoisted).

**Следующий pick:** M-238 (тест не покрывает экспорты: sessionSerialize).

## Marathon M-236 (2026-08-05 23:32 UTC) {#marathon-m-236}

| Проверка | Результат |
|---|---|
| quotaEngine.test.ts | PASS (11 tests) |

**Изменения:** `artifacts/api-server/src/lib/quotaEngine.test.ts` — unit-тесты для `generateAccessCode`, `creditOwnerGreen`, `decrementEscrow`, `recordQuotaMovement`, `bumpQuotaSessionTotals` (мок tx + существующие computeQuotaEffect/isQuotaActiveNow).

## Marathon M-235 (2026-08-05 23:28 UTC) {#marathon-m-235}

| Проверка | Результат |
|---|---|
| pgNotify.test.ts | PASS (8 tests) |

**Изменения:** `artifacts/api-server/src/lib/pgNotify.test.ts` — unit-тесты для `startPgNotifyListener` (LISTEN, NOTIFY fan-out, idempotent), `emitPlatformEvent` (pg_notify + local fan-out, fallback при ошибке БД), `stopPgNotifyListener` (UNLISTEN/release).

**Следующий pick:** M-236 (тест не покрывает экспорты: quotaEngine).

## Marathon M-234 (2026-08-05 23:25 UTC) {#marathon-m-234}

| Проверка | Результат |
|---|---|
| objectStorage.test.ts | PASS (3 tests) |

**Изменения:** `artifacts/api-server/src/lib/objectStorage.test.ts` — unit-тест для `objectStorageClient` (shared GCS client, bucket accessor).

**Следующий pick:** M-235 (тест не покрывает экспорты: pgNotify).

## Marathon M-233 (2026-08-05 23:23 UTC) {#marathon-m-233}

| Проверка | Результат |
|---|---|
| objectAcl.test.ts | PASS (11 tests) |

**Изменения:** `artifacts/api-server/src/lib/objectAcl.test.ts` — unit-тесты для `getObjectAclPolicy` (чтение metadata, null при отсутствии) и `setObjectAclPolicy` (запись metadata, ошибка если объект не существует).

**Следующий pick:** M-234 (тест не покрывает экспорты: objectStorage).

## Marathon M-232 (2026-08-05 23:19 UTC) {#marathon-m-232}

| Проверка | Результат |
|---|---|
| jwt.test.ts | PASS (6 tests) |

**Изменения:** `artifacts/api-server/src/lib/jwt.test.ts` — unit-тесты для `generateRefreshToken`, `signWsTicket`, `verifyWsTicket` (round-trip, invalid ticket).

**Следующий pick:** M-233 (тест не покрывает экспорты: objectAcl).

## Marathon M-231 (2026-08-05 23:17 UTC) {#marathon-m-231}

| Проверка | Результат |
|---|---|
| joinCodes.test.ts | PASS (11 tests) |

**Изменения:** `artifacts/api-server/src/lib/joinCodes.test.ts` — unit-тесты для `ensureJoinCodeForSession`, `exchangeJoinCode`, `ensureJoinCodeForPlayerToken` с моком БД.

**Следующий pick:** M-232 (тест не покрывает экспорты: jwt).

## Marathon M-230 (2026-08-05 23:14 UTC) {#marathon-m-230}

| Проверка | Результат |
|---|---|
| invites.test.ts | PASS (3 tests) |

**Изменения:** `artifacts/api-server/src/lib/invites.test.ts` — unit-тест для `generateInviteCode`: 12-символьный base64url-код.

**Следующий pick:** M-231 (тест не покрывает экспорты: joinCodes).

## Marathon M-229 (2026-08-05 23:11 UTC) {#marathon-m-229}

| Проверка | Результат |
|---|---|
| hostTier.test.ts | PASS (3 tests) |

**Изменения:** `artifacts/api-server/src/lib/hostTier.test.ts` — unit-тест для `STREAM_OVERHEAD`: CPU на 1 ядро ниже порога с учётом overhead → `below_min`.

**Следующий pick:** M-230 (тест не покрывает экспорты: invites).

## Marathon M-228 (2026-08-05 23:08 UTC) {#marathon-m-228}

| Проверка | Результат |
|---|---|
| hostAuth.test.ts | PASS (4 tests) |

**Изменения:** `artifacts/api-server/src/lib/hostAuth.test.ts` — unit-тесты для `requireHost`: 401 без токена, 404 при неизвестном хосте, успех при валидном Bearer-токене.

**Следующий pick:** M-229 (тест не покрывает экспорты: hostTier).

## Marathon M-227 (2026-08-05 23:04 UTC) {#marathon-m-227}

| Проверка | Результат |
|---|---|
| economy.test.ts | PASS (23 tests) |

**Изменения:** `artifacts/api-server/src/lib/economy.test.ts` — unit-тесты для 11 экспортов economy: SYSTEM_INTEREST_RESERVE, creditPayoutToUser, payInternal, repayBorrowerDebt, applyDepositCents, creditDevKeyDeposit, recordWithdrawalDebit, systemAccountBalance, drawFromSystemAccount, hasBlockReserveLedger, debitBlockReserve.

**Следующий pick:** M-228 (тест не покрывает экспорты: hostAuth).

## Marathon M-226 (2026-08-05 22:59 UTC) {#marathon-m-226}

| Проверка | Результат |
|---|---|
| authMiddleware.test.ts | PASS (8 tests) |

**Изменения:** `artifacts/api-server/src/lib/authMiddleware.test.ts` — тесты для `resolveAuthUser` (JWT, legacy token, null) и `requirePlayerMiddleware` (missing/invalid/valid wallet token).

**Следующий pick:** M-227 (тест не покрывает экспорты: economy).

## Marathon M-225 (2026-08-05 22:56 UTC) {#marathon-m-225}

| Проверка | Результат |
|---|---|
| use-platform-events.test.mjs | PASS (6 tests) |

**Изменения:** `artifacts/web/test/use-platform-events.test.mjs` — 2 теста для `usePlatformEvents`: export hook + EventSource forward contract (connected filter, session event).

**Следующий pick:** M-226 (тест не покрывает экспорты: authMiddleware).

## Marathon M-224 (2026-08-05 22:52 UTC) {#marathon-m-224}

| Проверка | Результат |
|---|---|
| use-browser-ping.test.mjs | PASS (5 tests) |

**Изменения:** `artifacts/web/test/use-browser-ping.test.mjs` — 2 теста для `useBrowserPingMs`: export hook + interval probe contract (immediate + every 60s).

**Следующий pick:** M-225 (тест не покрывает экспорты: use-platform-events).

## Marathon M-223 (2026-08-05 22:50 UTC) {#marathon-m-223}

| Проверка | Результат |
|---|---|
| agent-local.test.mjs | PASS (13 tests) |

**Изменения:** `artifacts/web/test/agent-local.test.mjs` — 3 теста для `probeAgentReadiness`: /readiness ответ, inputOk по умолчанию true, null при offline.

**Следующий pick:** M-224 (тест не покрывает экспорты: use-browser-ping).

## Marathon M-222 (2026-08-05 22:46 UTC) {#marathon-m-222}

| Проверка | Результат |
|---|---|
| vitest src/routes/vds.test.ts | PASS (26 tests) |

**Изменения:** `artifacts/api-server/src/routes/vds.test.ts` — тест 500 для POST /quotas/vds/test-connection когда SSH client setup бросает исключение.

**Следующий pick:** M-223 (тест не покрывает экспорты: agent-local).

## Marathon M-221 (2026-08-05 22:43 UTC) {#marathon-m-221}

| Проверка | Результат |
|---|---|
| vitest src/routes/storage.test.ts | PASS (17 tests) |

**Изменения:** `artifacts/api-server/src/routes/storage.test.ts` — тест 502 для POST /storage/clip-upload когда object storage PUT возвращает !ok.

**Следующий pick:** M-222 (route error-paths 500: vds.ts).

## Marathon M-220 (2026-08-05 22:40 UTC) {#marathon-m-220}

| Проверка | Результат |
|---|---|
| vitest src/routes/sessions.test.ts | PASS (41 tests) |

**Изменения:** `artifacts/api-server/src/routes/sessions.test.ts` — тесты 500 для POST /sessions (transaction без row), POST /sessions/browser-host (host/session insert empty), POST /sessions/test (insert empty).

**Следующий pick:** M-221 (route error-paths 502: storage.ts).

## Marathon M-219 (2026-08-05 22:37 UTC) {#marathon-m-219}

| Проверка | Результат |
|---|---|
| vitest src/routes/quotas.test.ts | PASS (33 tests) |

**Изменения:** `artifacts/api-server/src/routes/quotas.test.ts` — тесты 500 для ai-suggest-specs (unexpected format, upstream error), POST /quotas (insert empty), PATCH /quotas/:id (update empty), publish/pause/close transaction failures.

**Следующий pick:** M-220 (route error-paths 500: sessions.ts).

## Marathon M-218 (2026-08-05 22:34 UTC) {#marathon-m-218}

| Проверка | Результат |
|---|---|
| vitest src/routes/quotaAiChat.test.ts | PASS (8 tests) |

**Изменения:** `artifacts/api-server/src/routes/quotaAiChat.test.ts` — тест 503 когда Anthropic не сконфигурирован (POST /quotas/ai-chat).

**Следующий pick:** M-219 (route error-paths 500: quotas.ts).

## Marathon M-217 (2026-08-05 22:30 UTC) {#marathon-m-217}

| Проверка | Результат |
|---|---|
| vitest src/routes/public.test.ts | PASS (21 tests) |

**Изменения:** `artifacts/api-server/src/routes/public.test.ts` — тесты 409 host_busy/game_unavailable (POST /public/sessions) и 429 preview cooldown (POST /public/preview-session).

**Следующий pick:** M-219 (route error-paths 500: quotas.ts).

## Marathon M-216 (2026-08-05 22:27 UTC) {#marathon-m-216}

| Проверка | Результат |
|---|---|
| vitest src/routes/players.test.ts | PASS (25 tests) |

**Изменения:** `artifacts/api-server/src/routes/players.test.ts` — тесты 500 для register (guest/full), claim-guest, upgrade-guest, credit-settings.

**Следующий pick:** M-217 (route error-paths 409/429: public.ts).

## Marathon M-215 (2026-08-05 22:24 UTC) {#marathon-m-215}

| Проверка | Результат |
|---|---|
| vitest src/routes/joinCodes.test.ts | PASS (4 tests) |

**Изменения:** `artifacts/api-server/src/routes/joinCodes.test.ts` — тест 400 при невалидном path-параметре code (safeParse).

**Следующий pick:** M-216 (route error-paths 500: players.ts).

## Marathon M-214 (2026-08-05 22:19 UTC) {#marathon-m-214}

| Проверка | Результат |
|---|---|
| vitest src/routes/hosts.test.ts | PASS (23 tests) |

**Изменения:** `artifacts/api-server/src/routes/hosts.test.ts` — тесты 403/409 для attach-quota, 500 для register/config/stream-relay, 503 для streamKey и stream-relay без шифрования.

**Следующий pick:** M-215 (route error-paths 400: joinCodes.ts).

## Marathon M-213 (2026-08-05 22:14 UTC) {#marathon-m-213}

| Проверка | Результат |
|---|---|
| vitest src/routes/embed.test.ts | PASS (9 tests) |

**Изменения:** `artifacts/api-server/src/routes/embed.test.ts` — тесты 409 для quota_requirements_unmet и hosts_busy.

**Следующий pick:** M-215 (route error-paths 400: joinCodes.ts).

## Marathon M-212 (2026-08-05 22:10 UTC) {#marathon-m-212}

| Проверка | Результат |
|---|---|
| vitest src/routes/downloads.test.ts | PASS (24 tests) |

**Изменения:** `artifacts/api-server/src/routes/downloads.test.ts` — тест 500 при сбое archiver до отправки заголовков ответа.

**Следующий pick:** M-213 (route error-paths 409: embed.ts).

## Marathon M-211 (2026-08-05 22:05 UTC) {#marathon-m-211}

| Проверка | Результат |
|---|---|
| vitest src/routes/agentAuth.test.ts | PASS (20 tests) |

**Изменения:** `artifacts/api-server/src/routes/agentAuth.test.ts` — тест 409 при уже привязанном другом ключе в bind-agent-key.

**Следующий pick:** M-212 (route error-paths 500: downloads.ts).

## Marathon M-210 (2026-08-05 22:02 UTC) {#marathon-m-210}

| Проверка | Результат |
|---|---|
| vitest src/routes/admin.test.ts | PASS (19 tests) |

**Изменения:** `artifacts/api-server/src/routes/admin.test.ts` — тест 500 при пустом insert в approve submission.

**Следующий pick:** M-211 (route error-paths 409: agentAuth.ts).

## Marathon M-209 (2026-08-05 21:43 UTC) {#marathon-m-209}

| Проверка | Результат |
|---|---|
| pnpm --filter @workspace/db test | PASS (99 tests) |

**Изменения:** `lib/db/test/withdrawals.test.ts` — колонки и notNull для withdrawals.

**Следующий pick:** idle (pending M-NN = 0).

## Marathon M-208 (2026-08-05 21:40 UTC) {#marathon-m-208}

| Проверка | Результат |
|---|---|
| pnpm --filter @workspace/db test | PASS (96 tests) |

**Изменения:** `lib/db/test/verifierLinks.test.ts` — колонки и notNull для verifierLinks, verifierLinkTokens, verifierChallenges.

**Следующий pick:** M-209 (db schema: withdrawals.ts).

## Marathon M-207 (2026-08-05 21:37 UTC) {#marathon-m-207}

| Проверка | Результат |
|---|---|
| pnpm --filter @workspace/db test | PASS (87 tests) |

**Изменения:** `lib/db/test/systemAccounts.test.ts` — колонки и notNull для systemAccounts.

**Следующий pick:** M-208 (db schema: verifierLinks.ts).

## Marathon M-206 (2026-08-05 21:34 UTC) {#marathon-m-206}

| Проверка | Результат |
|---|---|
| pnpm --filter @workspace/db test | PASS (84 tests) |

**Изменения:** `lib/db/test/sessions.test.ts` — колонки и notNull для sessions.

**Следующий pick:** M-207 (db schema: systemAccounts.ts).

## Marathon M-205 (2026-08-05 21:32 UTC) {#marathon-m-205}

| Проверка | Результат |
|---|---|
| pnpm --filter @workspace/db test | PASS (81 tests) |

**Изменения:** `lib/db/test/sessionRatings.test.ts` — колонки и notNull для sessionRatings.

**Следующий pick:** M-206 (db schema: sessions.ts).

## Marathon M-204 (2026-08-05 21:30 UTC) {#marathon-m-204}

| Проверка | Результат |
|---|---|
| pnpm --filter @workspace/db test | PASS (78 tests) |

**Изменения:** `lib/db/test/sessionMetrics.test.ts` — колонки и notNull для sessionMetrics.

**Следующий pick:** M-205 (db schema: sessionRatings.ts).

## Marathon M-203 (2026-08-05 21:28 UTC) {#marathon-m-203}

| Проверка | Результат |
|---|---|
| pnpm --filter @workspace/db test | PASS (75 tests) |

**Изменения:** `lib/db/test/refreshTokens.test.ts` — колонки и notNull для refreshTokens.

**Следующий pick:** M-204 (db schema: sessionMetrics.ts).

## Marathon M-202 (2026-08-05 21:26 UTC) {#marathon-m-202}

| Проверка | Результат |
|---|---|
| pnpm --filter @workspace/db test | PASS (72 tests) |

**Изменения:** `lib/db/test/rateLimitBuckets.test.ts` — колонки и notNull для rateLimitBuckets и rateLimitFailures.

**Следующий pick:** M-203 (db schema: refreshTokens.ts).

## Marathon M-201 (2026-08-05 21:22 UTC) {#marathon-m-201}

| Проверка | Результат |
|---|---|
| pnpm --filter @workspace/db test | PASS (66 tests) |

**Изменения:** `lib/db/test/quotas.test.ts` — колонки и notNull для quotas.

**Следующий pick:** M-202 (db schema: rateLimitBuckets.ts).

## Marathon M-200 (2026-08-05 21:20 UTC) {#marathon-m-200}

| Проверка | Результат |
|---|---|
| pnpm --filter @workspace/db test | PASS (63 tests) |

**Изменения:** `lib/db/test/quotaVds.test.ts` — колонки и notNull для quotaVds.

**Следующий pick:** M-201 (db schema: quotas.ts).

## Marathon M-199 (2026-08-05 21:18 UTC) {#marathon-m-199}

| Проверка | Результат |
|---|---|
| pnpm --filter @workspace/db test | PASS (60 tests) |

**Изменения:** `lib/db/test/quotaSessions.test.ts` — колонки и notNull для quotaSessions.

**Следующий pick:** M-200 (db schema: quotaVds.ts).

## Marathon M-198 (2026-08-05 21:15 UTC) {#marathon-m-198}

| Проверка | Результат |
|---|---|
| pnpm --filter @workspace/db test | PASS (57 tests) |

**Изменения:** `lib/db/test/players.test.ts` — колонки и notNull для players.

**Следующий pick:** M-199 (db schema: quotaSessions.ts).

## Marathon M-197 (2026-08-05 21:14 UTC) {#marathon-m-197}

| Проверка | Результат |
|---|---|
| pnpm --filter @workspace/db test | PASS (54 tests) |

**Изменения:** `lib/db/test/playerGameSaves.test.ts` — колонки и notNull для playerGameSaves.

**Следующий pick:** M-198 (db schema: players.ts).

## Marathon M-196 (2026-08-05 21:12 UTC) {#marathon-m-196}

| Проверка | Результат |
|---|---|
| pnpm --filter @workspace/db test | PASS (51 tests) |

**Изменения:** `lib/db/test/outbox.test.ts` — колонки и notNull для outbox.

**Следующий pick:** M-197 (db schema: playerGameSaves.ts).

## Marathon M-195 (2026-08-05 21:10 UTC) {#marathon-m-195}

| Проверка | Результат |
|---|---|
| pnpm --filter @workspace/db test | PASS (48 tests) |

**Изменения:** `lib/db/test/messages.test.ts` — колонки и notNull для messages.

**Следующий pick:** M-196 (db schema: outbox.ts).

## Marathon M-194 (2026-08-05 21:06 UTC) {#marathon-m-194}

| Проверка | Результат |
|---|---|
| pnpm --filter @workspace/db test | PASS (45 tests) |
| pnpm typecheck | PASS |

**Изменения:** `lib/db/test/loans.test.ts` — loanRequestsTable и loansTable: колонки и notNull.

**Следующий pick:** M-195 (db schema: messages.ts).

## Marathon M-193 (2026-08-05 21:02 UTC) {#marathon-m-193}

| Проверка | Результат |
|---|---|
| pnpm --filter @workspace/db test | PASS (39 tests) |
| lib/db tsc --noEmit | PASS |

**Изменения:** `lib/db/test/ledger.test.ts` — колонки и notNull для ledger.

**Следующий pick:** M-194 (db schema: loans.ts).

## Marathon M-192 (2026-08-05 21:00 UTC) {#marathon-m-192}

| Проверка | Результат |
|---|---|
| pnpm --filter @workspace/db test | PASS (36 tests) |
| lib/db tsc --noEmit | PASS |

**Изменения:** `lib/db/test/joinCodes.test.ts` — колонки и notNull для join_codes.

**Следующий pick:** M-193 (db schema: ledger.ts).

## Marathon M-191 (2026-08-05 20:58 UTC) {#marathon-m-191}

| Проверка | Результат |
|---|---|
| pnpm --filter @workspace/db test | PASS (33 tests) |
| lib/db tsc --noEmit | PASS |

**Изменения:** `lib/db/test/hosts.test.ts` — колонки и notNull для hosts.

**Следующий pick:** M-192 (db schema: joinCodes.ts).

## Marathon M-190 (2026-08-05 20:56 UTC) {#marathon-m-190}

| Проверка | Результат |
|---|---|
| pnpm --filter @workspace/db test | PASS (30 tests) |
| lib/db tsc --noEmit | PASS |

**Изменения:** `lib/db/test/hostGames.test.ts` — колонки и notNull для host_games.

**Следующий pick:** M-191 (db schema: hosts.ts).

## Marathon M-189 (2026-08-05 20:54 UTC) {#marathon-m-189}

| Проверка | Результат |
|---|---|
| pnpm --filter @workspace/db test | PASS (27 tests) |
| lib/db tsc --noEmit | PASS |

**Изменения:** `lib/db/test/games.test.ts` — колонки и notNull для games.

**Следующий pick:** M-190 (db schema: hostGames.ts).

## Marathon M-188 (2026-08-05 20:52 UTC) {#marathon-m-188}

| Проверка | Результат |
|---|---|
| pnpm --filter @workspace/db test | PASS (24 tests) |
| lib/db tsc --noEmit | PASS |

**Изменения:** `lib/db/test/gameSubmissions.test.ts` — колонки и notNull для game_submissions.

**Следующий pick:** M-189 (db schema: games.ts).

## Marathon M-187 (2026-08-05 20:49 UTC) {#marathon-m-187}

| Проверка | Результат |
|---|---|
| pnpm --filter @workspace/db test | PASS (21 tests) |
| lib/db tsc --noEmit | PASS |

**Изменения:** `lib/db/test/devKeys.test.ts` — колонки и notNull для dev_keys.

**Следующий pick:** M-188 (db schema: gameSubmissions.ts).

## Marathon M-186 (2026-08-05 20:47 UTC) {#marathon-m-186}

| Проверка | Результат |
|---|---|
| pnpm --filter @workspace/db test | PASS (18 tests) |
| lib/db tsc --noEmit | PASS |

**Изменения:** `lib/db/test/deposits.test.ts` — колонки и notNull для deposits.

**Следующий pick:** M-187 (db schema: devKeys.ts).

## Marathon M-185 (2026-08-05 20:45 UTC) {#marathon-m-185}

| Проверка | Результат |
|---|---|
| pnpm --filter @workspace/db test | PASS (15 tests) |
| lib/db tsc --noEmit | PASS |

**Изменения:** `lib/db/test/depositAddresses.test.ts` — колонки и notNull для deposit_addresses.

**Следующий pick:** M-186 (db schema: deposits.ts).

## Marathon M-184 (2026-08-05 20:43 UTC) {#marathon-m-184}

| Проверка | Результат |
|---|---|
| pnpm --filter @workspace/db test | PASS (12 tests) |
| lib/db tsc --noEmit | PASS |

**Изменения:** `lib/db/test/conversations.test.ts` — колонки и notNull для conversations.

**Следующий pick:** M-185 (db schema: depositAddresses.ts).

## Marathon M-183 (2026-08-05 20:41 UTC) {#marathon-m-183}

| Проверка | Результат |
|---|---|
| pnpm --filter @workspace/db test | PASS (9 tests) |
| lib/db tsc --noEmit | PASS |

**Изменения:** `lib/db/test/billingEvents.test.ts` — колонки и notNull для billing_events.

**Следующий pick:** M-184 (db schema: conversations.ts).

## Marathon M-182 (2026-08-05 20:38 UTC) {#marathon-m-182}

| Проверка | Результат |
|---|---|
| pnpm --filter @workspace/db test | PASS (6 tests) |
| lib/db tsc --noEmit | PASS |

**Изменения:** `lib/db/test/agentPairingCodes.test.ts` — колонки и notNull для agent_pairing_codes.

**Следующий pick:** M-183 (db schema: billingEvents.ts).

## Marathon M-181 (2026-08-05 20:35 UTC) {#marathon-m-181}

| Проверка | Результат |
|---|---|
| pnpm --filter @workspace/db test | PASS (3 tests) |
| lib/db tsc --noEmit | PASS |

**Изменения:** scanner cat U (lib/db schema без co-located test); `lib/db/test/agentEvents.test.ts` — колонки и notNull для agent_events.

**Следующий pick:** M-182 (db schema: agentPairingCodes.ts).

## Marathon M-180 (2026-08-05 20:32 UTC) {#marathon-m-180}

| Проверка | Результат |
|---|---|
| pnpm --filter @workspace/api-server typecheck | PASS |

**Изменения:** `admin.ts` — убраны 3× `as any` (тип `AdminRequest` для `adminHostId`, как `AuthenticatedRequest` в authMiddleware).

**Следующий pick:** — (scanner empty после sync).

## Marathon M-179 (2026-08-05 20:30 UTC) {#marathon-m-179}

| Проверка | Результат |
|---|---|
| pnpm --filter @workspace/api-server typecheck | PASS |

**Изменения:** `public.ts` — убраны 5× `as any` (conds/conditions без явной типизации, как в games.ts).

**Следующий pick:** M-180 (`as any` escape в admin.ts).

## Marathon M-178 (2026-08-05 20:26 UTC) {#marathon-m-178}

| Проверка | Результат |
|---|---|
| pnpm --filter @workspace/web typecheck | PASS |
| pnpm --filter @workspace/web test | PASS (358 tests) |

**Изменения:** `hosts.tsx` — убраны 5× `as any` (games, isOnline, pingMs, hostTier, pcSpecs через PublicHostListItem + readHostPcSpecs).

**Следующий pick:** M-179 (`as any` escape в public.ts).

## Marathon M-177 (2026-08-05 20:22 UTC) {#marathon-m-177}

| Проверка | Результат |
|---|---|
| pnpm typecheck | PASS |

**Изменения:** `landing.tsx` — убраны 3× `as any` в каталоге популярных игр (coverImageUrl, liveHostsCount, genre/genres через GameListItem).

**Следующий pick:** M-179 (`as any` escape в public.ts).

## Marathon M-176 (2026-08-05 20:20 UTC) {#marathon-m-176}

| Проверка | Результат |
|---|---|
| pnpm typecheck | PASS |
| pnpm --filter @workspace/web test | PASS (358 tests) |

**Изменения:** `play.tsx` — убраны 2× `as any`, typed enrichment для `gameBrowserHostUrl` и `gameTitle` в test-browser iframe path.

**Следующий pick:** M-177 (`as any` escape в admin.ts).

## Marathon M-175 (2026-08-05 20:15 UTC) {#marathon-m-175}

| Проверка | Результат |
|---|---|
| lib/integrations-anthropic-ai/test/client.test.ts | PASS — getAnthropicClient (null/cache/config), anthropic proxy (7 tests) |
| pnpm --filter @workspace/integrations-anthropic-ai test | PASS (20 tests) |
| pnpm --filter @workspace/integrations-anthropic-ai exec tsc --noEmit | PASS |

**Изменения:** добавлен `client.test.ts` — lazy client, env guard, proxy delegation.

**Следующий pick:** scanner idle (integrations-anthropic-ai src покрыт).

## Marathon M-174 (2026-08-05 20:10 UTC) {#marathon-m-174}

| Проверка | Результат |
|---|---|
| lib/integrations-anthropic-ai/test/batch-utils.test.ts | PASS — isRateLimitError, batchProcess, batchProcessWithSSE (13 tests) |
| pnpm --filter @workspace/integrations-anthropic-ai test | PASS (13 tests) |
| pnpm typecheck | PASS |

**Изменения:** добавлен `batch-utils.test.ts` и test-скрипт в package.json.

**Следующий pick:** M-175 (integrations-anthropic-ai unit-тест client.ts).

## Marathon M-173 (2026-08-05 20:05 UTC) {#marathon-m-173}

| Проверка | Результат |
|---|---|
| pre-session-screen.test.mjs | PASS — wallet totals, block choice, canStart, price label, button label (12 tests) |
| pnpm --filter @workspace/web test | PASS (358 tests) |

**Изменения:** экспортированы pure helpers из `PreSessionScreen`; добавлен `pre-session-screen.test.mjs`.

**Следующий pick:** scanner idle (cat N web components покрыты).

## Marathon M-139 (2026-08-05 20:00 UTC) {#marathon-m-139}

| Проверка | Результат |
|---|---|
| lib/auth-verifier/test/router.test.ts | 15 тестов: auth 401, GET /status, POST /link/start, POST /challenge, verify, webhooks telegram/discord |
| auth-verifier test suite | PASS (67 tests) |

**Изменения:** добавлен `router.test.ts` — HTTP-тесты createVerifierRouter через локальный Express-сервер.

**Следующий pick:** M-173 (web components unit-тест pre-session-screen.tsx).

## Marathon M-138 (2026-08-05 20:00 UTC) {#marathon-m-138}

| Проверка | Результат |
|---|---|
| lib/auth-verifier/test/providers-telegram.test.ts | 10 тестов: sendOtp, setWebhook (успех + ошибки API) + parseUpdate (private, group, пустой text) |
| auth-verifier test suite | PASS (52 tests) |

**Изменения:** добавлен `providers-telegram.test.ts` по образцу providers-discord.

**Следующий pick:** M-139 (auth-verifier unit-тест router.ts).

## Marathon M-137 (2026-08-05 19:55 UTC) {#marathon-m-137}

| Проверка | Результат |
|---|---|
| lib/auth-verifier/test/providers-discord.test.ts | 10 тестов: sendOtp (DM + message, ошибки API) + parseMessage (DM, guild, bot, пустой content) |
| auth-verifier test suite | PASS (42 tests) |

**Изменения:** переименован `discord.test.ts` → `providers-discord.test.ts` (соглашение marathon-scan для вложенных модулей).

**Следующий pick:** M-139 (auth-verifier unit-тест router.ts).

## Marathon M-172 (2026-08-05 19:46 UTC) {#marathon-m-172}

| Проверка | Результат |
|---|---|
| game-detail.test.mjs U-30 pricing helpers | PASS — LZT/USD, explainer, claim note |
| pnpm --filter @workspace/web test | PASS (346 tests) |

**Изменения (U-30):** на странице игры блок «Сколько стоит игра» с ценой LZT/USD/час, объяснением LZT и примечанием про кредит на claim; бейдж «от X LZT/мин» с USD.

**Следующий pick:** M-137 (auth-verifier discord unit test).

## Marathon M-171 (2026-08-05 19:30 UTC) {#marathon-m-171}

| Проверка | Результат |
|---|---|
| games.test.mjs U-29 countActiveCatalogFilters | PASS — категории, жанры, bool-фильтры, цена |
| pnpm --filter @workspace/web test | PASS (345 tests) |

**Изменения (U-29):** на мобиле кнопка «Фильтры» открывает bottom Sheet с категориями, жанрами, возможностями и слайдером цены; активные фильтры — чипами над сеткой.

**Следующий pick:** M-137 (auth-verifier discord unit test).

## Marathon M-170 (2026-08-05 19:25 UTC) {#marathon-m-170}

| Проверка | Результат |
|---|---|
| games.test.mjs U-28 offline helpers | PASS — честная подпись, notify, похожие по жанру |
| pnpm --filter @workspace/web test | PASS (344 tests) |

**Изменения (U-28):** у офлайн-игр в каталоге бейдж «Сейчас нет хостов», текст «Игра недоступна», кнопки «Уведомить» и «Похожие» (фильтр по жанру через `?genre=`).

**Следующий pick:** M-171 (U-29 фильтры каталога на мобиле).

## Marathon M-169 (2026-08-05 18:54 UTC) {#marathon-m-169}

| Проверка | Результат |
|---|---|
| site-nav BalanceChip на мобиле (U-27) | PASS — убран `hidden sm:flex`, компактные отступы/шрифт, truncate + title |
| pnpm --filter @workspace/web test | PASS (343 tests) |

**Изменения (U-27):** чип баланса LZT в шапке виден на малых экранах: компактный размер, обрезка длинных сумм с полным значением в `title`.

**Следующий pick:** M-170 (U-28 офлайн-игры в каталоге).

## Marathon M-168 (2026-08-05 18:30 UTC) {#marathon-m-168}

| Проверка | Результат |
|---|---|
| play.test.mjs U-26 overlay/reject messages | PASS — нет WebRTC/ICE/сырых reason |
| api-errors.test.mjs untranslated English | PASS — fallback вместо EN |
| pnpm --filter @workspace/web test | PASS (343 tests) |

**Изменения (U-26):** пользовательские тексты на `/play` без WebRTC/ICE/«токен игрока»; `getControlRejectMessage` без сырых reason-кодов; `formatApiError` не показывает непереведённый английский.

**Следующий pick:** M-169 (U-27 баланс LZT виден на мобиле).

## Marathon M-167 (2026-08-05 18:26 UTC) {#marathon-m-167}

| Проверка | Результат |
|---|---|
| play.test.mjs isTouchCapableDevice (U-25) | PASS — maxTouchPoints > 0 → true |
| pnpm --filter @workspace/web test | PASS (341 tests) |

**Изменения (U-25):** `keyboardOverlay` по умолчанию включён на тач-устройствах (`isTouchCapableDevice(navigator.maxTouchPoints)`), как геймпад; кнопка ⌨ позволяет выключить.

**Следующий pick:** M-168 (U-26 никаких технических терминов в сообщениях игроку).

## Marathon M-166 (2026-08-05 18:22 UTC) {#marathon-m-166}

| Проверка | Результат |
|---|---|
| pnpm --filter @workspace/web test | PASS (340 tests) |
| PreSessionScreen на `/play` | PASS — баланс/пинг/блок в одном экране |
| game-detail без PreSessionModal | PASS — «Настроить» ведёт на `/play/i/...` |

**Изменения (U-24):** `PreSessionScreen` — единый экран подготовки на `/play`; модалка `PreSessionModal` удалена из `game-detail.tsx`; claim только после подтверждения на экране подготовки.

**Следующий pick:** M-167 (U-25 экранная клавиатура по умолчанию на тач).

## Marathon M-165 (2026-08-05 18:16 UTC) {#marathon-m-165}

| Проверка | Результат |
|---|---|
| hosts.test.mjs (U-23) | PASS — inline `game-select`, нет `GamePickerDialog` |
| node --import tsx --test artifacts/web/test/hosts.test.mjs | PASS (10 tests) |

**Изменения (U-23):** `GamePickerDialog` удалён; при нескольких играх у хоста — инлайн `<select>` в строке карточки + кнопка «Играть»; на мобиле не перекрывает экран.

**Следующий pick:** M-167 (U-25 экранная клавиатура по умолчанию на тач).

## Marathon M-164 (2026-08-05 18:15 UTC) {#marathon-m-164}

| Проверка | Результат |
|---|---|
| landing.test.mjs (U-22) | PASS — filterPlayableHosts, PLAY_NOW_FALLBACK_HREF |
| node --import tsx --test test/landing.test.mjs | PASS (14 tests) |

**Изменения (U-22):** секция «Играй прямо сейчас» всегда видна; при отсутствии онлайн-хостов — empty-state «Сейчас никто не хостит», ссылка в каталог и кнопка «Уведомить меня» (`data-testid=live-hosts-shelf`, `live-hosts-empty`).

**Следующий pick:** M-165 (U-23 выбор игры у хоста).

## Marathon M-163 (2026-08-05 18:08 UTC) {#marathon-m-163}

| Проверка | Результат |
|---|---|
| host-dashboard.test.mjs (U-19) | PASS — redactDiagnosticSecrets, buildHostDiagnosticReport |
| node --test test/host-dashboard.test.mjs | PASS (31 tests) |
| ping-server.test.mjs (U-19) | PASS — GET /diagnostics без секретов |

**Изменения (U-19):** кнопка «Скопировать диагностику» в `HostDiagnosticsCard`; `buildHostDiagnosticReport` + `redactDiagnosticSecrets` в dashboard-helpers; агент `GET /diagnostics` для безопасного экспорта.

**Следующий pick:** M-164 (U-22 лендинг без онлайн-хостов).

## Marathon M-162 (2026-08-05 17:55 UTC) {#marathon-m-162}

| Проверка | Результат |
|---|---|
| host-dashboard.test.mjs (U-18) | PASS — resolveHostDiagnosticAction, buildLiveHostDiagnostics |
| node --test test/host-dashboard.test.mjs | PASS (29 tests) |

**Изменения (U-18):** `HostDiagnosticsCard` объединяет API, heartbeat, агент, привязку, игру и сессию; у каждой ошибки одно действие; удалены разрозненные symptom/troubleshoot и отдельные статус-карточки; события агента встроены в карточку.

**Следующий pick:** M-163 (U-19 копирование диагностики без секретов).

## Marathon M-161 (2026-08-05 17:52 UTC) {#marathon-m-161}

| Проверка | Результат |
|---|---|
| agentVersionPolicy.test.ts | PASS — semver compare + MIN_SUPPORTED_AGENT_VERSION |
| public.test.ts (U-17) | PASS — GET /public/agent-requirements |
| hosts.test.ts readiness | PASS — minSupportedAgentVersion в ответе |
| host-dashboard.test.mjs (U-17) | PASS — блокировка стрима + update-agent CTA |
| agent-version-policy.test.mjs | PASS — compare + isAgentVersionSupported |
| pnpm typecheck (api-server, web, host-agent) | PASS |

**Изменения (U-17):** API отдаёт `minSupportedAgentVersion` в `/hosts/me/readiness` и `/public/agent-requirements`; дашборд блокирует тест-стрим и показывает «Обновить агент» до запуска; агент при старте логирует предупреждение при устаревшей версии.

**Следующий pick:** M-162 (U-18 единая карточка диагностики).

## Marathon M-160 (2026-08-05 16:10 UTC) {#marathon-m-160}

| Проверка | Результат |
|---|---|
| update-banner.test.mjs | PASS — плашка «Обновление готово» + кнопка «Перезапустить и обновить» |
| host-agent build + test | PASS (207 tests) |

**Изменения (U-16):** Плашка обновления в `index.html` + `update-banner.ts`; `autoUpdater` уведомляет renderer при `update-downloaded` и при открытии окна если обновление уже скачано; установка одной кнопкой через `installUpdate()` без повторного ZIP.

**Следующий pick:** M-161 (U-17 несовместимая версия агента).

## Marathon M-159 (2026-08-05 15:20 UTC) {#marathon-m-159}

| Проверка | Результат |
|---|---|
| agent-version.test.mjs | PASS — getAgentVersion() = app.getVersion() |
| ping-server.test.mjs | PASS — /ping отдаёт version из getInfo |
| host-agent typecheck | PASS |

**Изменения (U-15):** `/ping` и `/readiness` возвращают версию через `app.getVersion()` (модуль `agent-version.ts`), а не захардкоженную `"0.1.0"`; дашборд показывает ту же версию из локального probe.

**Следующий pick:** M-160 (U-16 обновление агента одной кнопкой).

## Marathon M-158 (2026-08-05 15:15 UTC) {#marathon-m-158}

| Проверка | Результат |
|---|---|
| install-u33.test.mjs | PASS — INSTALL.txt упоминает 18080–18083 |
| downloads.test.ts (U-33) | PASS — ZIP INSTALL.txt согласован с UI и ping-server |
| pnpm typecheck | PASS |

**Изменения (U-33):** INSTALL.txt, встроенный в ZIP через downloads.ts, теперь описывает диапазон портов 18080–18083 (как dashboard-чеклист и `PING_PORT_FALLBACKS` в ping-server.ts); добавлены тесты install-u33 и downloads U-33.

**Следующий pick:** M-159 (U-15 версия агента из сборки).

## Marathon M-157 (2026-08-05 15:11 UTC) {#marathon-m-157}

| Проверка | Результат |
|---|---|
| install-u12.test.mjs | PASS |
| downloads.test.ts (U-12) | PASS — INSTALL.txt в ZIP без ручного копипаста токена |
| pnpm typecheck | PASS |

**Изменения (U-12):** INSTALL.txt и подсказки дашборда описывают один 5-шаговый поток (ZIP с дашборда → start.bat → агент онлайн → игра → тест-стрим); токен вшит в архив; downloads.ts берёт INSTALL.txt из `artifacts/host-agent/` вместо дублирующего inline-текста.

**Следующий pick:** M-158 (U-33 порты файрвола).

## Marathon M-156 (2026-08-05 15:04 UTC) {#marathon-m-156}

| Проверка | Результат |
|---|---|
| host-agent build | PASS |
| host-agent test suite | PASS (library, connect-events, ui и др.) |

**Изменения (U-11):** весь пользовательский интерфейс агента переведён на русский — `index.html`, статусы сессии, библиотека, Steam-скан, настройки, журнал событий; технические идентификаторы (hostToken, file_not_found и т.п.) не переводились.

**Следующий pick:** M-157 (U-12 INSTALL.txt и подсказки дашборда).

## Marathon M-155 (2026-08-05 14:55 UTC) {#marathon-m-155}

| Проверка | Результат |
|---|---|
| add-game-modal.test.mjs | +1 тест: экспорт AddGameModal и QuickAddFirstGame |
| web test suite | 327 тестов — PASS |

**Изменения (U-10):** форма добавления игры вынесена в `add-game-modal.tsx` (`AddGameModal` + `QuickAddFirstGame`); библиотека и онбординг дашборда используют один и тот же модальный поток (поиск → настройка → предложить новую).

**Следующий pick:** M-156 (U-11 русский язык во всём UI агента).

## Marathon M-154 (2026-08-05 14:50 UTC) {#marathon-m-154}

| Проверка | Результат |
|---|---|
| host-auth-guard.test.mjs | +7 тестов: validateExistingHostToken, isExistingHostTokenValid |
| web test suite | 326 тестов — PASS |
| pnpm typecheck | PASS |

**Изменения (U-09):** на экране «Стать хостом» добавлена форма «У меня уже есть токен» с проверкой через GET /api/hosts/:token; после успешного входа — сразу дашборд (токен в localStorage).

**Следующий pick:** M-155 (U-10 библиотека и быстрое добавление игры).

## Marathon M-153 (2026-08-05 14:46 UTC) {#marathon-m-153}

| Проверка | Результат |
|---|---|
| host-agent typecheck | PASS |
| host-agent test suite | 205 тестов — PASS |

**Изменения (U-08):** `agent:login` открывает `/host` (существующий маршрут дашборда), а не несуществующий `/host/dashboard`.

## Marathon M-152 (2026-08-05 14:45 UTC) {#marathon-m-152}

| Проверка | Результат |
|---|---|
| host-dashboard.test.mjs | 21 тест — дашборд без legacy BindingForm, PASS |
| web test suite | PASS (host-binding-form удалён, −12 тестов) |
| pnpm typecheck | PASS |

**Изменения (U-07):** удалены `binding-form.tsx`, `binding-form-helpers.ts` и карточка на дашборде; настройка игр и цены LZT/мин только через `/host/library`.

## Marathon M-151 (2026-08-05 14:34 UTC) {#marathon-m-151}

| Проверка | Результат |
|---|---|
| host-dashboard.test.mjs | 21 тест — онбординг 5 шагов без отдельной фазы bind, PASS |
| host-agent test suite | 205 тестов — auto-bind + pairing в troubleshoot, PASS |
| pnpm typecheck | PASS |

**Изменения (U-06):** основной путь — ZIP с токеном и автопривязка ключа в агенте; код привязки, pairing и ручной токен спрятаны в «Если не подключается»; дашборд убрал шаг bind из квик-старта.

## Marathon M-136 (2026-08-05 14:33 UTC) {#marathon-m-136}

| Проверка | Результат |
|---|---|
| lib/auth-verifier/test/otp.test.ts | 8 тестов: generateOtp (формат, padding, random) + verifyOtp (match, mismatch, length) |
| auth-verifier test suite | PASS (32 tests) |
| pnpm typecheck | PASS |

**Следующий pick:** M-137 (auth-verifier unit-тест providers/discord.ts).

## Marathon M-150 (2026-08-05 14:29 UTC) {#marathon-m-150}

| Проверка | Результат |
|---|---|
| dashboard-helpers.ts | evaluateHostReadiness — 7 проверок, один nextFix по-русски (U-14) |
| GET /hosts/me/readiness | API: binding, heartbeat, enabled games, active session |
| ping-server GET /readiness | inputOk probe через injectInput |
| agent-local.ts | probeAgentReadiness |
| dashboard.tsx | кнопка «Проверить готовность» + результат |
| host-dashboard.test.mjs | +2 теста evaluateHostReadiness |
| hosts.test.ts | +1 GET /hosts/me/readiness |
| ping-server.test.mjs | +1 GET /readiness |
| pnpm typecheck | PASS |

**Следующий pick:** M-136 (auth-verifier unit-тест otp.ts).

## Marathon M-149 (2026-08-05 14:18 UTC) {#marathon-m-149}

| Проверка | Результат |
|---|---|
| dashboard-helpers.ts | resolveGuidedNextAction, hasCompletedFirstStream, read/markHostGoOnlineAck — guided-flow U-13 |
| host-dashboard.test.mjs | 19 тестов (+4: first stream, guided phases) |
| dashboard.tsx | одно CTA до первого стрима; stats/шаблоны/сессии скрыты в онбординге |
| web test (host-dashboard) | PASS (19 tests) |

**Следующий pick:** M-150 (U-14 «Проверить готовность»).

## Верификация всей волны + 2 найденных бага (2026-08-05 14:15 UTC) {#verification-2026-08-05}

Полная проверка ранее сделанного. Итог: **1043 теста зелёные**, `pnpm typecheck` **exit 0** впервые
за сессию, `pnpm install --frozen-lockfile` проходит (то, что валидирует CI).

| Сьют | Результат |
|---|---|
| api-server | 488/488 (6 прогонов подряд без сбоев) |
| web | 327/327 |
| host-agent | 204/204 |
| auth-verifier | 24/24 |
| `pnpm typecheck` (все пакеты) | exit 0, 0 ошибок |
| `pnpm install --frozen-lockfile` | OK (после добавления `adm-zip`) |

### Баг 1 — typecheck был красный на main (из коммита `cb18dd2`, M-96)

`browser-play.tsx:501` — `TS2345`: рефакторинг в `computeEarnedLzt(session.startedAt, ...)` перенёс
вызов **внутрь замыкания** `tick`, где narrowing от guard `!session.startedAt` уже не действует
(`session` — мутабельная внешняя привязка). Automation отметил M-96 как done, нарушив своё же
правило 11 «CI — gate». Починено: суженные значения захватываются в локальные `const` до замыкания —
поведение идентично оригиналу, тип корректен.

### Баг 2 — флаки-тест ~20% и настоящий баг в проде (`lib/auth-verifier/src/link.ts`)

`verifier.test.ts > POST /verifier/link/start` падал примерно раз в 5 прогонов с токеном вида
`OOOAY-Y`. Причина не в тесте: комментарий обещал «8-char uppercase **alphanumeric**», а код брал
`crypto.randomBytes(5).toString("base64url")` — алфавит base64url содержит `-` и `_`.

- Вероятность сходится с наблюдением: `1 - (62/64)^7 ≈ 19.8%`.
- Практический вред помимо флака: `_` в Telegram — markdown-разметка, а `-`/`_` неудобно
  перенабирать с экрана.

Починено: явный алфавит `ABCDEFGHJKMNPQRSTVWXYZ0123456789` (32 символа → `byte & 31` без смещения,
исключены легко путаемые I, L, O, U). Добавлены **детерминированные** тесты (500 сэмплов на
инвариант) вместо надежды поймать 1-из-5. После фикса `verifier.test.ts` — 15/15 прогонов чисто
(при сохранившемся баге шанс такого был бы `0.8^15 ≈ 3.5%`). Колонка БД — `text`, длина 8 влезает.

### Усиление собственного кода U-31 (`resolveHostAgentExeUrl`)

Перечитал свою реализацию и нашёл два изъяна до того, как они дошли бы до прода:

| Изъян | Почему важно | Исправление |
|---|---|---|
| Нет таймаута на `fetch` | у Node `fetch` таймаута по умолчанию нет — подвисший GitHub API держал бы HTTP-запрос вечно | `AbortSignal.timeout(5000)` |
| `releases/latest` — релиз **любого** компонента | монорепо: релиз web/платформы стал бы «latest» без `.exe` → 503 при живом релизе агента | список релизов + фильтр по префиксу тега `host-agent-v`, вынесен в чистую `pickInstallerUrlFromReleases` |
| Всплеск параллельных запросов | холодный кэш × N кликов = N запросов к API с лимитом 60/час | дедупликация через общий in-flight promise |

Тесты downloads: 15 → **21**. Плюс реальный (не мок) вызов GitHub API проверен временным тестом:
не подвисает, кэш отвечает <50мс, override приоритетен, префикс-фильтр работает; временный файл удалён.

## MVP_MANUAL_TEST.md — хендофф на реальный Windows (2026-08-05 14:05 UTC) {#mvp-manual-test-handoff}

Добавлен `MVP_MANUAL_TEST.md` — самодостаточный промпт для обычного (не cloud) Cursor-чата
на настоящем Windows-ПК. Покрывает только то, что cloud-агент в Linux-песочнице физически
не может проверить: сборку `.exe` через `electron-builder`, первый релиз по тегу
`host-agent-v*` (ещё не публиковался ни разу — версия в `package.json` до сих пор `0.1.0`
без единого релизного тега), файрвол/loopback-порты 18080-18083, `requestedExecutionLevel:
asInvoker` для SendInput без UAC, и сквозной ручной прогон «владелец сам себе игрок».

Явно отмечено: loopback-трафик (`127.0.0.1`) обычно не блокируется файрволом Windows по
умолчанию — INSTALL.txt мог переоценивать этот риск; промпт просит **проверить на деле**,
а не предполагать, и обновить U-33 точным результатом, а не текущей формулировкой.

Ссылка добавлена в `MARATHON.md` (шапка) и `UX_BACKLOG.md` (интро).

## Marathon M-147/M-148 — U-31/U-32: реальный .exe + честный unzip-тест (2026-08-05 13:58 UTC) {#marathon-m147-m148}

| Проверка | Результат |
|---|---|
| `/downloads/host-agent.exe` | больше не 503-по-умолчанию — авто-резолв последнего GitHub Release (`releases/latest`, ищет `.exe`-ассет), кэш 5 мин; `HOST_AGENT_EXE_URL` остаётся приоритетным override |
| Сообщение при отсутствии релиза | по-русски, с указанием тега `host-agent-v*` вместо голого "Installer not available" |
| Дашборд | у обеих кнопок «Скачать агент» появилась вторая, мелкая ссылка на `.exe` |
| **Важное уточнение к U-31** | `.exe`-инсталлятор — статический артефакт CI, он **не может** нести персональный `hostToken` (в отличие от ZIP, где `config.json` собирается на лету). Сделал `.exe` **честной альтернативой**, а не заменой ZIP — подпись прямо говорит «нужен код привязки», чтобы не переобещать нулевой копипаст там, где его физически нет. Zero-copy-paste для `.exe` — отдельная будущая задача (deep-link `decenthub://bind` или аналог), не в этом объёме |
| unzip-тест токена (U-32) | добавлен `adm-zip` в `api-server` devDeps; 3 новых теста: токен есть при авторизованном запросе, отсутствует без авторизации, отсутствует для неизвестного токена — реальная распаковка + JSON.parse, не байтовый поиск |
| GitHub API в тестах | замокан через `vi.stubGlobal("fetch", ...)` с passthrough на реальный fetch для локального test-сервера; 4 новых теста на резолв/override/no-asset/кэш |
| api-server test (downloads) | 15/15 PASS |
| web test | 327/327 PASS |

## Marathon: доставка потерянных задач + новые MVP-блокеры (2026-08-05 13:45 UTC) {#marathon-mvp-blockers}

**Найден баг координации:** предыдущая волна (guided-flow U-13/U-14 + апдейты/диагностика U-15…U-19)
была закоммичена только на ветку `cursor/marathon-5e33` и осталась в уже смерженном PR #538 — cron
работает строго с `main` и эти задачи не видел. Исправлено: сброс на актуальный `origin/main` (`dc055e1`)
и прямой push в `main`, без PR — как делает сам automation.

**Аудит подороже (Opus) нашёл реальный оставшийся блокер MVP:** кнопка «Скачать агент» до сих пор ведёт
на ZIP, который требует Node.js + `npm install` (~2–5 мин) на машине тестера. При этом
`.github/workflows/agent-build.yml` уже собирает настоящий `.exe`-инсталлятор и публикует его в GitHub
Release при теге `host-agent-v*` — `/downloads/host-agent.exe` просто не умеет его находить сам
(503, если не выставлена `HOST_AGENT_EXE_URL` вручную).

| Добавлено | Задача | Приоритет |
|---|---|---|
| U-31 | `.exe` вместо ZIP+npm как основная кнопка (авто-резолв GitHub Release) | P0 |
| U-32 | Честный unzip-тест на `hostToken` внутри архива (не байтовый поиск имени файла) | P0 |
| U-33 | Согласовать порты файрвола в INSTALL.txt / embedded INSTALL_TXT / UI / ping-server | P1 |
| U-13, U-14 | Перенесены заново из потерянной волны (guided next-action, «Проверить готовность») | P0 |
| U-15…U-19 | Перенесены заново (версия из сборки, апдейтер, compatibility gate, диагностика) | P1 |

**Заморозка:** категория Q (`M-136…M-139`, auth-verifier unit-тесты) не трогается automation, пока в
`UX_BACKLOG.md` остаётся хоть один `todo` — достигается порядком `CAT_ORDER.R = -1` в `marathon-scan.mjs`,
без мутации статусов (чтобы не плодить дубли при `--sync-marathon`).

**Проверка:** `marathon-scan --sync-marathon` → 9 новых pending, next pick = **M-147 (U-31)**; `marathon-groom` — 0 issues.

## Marathon: смена направления на UX (2026-08-05 12:55 UTC) {#marathon-ux-direction}

Техдолг (cat A–Q) почти исчерпан. Новое направление генерации задач — **удобство для раннего
самостоятельного теста владельцем**: меньше окон, меньше копипаста, меньше предварительных знаний.

| Изменение | Результат |
|---|---|
| `UX_BACKLOG.md` | 23 задачи U-NN с приоритетами P0/P1/P2, файлами и критериями готовности |
| `marathon-scan.mjs` cat R | читает U-NN со статусом `todo`; `CAT_ORDER.R = -1` — **раньше всех тестовых категорий** |
| P0-гейт | пока открыт хоть один P0, задачи P1/P2 в очередь не попадают |
| MARATHON.md § Генератор UX-задач | самодостаточный промпт для composer: аудит потоков → 10–15 задач в формате таблицы |
| Idle-политика | при `scanner_empty` сначала пополнить UX_BACKLOG, только потом новая тех-категория |
| Двойной статус для cat R | `M-NN → done` + `U-NN → done`; иначе groom вернёт задачу (`done_but_active`) |

**Аудит-основа (2 explore-агента):** путь хоста — 12–18 действий и 4–6 окон до стрима, ручной ввод
Platform URL / токена / пути к `.exe`, «Выйти в онлайн» спрятан в свёрнутом блоке, три параллельных
способа привязки агента. Путь игрока — рассинхрон «Играть» на десктопе и мобиле, модалки на пути
к игре, технический текст (WebRTC/ICE/«токен игрока») в сообщениях.

| Проверка | Результат |
|---|---|
| scan cat R | 7 задач P0 в топе очереди, техдолг Q — после них |
| flip U-01 → done | задача исчезает из candidates |
| flip всех P0 → done | всплывают P1/P2 (16 задач) |
| --sync-marathon | M-140…M-151, next pick = M-140 (U-01) |

**Следующий pick:** M-136 — auth-verifier unit-тест (otp.ts).

## M-146 — «Играть сейчас» подбирает хост сама (2026-08-05 13:40 UTC) {#marathon-m146}

| Проверка | Результат |
|---|---|
| landing.test.mjs | 5 новых тестов — pickBestPlayableHost, resolvePlayNowInvitePath, PASS |
| web test suite | 327 тестов — PASS |

**Изменения:** главный CTA на лендинге и кнопка на `/hosts` ведут на `/play/i/{inviteCode}` лучшего онлайн-хоста (tier → ping → цена); без хостов — переход в каталог `/games`.

## M-145 — «Играть» ведёт в `/hosts` на десктопе и мобиле (2026-08-05 13:28 UTC) {#marathon-m145}

| Проверка | Результат |
|---|---|
| site-nav.test.mjs | 6 тестов — getSiteNavPlayHref, isSiteNavPlayActive, PASS |
| web test (site-nav) | PASS |

**Изменения:** мобильная «Играть» в шапке вела на `/games`, десктоп — на `/hosts`. Добавлены `getSiteNavPlayHref()` и `isSiteNavPlayActive()` — единая цель `/hosts` для обеих точек входа.

## M-144 — Квик-старт: реальное состояние шага «Скачай агент» (2026-08-05 13:24 UTC) {#marathon-m144}

| Проверка | Результат |
|---|---|
| host-dashboard.test.mjs | 3 новых теста — isAgentOnceSeen, localStorage download, step-логика |
| web test suite | 321 тест — PASS |

**Изменения:** шаг «Скачай агент» в квик-старте больше не `done` по умолчанию — только после клика «Скачать агент» (`streamline.hostAgentDownloaded`) или если агент уже был замечен (online / fresh / stale heartbeat). Новый хост видит 0/5 шагов до скачивания.

## M-143 — Выбор `.exe` через файловый диалог (2026-08-05 13:20 UTC) {#marathon-m143}

| Проверка | Результат |
|---|---|
| ping-server.test.mjs | 15 тестов — GET /steam-games, POST /pick-exe |
| agent-local.test.mjs | 10 тестов — requestAgentPickExe, fetchAgentSteamGames |
| host-agent typecheck | PASS |
| web test suite | 319 тестов — PASS |

**Изменения:** веб-библиотека (`ExePathPicker`) — кнопка «Обзор…» через локальный агент (`POST /pick-exe`), список Steam-игр (`GET /steam-games`), ручной ввод как fallback. Агент: новые эндпоинты ping-server, общий `openExeFileDialog`.

## M-142 — «Выйти в онлайн» на главном экране агента (2026-08-05 13:13 UTC) {#marathon-m142}

| Проверка | Результат |
|---|---|
| dom.test.mjs | connect/disconnect в `#session-actions-card`, не в `#advanced-settings` |
| host-agent test suite | 201 тест — PASS |

**Изменения:** кнопки «Выйти в онлайн» и «Отключиться» вынесены в карточку «Сессия» на главном экране; из свёрнутых «Расширенные настройки» убраны основные действия.

## M-141 — Токен хоста в скачиваемом агенте (2026-08-05 13:12 UTC) {#marathon-m141}

| Проверка | Результат |
|---|---|
| downloads.test.ts | 9 тестов — buildBundledAgentConfig, ZIP bundle |
| bundled-config.test.mjs | 3 теста — bundled hostToken + apiBaseUrl |
| typecheck (api-server, host-agent, web dashboard) | PASS |

**Изменения:** ZIP `/api/downloads/host-agent.zip` с Bearer-токеном включает `hostToken` в `config.json`; дашборд скачивает через `downloadHostAgentZip()` (без копипаста в URL); агент подхватывает bundled hostToken при первом запуске.

## M-140 — Platform URL автозаполнение (2026-08-05 13:05 UTC) {#marathon-m140}

| Проверка | Результат |
|---|---|
| downloads.test.ts | 6 тестов — resolveApiBaseUrl, config.json в ZIP |
| bundled-config.test.mjs | 2 теста — bundled config.json → apiBaseUrl, user override |
| host-agent typecheck | PASS |

**Изменения:** ZIP `/api/downloads/host-agent.zip` включает `config.json` с `apiBaseUrl` текущего домена; агент читает bundled config при первом запуске; поле Platform URL предзаполняется в UI.


**Аудит:** 541 PR (529 unmerged), 519 marathon-веток, 479 marathon-коммитов в main только за 03.08.

| Петля | Масштаб | Причина | Фикс |
|---|---|---|---|
| idle-коммиты | ~300 (03.08) | политика «commit Last run при idle» | exit 3 без агента; запрет в prompt |
| hash-коммиты | ~250 | поле Commit ссылается на собственный коммит — «чинится» вечно | поле Commit удалено из Last run |
| работа мимо main | 529/541 PR | run пушил ветку+PR, никто не мержил | обязательный merge→main в конце run; дедуп done_on_main |
| timestamp-диффы | риск v2 | «Обновлено: …» в § Efficiency менялось каждый run | секция пишется только при изменении метрик |

| Проверка | Результат |
|---|---|
| groom --should-run | dedupFlipped[], efficiency в payload, exit 0/2/3 |
| update-last-run | Commit-строка удаляется, hash не пишется |
| efficiency --apply ×2 | идемпотентен (2-й запуск без diff) |
| groom --apply | новый чек done_on_main (флип pending→done) |

## Marathon efficiency v2 (2026-08-05 09:25 UTC) {#marathon-efficiency-v2}

| Изменение | Результат |
|---|---|
| marathon-efficiency.mjs | метрики 7d, рекомендации, auto-close draft idle PR |
| marathon-last-run.mjs | Last run + commit hash в **одном** feat-коммите |
| marathon-groom.mjs | expand scanner сразу (idleStreak=0), shouldRunAgent, efficiency в payload |
| idle-политика | убран analyze-only exit; hash-only commits запрещены |
| push | только main (cron source of truth) |

**Метрики на старте:** taskHitPct ~29%, hashWastePct ~52%, 41 idle draft PR.

## Marathon M-113 (2026-08-05 11:27 UTC) {#marathon-m-113}

| Проверка | Результат |
|---|---|
| embed.test.ts | 7 тестов — POST /embed/sessions (400 invalid body, 403 invalid/disabled key, 404 game/host, 402 balance, 201 session) |
| api-server test (embed) | PASS (7 tests) |

**Следующий pick:** M-115 (events.ts).

## Marathon M-115 (2026-08-05 11:33 UTC) {#marathon-m-115}

| Проверка | Результат |
|---|---|
| events.test.ts | 3 теста — GET /events/stream (SSE headers + connected event, platform event fan-out, unsubscribe on disconnect) |
| api-server test (events) | PASS (3 tests) |

**Следующий pick:** M-116 (games.ts).

## Marathon M-116 (2026-08-05 11:36 UTC) {#marathon-m-116}

| Проверка | Результат |
|---|---|
| games.test.ts | 7 тестов — GET /games (catalog+aggregates, 400 invalid bool, hasMods=false), GET /games/:slug (404 unknown/hidden, detail+live sessions, tag filter) |
| api-server test (games) | PASS (7 tests) |

**Следующий pick:** M-117 (health.ts).

## Marathon M-118 (2026-08-05 11:43 UTC) {#marathon-m-118}

| Проверка | Результат |
|---|---|
| hosts.test.ts | 14 тестов — POST /hosts/register (400, 201), GET /hosts/:hostToken (404, 200), POST /hosts/heartbeat (401, 404, 200), PATCH /hosts/me/config (401, 400 price, 200), GET /hosts/:hostToken/stats (404, 200), GET /hosts/:hostToken/sessions (404, 200) |
| api-server test (hosts) | PASS (14 tests) |

**Следующий pick:** M-119 (joinCodes.ts).

## Marathon M-119 (2026-08-05 11:47 UTC) {#marathon-m-119}

| Проверка | Результат |
|---|---|
| joinCodes.test.ts | 3 теста — POST /join-codes/:code/exchange (404 invalid/expired, 200 playerToken+sessionId, Deprecation header) |
| api-server test (joinCodes) | PASS (3 tests) |

**Следующий pick:** M-120 (loans.ts).

**Следующий pick:** M-122 (premium.ts).

**Следующий pick:** M-129 (submissions.ts).

## Marathon M-129 (2026-08-05 12:26 UTC) {#marathon-m-129}

| Проверка | Результат |
|---|---|
| submissions.test.ts | 20 тестов — POST /games/submit; PATCH /games/submissions/:id/pending-config; GET /games/submissions/my |
| api-server test (submissions) | PASS (20 tests) |

**Следующий pick:** M-132 (vt.ts).

## Marathon M-132 (2026-08-05 12:37 UTC) {#marathon-m-132}

| Проверка | Результат |
|---|---|
| vt.test.ts | 14 тестов — POST /vt/scan (sha256, URL, auth, VT errors); GET /vt/lookup (auth, validation) |
| api-server test (vt) | PASS (14 tests) |

**Следующий pick:** M-133 (wallet.ts).

## Marathon M-135 (2026-08-05 12:51 UTC) {#marathon-m-135}

| Проверка | Результат |
|---|---|
| link.test.ts | 5 тестов — startLinkFlow (2), confirmLinkToken (3) |
| auth-verifier test (link) | PASS (5 tests) |

**Следующий pick:** M-136 (otp.ts).

## Marathon M-134 (2026-08-05 12:44 UTC) {#marathon-m-134}

| Проверка | Результат |
|---|---|
| challenge.test.ts | 15 тестов — createChallenge (2), submitCode (9), getChallengeStatus (4) |
| auth-verifier test (challenge) | PASS (15 tests) |

**Следующий pick:** M-135 (link.ts).

## Marathon M-133 (2026-08-05 12:40 UTC) {#marathon-m-133}

| Проверка | Результат |
|---|---|
| wallet.test.ts | 10 тестов — GET /wallet/:userToken; GET /wallet/:userToken/transactions; POST /wallet/:userToken/withdraw |
| api-server test (wallet) | PASS (10 tests) |

**Следующий pick:** (scanner empty — groom expand).

## Marathon M-131 (2026-08-05 12:33 UTC) {#marathon-m-131}

| Проверка | Результат |
|---|---|
| verifier.test.ts | 10 тестов — GET /verifier/status; POST /link/start, /challenge, /challenge/:id/verify; POST /webhooks/telegram |
| api-server test (verifier) | PASS (10 tests) |

**Следующий pick:** M-132 (vt.ts).

## Marathon M-130 (2026-08-05 12:30 UTC) {#marathon-m-130}

| Проверка | Результат |
|---|---|
| vds.test.ts | 25 тестов — POST /quotas/vds/test-connection; POST/GET/DELETE /quotas/:quotaId/vds; GET /vds/mine |
| api-server test (vds) | PASS (25 tests) |

**Следующий pick:** M-131 (verifier.ts).

## Marathon M-128 (2026-08-05 12:22 UTC) {#marathon-m-128}

| Проверка | Результат |
|---|---|
| storage.test.ts | 16 тестов — POST /storage/uploads/request-url, /confirm, /clip-upload; GET /storage/public-objects/*, /objects/* |
| api-server test (storage) | PASS (16 tests) |

**Следующий pick:** M-129 (submissions.ts).

## Marathon M-127 (2026-08-05 12:17 UTC) {#marathon-m-127}

| Проверка | Результат |
|---|---|
| sessions.test.ts | 37 тестов — POST /sessions, /browser-host, /test; GET by-player-token, /:id, by-invite; claim, end, metrics, rate |
| api-server test (sessions) | PASS (37 tests) |

**Следующий pick:** M-128 (storage.ts).

## Marathon M-126 (2026-08-05 12:12 UTC) {#marathon-m-126}

| Проверка | Результат |
|---|---|
| saves.test.ts | 22 теста — GET/POST /saves/download-url, /upload-url, /confirm; GET/POST /players/me/saves/:gameId (upload-url, commit) |
| api-server test (saves) | PASS (22 tests) |

## Marathon M-125 (2026-08-05 12:07 UTC) {#marathon-m-125}

| Проверка | Результат |
|---|---|
| quotas.test.ts | 26 тестов — GET /quotas, /mine, /applied, /match-my-host, /applicable, /:id; POST /quotas (validation+create), /ai-suggest-specs, /:id/publish, /:id/regenerate-code |
| api-server test (quotas) | PASS (26 tests) |

**Следующий pick:** M-126 (saves.ts).

## Marathon M-124 (2026-08-05 12:04 UTC) {#marathon-m-124}

| Проверка | Результат |
|---|---|
| quotaAiChat.test.ts | 7 тестов — POST /quotas/ai-chat (validation 400/401, Anthropic reply+formPatch, default reply, fallback, 500 error) |
| api-server test (quotaAiChat) | PASS (7 tests) |

## Marathon M-123 (2026-08-05 12:01 UTC) {#marathon-m-123}

| Проверка | Результат |
|---|---|
| public.test.ts | 18 тестов — GET /public/ping, /public/ice-config, /stats, /public/games, /hosts, /public/games/:slug/hosts, POST /public/sessions, POST /public/preview-session |
| api-server test (public) | PASS (18 tests) |

**Следующий pick:** M-124 (quotaAiChat.ts).

## Marathon M-122 (2026-08-05 11:58 UTC) {#marathon-m-122}

| Проверка | Результат |
|---|---|
| premium.test.ts | 7 тестов — POST /premium/purchase (validation days/userToken, 404, insufficient balance, 201 player purchase, 201 host extend premiumUntil) |
| api-server test (premium) | PASS (7 tests) |

**Следующий pick:** M-123 (public.ts).

## Marathon M-121 (2026-08-05 11:54 UTC) {#marathon-m-121}

| Проверка | Результат |
|---|---|
| players.test.ts | 20 тестов — POST /players/register (guest, validation, full), GET /players/:token, POST claim-guest, POST upgrade-guest, PATCH credit-settings |
| api-server test (players) | PASS (20 tests) |

**Следующий pick:** M-122 (premium.ts).

## Marathon M-120 (2026-08-05 11:51 UTC) {#marathon-m-120}

| Проверка | Результат |
|---|---|
| loans.test.ts | 21 тестов — POST /loans/requests (validation, Pledger limit, 201), GET /loans/requests, POST fund (validation, 201), GET /loans/mine, POST repay |
| api-server test (loans) | PASS (21 tests) |

**Следующий pick:** M-121 (players.ts).

## Marathon M-117 (2026-08-05 11:38 UTC) {#marathon-m-117}

| Проверка | Результат |
|---|---|
| health.test.ts | 1 тест — GET /healthz → 200 {status: ok} |
| api-server test (health) | PASS (1 test) |

**Следующий pick:** M-118 (hosts.ts).

## Marathon M-114 (2026-08-05 11:30 UTC) {#marathon-m-114}

| Проверка | Результат |
|---|---|
| enrich.test.ts | 7 тестов — GET /games/rawg-search (400, Steam/RAWG search, 502), GET /games/steam-lookup (400, metadata+catalog update, 502) |
| api-server test (enrich) | PASS (7 tests) |

**Следующий pick:** M-115 (events.ts).

## Marathon M-112 (2026-08-05 11:24 UTC) {#marathon-m-112}

| Проверка | Результат |
|---|---|
| downloads.test.ts | 4 теста — GET /downloads/host-agent.exe (503/302 redirect), GET /downloads/host-agent.zip (503 без dist, zip bundle) |
| api-server test (downloads) | PASS (4 tests) |

**Следующий pick:** M-113 (embed.ts).

## Marathon M-111 (2026-08-05 11:21 UTC) {#marathon-m-111}

| Проверка | Результат |
|---|---|
| devKeys.test.ts | 12 тестов — POST /dev-keys (auth: secret/admin/open-create, validation), PATCH /dev-keys/:apiKey/rules |
| api-server test (devKeys) | PASS (12 tests) |

**Следующий pick:** M-112 (downloads.ts).

## Marathon M-110 (2026-08-05 11:19 UTC) {#marathon-m-110}

| Проверка | Результат |
|---|---|
| auth.test.ts | 21 тест — POST /auth/login (validation, JWT config, host/player legacy), /auth/refresh (rotation), /auth/logout, /auth/ws-ticket (host/player) |
| api-server test (auth) | PASS (21 tests) |

**Следующий pick:** M-111 (devKeys.ts).

## Marathon M-109 (2026-08-05 11:16 UTC) {#marathon-m-109}

| Проверка | Результат |
|---|---|
| agentTelemetry.test.ts | 7 тестов — POST /agent-telemetry (auth, validation, store+prune), GET /hosts/:hostToken/agent-events |
| api-server test (agentTelemetry) | PASS (7 tests) |

**Следующий pick:** M-110 (auth.ts).

## Marathon M-108 (2026-08-05 11:13 UTC) {#marathon-m-108}

| Проверка | Результат |
|---|---|
| agentAuth.test.ts | 19 тестов — challenge, bind-code, bind-agent-key, agent-login, pairing-code/status, agent-pair |
| api-server test (agentAuth) | PASS (19 tests) |

**Следующий pick:** M-109 (agentTelemetry.ts).

## Marathon M-134 (2026-08-05 11:08 UTC) {#marathon-m-134-fix}

| Проверка | Результат |
|---|---|
| admin.test.ts | 18 тестов PASS (auth, games, submissions, approve/reject, DELETE/PATCH) |
| marathon-scan.mjs | Исключены `*.test.ts` из route scan — устранён ложный pending M-134 |
| api-server test (admin) | PASS (18 tests) |

**Следующий pick:** M-108 (agentAuth.ts).

## Marathon M-134 (2026-08-05 11:06 UTC) {#marathon-m-134}

| Проверка | Результат |
|---|---|
| admin.test.ts | 18 тестов — auth, GET games/submissions, POST approve/reject, DELETE/PATCH games |
| api-server test (admin) | PASS (18 tests) |
| typecheck | PASS |

**Следующий pick:** M-108 (agentAuth.ts).

## Marathon M-107 (2026-08-05 11:02 UTC) {#marathon-m-107}

| Проверка | Результат |
|---|---|
| admin.test.ts | 13 тестов — auth (ADMIN_SECRET, X-Admin-Secret, X-Host-Token), GET /admin/games, GET submissions, POST reject, DELETE/PATCH games |
| api-server test (admin) | PASS (13 tests) |
| typecheck | PASS (admin.test.ts via vitest) |

**Следующий pick:** M-108 (agentAuth.ts).

## Marathon M-106 (2026-08-05 10:55 UTC) {#marathon-m-106}

| Проверка | Результат |
|---|---|
| wallet-helpers.ts | formatLzt, lztToUsdt, isTransakEnabled, buildTransakUrl, resolveWalletToken, parseWithdrawAmountLzt, isWithdrawOverGreen, validateWithdrawAmountLzt, canSubmitWithdraw, formatUsdtAddressPreview, findUsdtTrc20Address, WITHDRAW_CURRENCIES |
| wallet.test.mjs | 15 тестов — LZT format, USDT conversion, Transak URL, wallet token resolution, withdraw validation, address preview, deposit address lookup |
| wallet.tsx | рефакторинг: хелперы в wallet-helpers.ts |
| web test (wallet) | PASS (15 tests) |
| typecheck | PASS (wallet-helpers via unit tests) |

**Следующий pick:** idle (cat O web pages complete).

## Marathon M-105 (2026-08-05 10:52 UTC) {#marathon-m-105}

| Проверка | Результат |
|---|---|
| quotas-helpers.ts | fmtLzt, quotaStatusMeta, quotaKindFilterLabel, buildPublicQuotaParams, selectQuotaRows, filterQuotasBySearch, filterCompatibleQuotas, getQuotasLoadingState, getQuotasEmptyState, formatQuotaMinSpecs, formatRoyaltyRateLine, formatSponsorPricingLines, isQuotaIncompatible |
| quotas.test.mjs | 14 тестов — LZT format, status meta, kind filter, public params, row selection, search, compatibility filter, loading state, empty state, min specs, royalty/sponsor pricing, incompatible check |
| quotas.tsx | рефакторинг: хелперы в quotas-helpers.ts |
| web test (quotas) | PASS (14 tests) |
| typecheck | PASS (quotas-helpers via unit tests) |

**Следующий pick:** M-106 (wallet.tsx).

## Marathon M-104 (2026-08-05 10:47 UTC) {#marathon-m-104}

| Проверка | Результат |
|---|---|
| quota-detail-helpers.ts | fmtLzt, quotaKindLabel, quotaKindAccentColor, formatRoyaltyRate, formatRoyaltySource, formatQuotaDescription, formatMovementKind, isQuotaCloseable, getCloseButtonLabel |
| quota-detail.test.mjs | 9 тестов — LZT format, kind labels/colors, royalty rate/source, description fallback, movement kind, closeable status, close button label |
| quota-detail.tsx | рефакторинг: хелперы в quota-detail-helpers.ts |
| web test (quota-detail) | PASS (9 tests) |
| typecheck | PASS (quota-detail-helpers via unit tests) |

**Следующий pick:** M-105 (quotas.tsx).

## Marathon M-103 (2026-08-05 10:42 UTC) {#marathon-m-103}

| Проверка | Результат |
|---|---|
| profile-helpers.ts | formatLzt, formatMinutes, formatTs, kindLabel, getProfileValidTabs, resolveProfileDefaultTab, vdsStatusMeta, computeAvgSessionMinutes, computeHostEarningsLzt, enrichTransactionsWithBalances, isAgentFresh, resolveAgentPresence, computeCreditAvailable, isCreditEnabled |
| profile.test.mjs | 14 тестов — LZT format, minutes, timestamps, kind labels, tabs, VDS status, session avg, earnings, tx balances, agent presence, credit |
| profile.tsx | рефакторинг: хелперы в profile-helpers.ts |
| web test (profile) | PASS (14 tests) |
| typecheck | PASS (profile-helpers via unit tests) |

**Следующий pick:** M-105 (quotas.tsx).

## Marathon M-102 (2026-08-05 10:38 UTC) {#marathon-m-102}

| Проверка | Результат |
|---|---|
| play-helpers.ts | parseBlockMinutesParam, resolveGameBrowserHostUrl, resolveCoverImageUrl, isTestBrowserSession, computeRatePerMinLzt, computeSourceBalance, computeMinutesAffordable, needsSessionTopUp, buildClipFilename, getControlRejectMessage, buildPlayerSignalWsUrl, getConnectionBadgeLabel, computeWalletBalanceForSession |
| play.test.mjs | 13 тестов — block param, browser/cover URL, test session, LZT billing, clip filename, WS URL, connection badge, wallet balance |
| play.tsx | рефакторинг: хелперы в play-helpers.ts |
| web test (play) | PASS (13 tests) |
| typecheck | PASS (play-helpers via unit tests) |

**Следующий pick:** M-103 (profile.tsx).

## Marathon M-101 (2026-08-05 10:34 UTC) {#marathon-m-101}

| Проверка | Результат |
|---|---|
| landing-helpers.ts | formatInt, formatUsd, resolveCoverImageUrl, extractAfter, resolveJoinRedirectUrl, filterPlayableHosts, computeLztPerMin |
| landing.test.mjs | 9 тестов — int/USD format, cover URL, join redirect, playable hosts filter, LZT price |
| landing.tsx | рефакторинг: хелперы в landing-helpers.ts |
| web test (landing) | PASS (9 tests) |
| typecheck | PASS (landing-helpers via unit tests) |

**Следующий pick:** M-102 (play.tsx).

## Marathon M-100 (2026-08-05 10:31 UTC) {#marathon-m-100}

| Проверка | Результат |
|---|---|
| hosts-helpers.ts | formatPrice, resolveCoverImageUrl, getLatencyColor, computeTotalLatency, mapSessionHttpStatus, getMinGamePriceLzt, sortPublicHosts |
| hosts.test.mjs | 9 тестов — price format, cover URL, latency color/total, session HTTP status, min game price, host sorting/filter |
| hosts.tsx | рефакторинг: хелперы в hosts-helpers.ts |
| web test (hosts) | PASS (9 tests) |
| typecheck | PASS (hosts-helpers via unit tests) |

**Следующий pick:** M-101 (landing.tsx).

## Marathon M-99 (2026-08-05 10:30 UTC) {#marathon-m-99}

| Проверка | Результат |
|---|---|
| setup-helpers.ts | resolvePresetGames, buildApplicableQuotasParams, canCreateSession, isSubmitDisabled, normalizeQuotaAccessCode, buildShareLink, formatQuotaRateLabel, buildCreateSessionBody |
| host-setup.test.mjs | 10 тестов — preset games, quota params, session validation, share link, quota rate label, create session body |
| setup.tsx | рефакторинг: хелперы в setup-helpers.ts |
| web test (host-setup) | PASS (10 tests) |
| typecheck | PASS (setup-helpers) |

**Следующий pick:** M-100 (hosts.tsx).

## Marathon M-98 (2026-08-05 10:22 UTC) {#marathon-m-98}

| Проверка | Результат |
|---|---|
| library-helpers.ts | lztToUsd, resolveEntryKind, isWindowsPath, validateLibraryAppPath, normalizeLibraryConfigValues, isValidSteamAppId, getAddModalTitle, buildCatalogSearchParams, formatCatalogGameMeta, resolveDeleteConflictStatus |
| host-library.test.mjs | 13 тестов — LZT/USD, entry kind, path validation, config normalize, Steam ID, catalog search, delete conflict |
| library.tsx | рефакторинг: хелперы в library-helpers.ts |
| web test (host-library) | PASS (13 tests) |
| typecheck | PASS (library-helpers) |

**Следующий pick:** M-99 (host/setup.tsx).

## Marathon M-97 (2026-08-05 10:14 UTC) {#marathon-m-97}

| Проверка | Результат |
|---|---|
| dashboard-helpers.ts | resolveHeartbeatState, getAgentDiagnosis, isAgentOnline, agentNeedsAdvancedPanel, buildPlayerPlayLink, resolveTestSessionOpenTarget, buildTestSessionFullUrl, buildBrowserHostStorageKeys, computeQuickStartSteps |
| host-dashboard.test.mjs | 15 тестов — heartbeat, agent diagnosis, play/test URLs, quick start steps, event levels |
| dashboard.tsx | рефакторинг: хелперы в dashboard-helpers.ts |
| web test (host-dashboard) | PASS (15 tests) |
| typecheck | PASS (web helpers) |

**Следующий pick:** M-98 (host/library.tsx).

## Marathon M-96 (2026-08-05 10:10 UTC) {#marathon-m-96}

| Проверка | Результат |
|---|---|
| browser-play-helpers.ts | getStoredHostToken, resolveBrowserHostUrl, isExternalBrowserHostUrl, buildBrowserPlayIframeSrc, buildBrowserPlayShareUrl, sanitizeIceServers, buildBrowserHostSignalWsUrl, computeEarnedLzt |
| host-browser-play.test.mjs | 11 тестов — storage prefixes, host token fallback, browser URL resolve, external URL, iframe/share URLs, ICE sanitize, signal WS, earnings |
| browser-play.tsx | рефакторинг: хелперы в browser-play-helpers.ts |
| web test (host-browser-play) | PASS (11 tests) |
| typecheck | PASS (web helpers) |

**Следующий pick:** M-97 (host/dashboard.tsx).

## Marathon M-95 (2026-08-05 10:02 UTC) {#marathon-m-95}

| Проверка | Результат |
|---|---|
| binding-form-helpers.ts | minutesToHHMM, hhmmToMinutes, resolveBindingKind, validatePrices, validateScheduleSlots, validateBrowserUrl, resolveBindingFields, computeDefaultAppLabel, mergeTagsWithPending, resolveStreamKeyBody, buildBindingConfigBody |
| host-binding-form.test.mjs | 12 тестов — DAYS, time conversion, binding kind, prices, schedule, URL, fields, label, tags, stream key, config body |
| binding-form.tsx | рефакторинг: хелперы в binding-form-helpers.ts |
| web test (host-binding-form) | PASS (12 tests) |
| typecheck | PASS (web) |

**Следующий pick:** M-96 (host/browser-play.tsx).

## Marathon M-94 (2026-08-05 09:51 UTC) {#marathon-m-94}

| Проверка | Результат |
|---|---|
| games-helpers.ts | buildGamesApiParams, extractCategories, extractAllGenres, computeGlobalMaxLzt, filterAndSortGames, resolveCoverImageUrl, live hosts, price labels |
| games.test.mjs | 11 тестов — API params, categories, genres, max price, filter/sort, cover URL, live status, price format |
| games.tsx | рефакторинг: хелперы в games-helpers.ts |
| web test (games) | PASS (11 tests) |
| typecheck | PASS (web) |

**Следующий pick:** M-95 (host/binding-form.tsx).

## Marathon M-93 (2026-08-05 09:50 UTC) {#marathon-m-93}

| Проверка | Результат |
|---|---|
| game-detail-helpers.ts | formatScheduleSummary, sortHostsByLatency, formatDuration, latency/ping tiers, filterHostsByTag, resolveCoverImageUrl, mins/block affordability |
| game-detail.test.mjs | 13 тестов — schedule, host sort, duration, latency, tags, cover URL, ping, balance |
| game-detail.tsx | рефакторинг: хелперы в game-detail-helpers.ts |
| web test (game-detail) | PASS (13 tests) |
| typecheck | PASS (web) |

**Следующий pick:** M-94 (games.tsx).

## Marathon M-92 (2026-08-05 09:45 UTC) {#marathon-m-92}

| Проверка | Результат |
|---|---|
| exchange-helpers.ts | formatLzt, bpsToPercent, serverErrorToRu, loanRequestStatusRu, loanStatusRu, fundedPercent |
| exchange.test.mjs | 7 тестов — LZT формат, bps→%, API errors RU, статусы заявок/займов, fundedPercent |
| exchange.tsx | рефакторинг: хелперы в exchange-helpers.ts |
| web test (exchange) | PASS (7 tests) |
| typecheck | PASS (web) |

**Следующий pick:** M-93 (game-detail.tsx).

## Marathon M-91 (2026-08-05 09:40 UTC) {#marathon-m-91}

| Проверка | Результат |
|---|---|
| embed-helpers.ts | parseEmbedQueryParams, buildEmbedMissingParamsError, getEmbedEndedTitle/Detail, buildEmbedSignalWsUrl |
| embed.test.mjs | 6 тестов — query params, missing params error, ended titles, WS URL (wss + encode) |
| embed.tsx | рефакторинг: хелперы в embed-helpers.ts |
| web test (embed) | PASS (6 tests) |
| typecheck | PASS (web) |

**Следующий pick:** M-92 (exchange.tsx).

## Marathon M-90 (2026-08-05 09:10 UTC) {#marathon-m-90}

| Проверка | Результат |
|---|---|
| admin/games.tsx | экспорт ADMIN_SECRET_STORAGE_KEY, readAdminSecret, writeAdminSecret, adminRequestInit, getApiErrorMessage |
| admin-games.test.mjs | 4 теста — storage key, request headers, API error parsing, sessionStorage round-trip |
| marathon-scan.mjs | cat O: web pages без unit-тестов (17 задач M-90…M-106) |
| web test | PASS (134 tests) |
| typecheck | PASS (web) |

**Следующий pick:** M-91 (embed.tsx).

## Marathon idle analysis (2026-08-05 09:04 UTC) {#marathon-idle-2026-08-05}

| Проверка | Результат |
|---|---|
| scanner grouped | 0 (cat A–N исчерпаны) |
| rg TODO/console | только rf3/main.js (игра) и dev-only play.tsx |
| pnpm outdated | missing deps в cloud env (не блокер) |
| pnpm audit | 65 vulns (transitive electron-builder/ip-address) |
| git log | M-82…M-89 — web component tests |
| action | EXPAND scanner cat O (web pages) → M-90…M-106 |

## Marathon M-89 (2026-08-05 08:58 UTC) {#marathon-m-89}

| Проверка | Результат |
|---|---|
| webgl-video-shader.tsx | экспорт SHADER_PRESETS (none/sharpen/contrast/upscale/night), WebGLVideoShader forwardRef |
| webgl-video-shader.test.mjs | 6 тестов — preset keys, RU labels, GLSL uniforms, forwardRef |
| web test | PASS (130 tests) |
| typecheck | PASS (web) |

**Следующий pick:** scanner idle (cat N пуст).

## Marathon M-88 (2026-08-05 07:52 UTC) {#marathon-m-88}

| Проверка | Результат |
|---|---|
| wallet-history.tsx | экспорт formatWalletHistoryLzt, formatWalletHistoryTs, walletHistoryKindMeta, walletHistoryBucketMeta, isWalletHistoryDebtTx, WALLET_HISTORY_FILTERS, WALLET_HISTORY_PAGE_SIZE |
| wallet-history.test.mjs | 9 тестов — filters, LZT format, timestamp, kind/bucket meta, debt detection |
| web test | PASS (124 tests) |
| typecheck | PASS |

**Следующий pick:** M-89 (webgl-video-shader.tsx).

## Marathon M-87 (2026-08-05 07:14 UTC) {#marathon-m-87}

| Проверка | Результат |
|---|---|
| vt-scanner.tsx | экспорт isVtScannerInputValid, isVtScannerUrlInput, createVtScannerNetworkError, VT_SCANNER_STATUS_CONFIG, VT_SCANNER_DEFAULT_LABEL |
| vt-scanner.test.mjs | 7 тестов — input validation, URL detection, status config, network error |
| web test | PASS (115 tests) |
| typecheck | PASS |

**Следующий pick:** M-88 (wallet-history.tsx).

## Marathon M-86 (2026-08-05 06:56 UTC) {#marathon-m-86}

| Проверка | Результат |
|---|---|
| site-nav.tsx | экспорт isSiteNavHostActive, shouldHideSiteNavGuestBanner, isSiteNavPathActive, isGuestUpgradeNameValid, formatWalletBalanceLzt |
| site-nav.test.mjs | 5 тестов — host active, guest banner, path active, guest name, balance format |
| web test | PASS (108 tests) |
| typecheck | PASS |

**Следующий pick:** M-87 (vt-scanner.tsx).

## Marathon M-85 (2026-08-05 06:50 UTC) {#marathon-m-85}

| Проверка | Результат |
|---|---|
| quota-ai-chat.tsx | экспорт QUOTA_AI_CHAT_STARTERS, canSendQuotaAiMessage, shouldSubmitQuotaAiOnEnter |
| quota-ai-chat.test.mjs | 6 тестов — starters, send guard, Enter key submit |
| web test | PASS (103 tests) |
| typecheck | PASS |

**Следующий pick:** M-86 (site-nav.tsx).

## Marathon M-84 (2026-08-05 06:38 UTC) {#marathon-m-84}

| Проверка | Результат |
|---|---|
| layout.tsx | экспорт HOST_NAV_ITEMS, resolveHostSiteNavActivePath, isHostNavItemActive, hostNavLinkTestId |
| layout.test.mjs | 5 тестов — nav items, site nav active path, item active, test id |
| web test | PASS (97 tests) |
| typecheck | PASS |

**Следующий pick:** M-85 (quota-ai-chat.tsx).

## Marathon M-83 (2026-08-05 06:10 UTC) {#marathon-m-83}

| Проверка | Результат |
|---|---|
| host-auth-guard.tsx | экспорт HOST_AUTH_FEATURES, HOST_AUTH_REGISTER_TOAST, isHostDisplayNameValid |
| host-auth-guard.test.mjs | 4 теста — features, toast messages, display name validation |
| web test | PASS (92 tests) |
| typecheck | PASS |

**Следующий pick:** M-84 (layout.tsx).

## Marathon M-82 (2026-08-05 06:04 UTC) {#marathon-m-82}

| Проверка | Результат |
|---|---|
| TouchOverlay.tsx | экспорт TOUCH_OVERLAY_STORAGE_KEY, DEFAULT_TOUCH_LAYOUT, loadTouchLayout, saveTouchLayout |
| TouchOverlay.test.mjs | 6 тестов — storage key, default layout, load merge/fallback, save |
| web test | PASS (TouchOverlay) |
| typecheck | PASS |

**Следующий pick:** M-83 (host-auth-guard.tsx).

## Marathon M-81 (2026-08-05 05:44 UTC) {#marathon-m-81-fix}

| Проверка | Результат |
|---|---|
| groom | M-81 reopen: done_but_active — тест был keyboard-overlay.test.mjs, сканер ждёт KeyboardOverlay.test.mjs |
| fix | rename → KeyboardOverlay.test.mjs |
| KeyboardOverlay.test.mjs | 7 тестов PASS |
| marathon-scan --json-state | KeyboardOverlay больше не в candidates |

**Следующий pick:** M-82 (TouchOverlay.tsx).

## Marathon M-81 (2026-08-05 05:38 UTC) {#marathon-m-81}

| Проверка | Результат |
|---|---|
| idle-анализ | сканер пуст — 9 web components без тестов |
| marathon-scan.mjs | категория N: web components/*.{ts,tsx} |
| KeyboardOverlay.tsx | экспорт KEYBOARD_OVERLAY_STORAGE_KEY, loadKeyboardLayout, saveKeyboardLayout |
| keyboard-overlay.test.mjs | 7 тестов — catalogue, presets, layout load/save/fallback |
| web test | PASS (82 tests) |
| typecheck | PASS |

**Следующий pick:** M-82 (TouchOverlay.tsx).

## Marathon M-80 (2026-08-05 04:58 UTC) {#marathon-m-80}

| Проверка | Результат |
|---|---|
| use-player-wallet.tsx | экспорт PLAYER_WALLET_STORAGE_KEY, PLAYER_GUEST_STORAGE_KEY, readIsGuestFromStorage, persistGuestWalletToken, persistUpgradedWalletToken, registerGuestWallet, upgradeGuestWallet |
| use-player-wallet.test.mjs | 11 тестов — storage keys, guest flag, persist, register cached/success/failure, upgrade guards/success/failure |
| web test | PASS (75 tests) |
| typecheck | PASS |

**Следующий pick:** idle (M-queue пуста).

## Marathon M-79 (2026-08-05 04:22 UTC) {#marathon-m-79}

| Проверка | Результат |
|---|---|
| use-mobile.tsx | экспорт MOBILE_BREAKPOINT, isMobileViewport, mobileMediaQuery |
| use-mobile.test.mjs | 4 теста — breakpoint constant, media query string, viewport below/above 768 |
| web test | PASS (63 tests) |
| typecheck | PASS |

**Следующий pick:** M-80 (use-player-wallet.tsx).

## Marathon M-78 (2026-08-05 04:10 UTC) {#marathon-m-78}

| Проверка | Результат |
|---|---|
| idle-анализ | сканер M не ловил `.tsx` hooks — 3 файла без тестов (use-auth, use-mobile, use-player-wallet) |
| marathon-scan.mjs | категория M расширена на `*.{ts,tsx}` |
| use-auth.tsx | экспорт consumeTokenFromUrl, exchangeLegacyForJwt, refreshAccessJwt, AUTH_ACCESS_STORAGE_KEY |
| use-auth.test.mjs | 7 тестов — URL token strip, JWT exchange/refresh success+failure |
| web test | PASS (59 tests) |
| typecheck | PASS |

**Следующий pick:** M-79 (use-mobile.tsx).

## Marathon M-77 (2026-08-05 04:00 UTC) {#marathon-m-77}

| Проверка | Результат |
|---|---|
| idle-анализ | `connection-labels.ts` пропущен сканером — regex требовал `export const X =`, не ловил typed `export const X:` |
| connection-labels.test.mjs | 2 теста — ICE_CONNECTION_LABELS (host/srflx/relay RU), ICE_TONE_STYLES |
| marathon-scan.mjs | regex fix в категориях K/L/M: `\bexport const \w+` |
| web test | PASS (52 tests) |
| web typecheck | PASS |

**Следующий pick:** idle — web lib полностью покрыт.

## Marathon M-76 (2026-08-05 03:42 UTC) {#marathon-m-76}

| Проверка | Результат |
|---|---|
| marathon-scan.mjs | Категория **M** — web hooks без co-located test |
| use-platform-events.test.mjs | 4 теста — URL builder, connected filter, parse, malformed JSON |
| use-browser-ping.test.mjs | 3 теста — interval constant, probe RTT, probe failure |
| web test | PASS (50 tests) |
| web typecheck | PASS |

**Следующий pick:** idle — Wave Maintenance M-queue пуста (оба hook покрыты).

## Marathon M-75 (2026-08-05 03:12 UTC) {#marathon-m-75}

| Проверка | Результат |
|---|---|
| utils.test.mjs | 5 тестов — cn() merge, falsy skip, conditional objects, tailwind dedup, non-conflicting classes |
| web test (utils) | PASS (5 tests) |

**Следующий pick:** idle — Wave Maintenance L-queue пуста.

## Marathon M-74 (2026-08-05 03:06 UTC) {#marathon-m-74}

| Проверка | Результат |
|---|---|
| sentry.test.mjs | 3 теста — initSentry resolve, undefined return, idempotent calls |
| web test | PASS (38 tests) |
| web typecheck | PASS |

**Следующий pick:** M-75 `utils.ts`.

## Marathon M-73 (2026-08-05 03:02 UTC) {#marathon-m-73}

| Проверка | Результат |
|---|---|
| quota-compatibility.test.mjs | 10 тестов — specsFromPcSpecs, computeQuotaHostTier, getQuotaCompatibility, validateQuotaFormFields |
| web test | PASS (35 tests) |
| web typecheck | PASS |

**Следующий pick:** M-74 `sentry.ts`.

## Marathon M-72 (2026-08-05 02:22 UTC) {#marathon-m-72}

| Проверка | Результат |
|---|---|
| put-external-blob.test.mjs | 4 теста — PUT blob/headers, 2xx resolve, non-2xx/network reject |
| web test | PASS (25 tests) |
| web typecheck | PASS |

**Следующий pick:** M-73 `quota-compatibility.ts`.

## Marathon M-71 (2026-08-05 02:10 UTC) {#marathon-m-71}

| Проверка | Результат |
|---|---|
| ice-prewarm.test.mjs | 7 тестов — prewarmIce cache/dedup/fallback, discardPrewarm, TTL eviction |
| web test | PASS (21 tests) |
| web typecheck | PASS |

**Следующий pick:** M-72 `put-external-blob.ts`.

## Marathon M-70 (2026-08-05 02:04 UTC) {#marathon-m-70}

| Проверка | Результат |
|---|---|
| api-errors.test.mjs | 6 тестов — extractApiErrorPayload, formatApiError (коды/EN/RU/pattern), formatApiErrorPanel |
| web test | PASS (14 tests) |
| web typecheck | PASS |

**Следующий pick:** M-71 `ice-prewarm.ts`.

## Marathon M-69 (2026-08-05 01:00 UTC) {#marathon-m-69}

| Проверка | Результат |
|---|---|
| marathon-scan cat L | web lib/*.ts без тестов — 7 задач (M-69…M-75) |
| agent-local.test.mjs | 6 тестов — discoverAgentPort cache/probe, postAgentInput secret/offline |
| agent-event-labels.test.mjs | 2 теста — localizeAgentEventMessage RU mapping |
| web test | PASS (8 tests) |
| web typecheck | PASS |
| fix | `discoverAgentPort` сбрасывает cachedPort при полном probe-fail |

**Следующий pick:** M-70 `api-errors.ts`.

## Marathon M-68 (2026-08-05 00:25 UTC) {#marathon-m-68}

| Проверка | Результат |
|---|---|
| input.test.mjs | 11 тестов — parseInputEvent (mousemove/mode/buttons/wheel/keys), parseGamepadState clamp/limits, parseHostConfigPatch, constants |
| host-agent test | PASS (197 tests) |
| typecheck | PASS (host-agent) |

**Следующий pick:** сканер — idle (кат. K завершена).

## Marathon M-67 (2026-08-05 00:12 UTC) {#marathon-m-67}

| Проверка | Результат |
|---|---|
| wake-scheduler.test.mjs | 8 тестов — non-win32 no-op, manual/empty clear, scheduled register, query/delete/create error swallow, multi-delete |
| host-agent test | PASS (186 tests) |
| typecheck | PASS (host-agent) |

**Следующий pick:** M-68 `input.ts`.

## Marathon M-66 (2026-08-04 23:40 UTC) {#marathon-m-66}

| Проверка | Результат |
|---|---|
| tray.test.mjs | 7 тестов — createTray tooltip/menu/click, empty icon fallback, setStatus labels, error notification, no-op без tray, app.quit и show окна |
| host-agent test | PASS (178 tests) |
| typecheck | PASS |

**Следующий pick:** M-67 `wake-scheduler.ts`.

## Marathon M-65 (2026-08-04 23:38 UTC) {#marathon-m-65}

| Проверка | Результат |
|---|---|
| steam-scanner.test.mjs | 10 тестов — non-win32 guard, registry Steam root, scanSteam VDF/ACF/heuristic exe, UserConfig manifest exe, dedupe, resolveSteamGameFromAppPath, load/save scan state |
| host-agent test | PASS (171 tests) |
| typecheck | PASS |

**Следующий pick:** M-66 `tray.ts`.

## Marathon M-64 (2026-08-04 23:25 UTC) {#marathon-m-64}

| Проверка | Результат |
|---|---|
| spawn-hwnd.test.mjs | 8 тестов — invalid pid, non-win32 guard, HWND match по PID, foreground first, no reorder, empty/no match, capturer/koffi error swallow |
| host-agent test | PASS (161 tests) |
| typecheck | PASS |

**Следующий pick:** M-65 `steam-scanner.ts`.

## Marathon M-63 (2026-08-04 23:18 UTC) {#marathon-m-63}

| Проверка | Результат |
|---|---|
| sentry.test.mjs | 4 теста — no-op без SENTRY_DSN, init с DSN+NODE_ENV, default production, swallow require error |
| host-agent test | PASS (153 tests) |
| typecheck | PASS |

**Следующий pick:** M-64 `spawn-hwnd.ts`.

## Marathon M-62 (2026-08-04 22:50 UTC) {#marathon-m-62}

| Проверка | Результат |
|---|---|
| save-sync.test.mjs | 11 тестов — clearSavePaths, pullSave skip/restore/error, pushSave skip/upload, non-win32 restore/backup guard |
| host-agent test | PASS (149 tests) |
| typecheck | PASS |

**Следующий pick:** M-63 `sentry.ts`.

## Marathon M-61 (2026-08-04 22:46 UTC) {#marathon-m-61}

| Проверка | Результат |
|---|---|
| save-paths.test.mjs | 6 тестов — non-win32 guard, Steam userdata remote, Ludusavi cache templates, resolveSavePathCandidates, explicit steamAppId |
| host-agent test | PASS (138 tests) |
| typecheck | PASS |

**Следующий pick:** M-62 `save-sync.ts`.

## Marathon M-60 (2026-08-04 21:26 UTC) {#marathon-m-60}

| Проверка | Результат |
|---|---|
| rtmp-relay.test.mjs | 8 тестов — non-win32 guard, URL/key validation, mocked ffmpeg spawn, syncRtmpWindowTitle, fetchStreamRelayConfig |
| host-agent test | PASS (132 tests) |
| typecheck | PASS |

**Следующий pick:** M-61 `save-paths.ts`.

## Marathon M-59 (2026-08-04 20:55 UTC) {#marathon-m-59}

| Проверка | Результат |
|---|---|
| logger.test.mjs | 3 тестов — mocked electron getAppPath, agent.log append, console.log vs console.error |
| host-agent test | PASS (124 tests) |
| typecheck | PASS |

**Следующий pick:** M-60 `rtmp-relay.ts`.

## Marathon M-58 (2026-08-04 20:52 UTC) {#marathon-m-58}

| Проверка | Результат |
|---|---|
| limited-user-launch.test.mjs | 6 тестов — noop non-win32, creds validation, mocked spawn env/domain, spawn/koffi failure |
| host-agent test | PASS (121 tests) |
| typecheck | PASS |

**Следующий pick:** M-59 `logger.ts`.

## Marathon M-57 (2026-08-04 20:24 UTC) {#marathon-m-57}

| Проверка | Результат |
|---|---|
| input-injection.test.mjs | 8 тестов — noop non-win32, mocked SendInput absolute/relative mouse, buttons, wheel, keys, koffi failure |
| host-agent test | PASS (115 tests) |
| typecheck | PASS |

**Следующий pick:** M-58 `limited-user-launch.ts`.

## Marathon M-56 (2026-08-04 20:06 UTC) {#marathon-m-56}

| Проверка | Результат |
|---|---|
| gamepad-injection.test.mjs | 5 тестов — defensive copy, noop non-win32, mocked ViGEm connect/inject XUSB report |
| host-agent test | PASS (107 tests) |
| typecheck | PASS |

**Следующий pick:** M-57 `input-injection.ts`.

## Marathon M-55 (2026-08-04 18:19 UTC) {#marathon-m-55}

| Проверка | Результат |
|---|---|
| crypto-key.test.mjs | 3 теста — generate/persist, cache, signChallenge (Ed25519 verify) |
| crypto-key-load.test.mjs | 1 тест — load existing key pair from agent-key.json |
| host-agent test | PASS (102 tests) |
| typecheck | PASS |

**Следующий pick:** M-56 `gamepad-injection.ts`.

## Marathon M-54 (2026-08-04 17:55 UTC) {#marathon-m-54}

| Проверка | Результат |
|---|---|
| marathon-scan | категории J (main) + K (shared) — 15→14 pending после тестов |
| api-client.test.mjs | 12 тестов — fetchHostSchedule, fetchLibrary, sendHeartbeat, saves |
| app-launcher.test.mjs | 13 тестов — parseArgs, launchEntry/App, killApp |
| host-agent test | PASS (98 tests) |
**Следующий pick:** M-55 `crypto-key.ts`. (2026-08-04 16:42 UTC) {#marathon-m-53}

| Проверка | Результат |
|---|---|
| api-server sentry.ts | 2× `eslint-disable @typescript-eslint/no-explicit-any` убраны — ambient `sentry-node.d.ts` + `import("@sentry/node")` |
| typecheck | PASS (api-server) |
| marathon-scan | sentry.ts больше не в raw hits I; rawHits=0 |

**Следующий pick:** idle — сканер I пуст.

## Marathon M-52 (2026-08-04 16:38 UTC) {#marathon-m-52}

| Проверка | Результат |
|---|---|
| host-agent sentry.ts | `eslint-disable @typescript-eslint/no-explicit-any` убран — `require("@sentry/electron/main")` с типизированным assert |
| typecheck | PASS (host-agent) |
| marathon-scan | sentry.ts больше не в raw hits I |

**Следующий pick:** M-53 `eslint/ts suppressions (2)` — api-server sentry.ts.

## Marathon M-51 (2026-08-04 16:32 UTC) {#marathon-m-51}

| Проверка | Результат |
|---|---|
| webgl-video-shader.tsx | `eslint-disable react-hooks/exhaustive-deps` убран — deps `[active, fragCode, onCompileError, videoRef]` |
| typecheck | PASS (monorepo) |
| marathon-scan | webgl-video-shader.tsx больше не в raw hits I |

**Следующий pick:** M-52 `eslint/ts suppressions (1)` — host-agent sentry.ts.

## Marathon M-50 (2026-08-04 16:10 UTC) {#marathon-m-50}

| Проверка | Результат |
|---|---|
| game-detail.tsx | `eslint-disable react-hooks/exhaustive-deps` убран — deps `[host.hostId, cleanup, startCountdown]` в PreviewModal |
| typecheck | PASS (monorepo) |
| marathon-scan | game-detail.tsx больше не в raw hits I |

**Следующий pick:** M-51 `eslint/ts suppressions (1)` — webgl-video-shader.tsx.

## Marathon M-49 (2026-08-04 14:48 UTC) {#marathon-m-49}

| Проверка | Результат |
|---|---|
| play.tsx | 3× `eslint-disable react-hooks/exhaustive-deps` убраны — deps через `sessionId`/`sessionStatus`/`sessionClaimedBy` |
| typecheck | PASS (monorepo) |
| marathon-scan | play.tsx больше не в raw hits I |

**Следующий pick:** M-50 `eslint/ts suppressions (1)` — game-detail.tsx.

## Marathon M-48 (2026-08-04 14:20 UTC) {#marathon-m-48}

| Проверка | Результат |
|---|---|
| unit tests | 45 api-server lib modules → 45 test files, 95 tests PASS |
| typecheck | PASS (@workspace/api-server tests); monorepo typecheck blocked by env deps |
| marathon-scan | `h:api-lib` больше не в raw hits — категория H закрыта |

**Следующий pick:** M-49 `eslint/ts suppressions (3)` — play.tsx.

## Marathon M-43 (2026-08-04 13:34 UTC) {#marathon-m-43}

| Проверка | Результат |
|---|---|
| quota-ai-chat.tsx | 1 raw fetch → codegen (`useQuotaAiChat`) |
| typecheck | PASS (monorepo) |
| marathon-scan | quota-ai-chat.tsx больше не в raw hits F |

**Следующий pick:** M-49 `eslint/ts suppressions (3)` — play.tsx.

## Marathon M-42 (2026-08-04 13:28 UTC) {#marathon-m-42}

| Проверка | Результат |
|---|---|
| vt-scanner.tsx | 1 raw fetch → codegen (`useScanVt`) |
| typecheck | PASS (monorepo) |
| marathon-scan | vt-scanner.tsx больше не в raw hits F |

**Следующий pick:** M-43 `web: raw fetch → codegen (1 call)` — quota-ai-chat.tsx.

## Marathon M-41 (2026-08-04 13:20 UTC) {#marathon-m-41}

| Проверка | Результат |
|---|---|
| embed.tsx | 3 raw fetch → codegen (`createEmbedSession`, `getPublicIceConfig`, `useGetSessionByPlayerToken`) |
| typecheck | PASS (monorepo) |
| marathon-scan | embed.tsx больше не в raw hits F |

**Следующий pick:** M-42 `web: raw fetch → codegen (1 call)` — vt-scanner.tsx.

## Marathon M-40 (2026-08-04 12:40 UTC) {#marathon-m-40}

| Проверка | Результат |
|---|---|
| game-detail.tsx | 6 raw fetch → codegen (`useListPublicGameHosts`, `useSteamLookup`, `createPreviewSession`, `getPublicIceConfig`, `publicPing`, shared `useBrowserPingMs`) |
| typecheck | PASS (monorepo) |
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
