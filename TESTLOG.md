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

## Marathon efficiency v3 — разбор 1000+ runs (2026-08-05 09:35 UTC) {#marathon-efficiency-v3}

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
