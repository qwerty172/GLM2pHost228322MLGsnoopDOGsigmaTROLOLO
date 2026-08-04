# Marathon — product backlog из веток и PR

> Источник для категории **J** в `marathon-scan.mjs`.  
> Задачи появляются здесь из: открытых DRAFT PR, транскриптов cloud agents, `PLAN.md` / `REDESIGN.md`.  
> Формат строки: `| groupKey | title | file/ref | detail |`

| groupKey | title | file/ref | detail |
|----------|-------|----------|--------|
| j:merge-quickstart | Консолидация quickstart PR (#281+#288+#262) | `package.json`, `scripts/` | Два агента сделали ~80% одного; объединить `/demo`, `readyz`, `pnpm quickstart` |
| j:demo-readyz | /demo + GET /api/readyz вместе | `artifacts/web`, `artifacts/api-server` | Взять `/demo` из #281 и `/readyz`+`wait-ready.sh` из #288 |
| j:host-exit-listeners | host-agent: stale onGameExited IPC listeners | `artifacts/host-agent` | Cross-session teardown; commit+тест из critical-bug run |
| j:merge-pr267 | Merge: relaunch при смене target (stale PID) | PR #267 | Игра A→B стримит B, не зависший PID |
| j:merge-pr263 | Merge: browser-watch teardown + false positives | PR #263 | Billing не течёт после закрытия вкладки |
| j:merge-pr277 | Merge: X-User-Token на /players/me/* | PR #277 | credit-settings после codegen M-35 |
| j:merge-pr265 | Merge: палитра Ctrl+K (базовая) | PR #265 | Играть/каталог/хост/агент/ссылка — «сейчас» |
| j:command-palette-later | Ctrl+K: кошелёк, профиль, библиотека, биржа, квоты | `artifacts/web` | «Потом» из PR #265 — после merge базовой палитры |
| j:host-dashboard-focus | Host dashboard: focus mode на первом входе | `artifacts/web/src/pages/host` | Только «Создать тест-сессию» до первой сессии |
| j:wallet-history-context | История кошелька: контекст игры + группировка | `wallet-history.tsx` | REDESIGN D.2 — схлопнуть минутные тики сессии |
| j:profile-empty-state | Профиль: живой empty-state для нового игрока | `profile.tsx` | REDESIGN D.3 — не пугать «зарегистрируйся хостом» |
| j:infra-up-all | pnpm infra:up:all — Redis + coturn | `scripts/`, `infra/` | «На потом» из quickstart PR #288 |
| j:play-ws-ticket-fallback | play.tsx: не silent fallback на legacy token при 401 | `play.tsx` | 401/403 ws-ticket → явная ошибка UI |
| j:browser-capture-privacy | findBrowserCaptureSource: не захватывать чужое окно Chrome | `host-agent renderer` | Только вкладка игры, не первый Chrome |
