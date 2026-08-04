# DecentralHub Marathon — живой бэклог

> **Активный цикл:** Wave Maintenance (каждый run — scan + одна M-NN)  
> **Automation:** Cursor Automation `DecentralHub Marathon — следующий цикл`  
> **Cron (факт):** `0/2 * * * *` (каждые 2 мин) — **каждый run выполняет одну M-NN**, без интервального skip  
> **Cron (рекомендуемый):** пн/чт 09:00 UTC — `0 9 * * 1,4`  
> **Memory:** выключить в Automation — только этот файл в репо  
> **Хостинг / окна / тесты:** [HOSTING.md](./HOSTING.md)  
> **Последнее обновление:** 2026-08-04 (M-37 done; library.tsx codegen)

## Last run (automation)

| Поле | Значение |
|------|----------|
| Дата | 2026-08-04 09:10 UTC |
| Task ID | M-37 |
| Результат | library.tsx — apiFetch удалён; RAWG/Steam/submit/pending-config → codegen hooks |
| Commit | 7936dbf |

**Commit hash** в Last run — только при реальном изменении. Не делать отдельный commit «fix hash».

---

## Сейчас в очереди

**Основные циклы (1–4 + Wave UX/Regression):** agent-задач нет — idle.

**Wave Maintenance:** **12 M-NN pending** (M-38…M-53) — сканер расширен категориями F–I.

**Workflow:**
- `node scripts/marathon-groom.mjs --should-run [--mark-skipped]` — skip только при `pr_in_flight` или активном `in_progress`; **без** интервального recent_run
- `node scripts/marathon-groom.mjs --apply` — meta: phantom/stale/drift, лишние 161e0d7 → skip
- `node scripts/marathon-scan.mjs --sync-marathon` — обновить таблицу M-NN из сканера (группировка)
- `node scripts/marathon-scan.mjs --next` — первая **161e0d7** из таблицы
- Один M-NN **или** одно meta-улучшение за run → `done` → TESTLOG → push

### Blocked (human — не трогать automation)

| ID | Задача | Причина |
|----|--------|---------|
| C3-D03 | Windows E2E agent | TESTPLAN фаза 4 — GUI + SendInput |
| C4-S06 | TESTPLAN phase 6 | quotas/VDS/embed ручной прогон |
| C4-D02 | quotas/vds/embed | = C4-S06 |
| REG-03 | Windows manual | Wave Regression |

**Cycles 1–4 и Wave UX — agent-задачи завершены.** Wave Maintenance: **M-01…M-13 done**, **M-34+ pending** (сканер F–I).

---

## Как пользоваться

1. **Сначала** `git pull origin main` — работать только от актуального `main`.
2. **Source of truth = `main`.** Открытые PR / unmerged ветки **НЕ считаются сделанными**. Только код в `main`.
3. **Перед задачей — reconcile:** `node scripts/marathon-reconcile.mjs`.
   - Если скрипт говорит «SHOULD BE done» → запусти `--apply`, закоммить docs, push. **Код не трогать.**
   - Это защищает от дублей: задача уже в main, но MARATHON ещё 161e0d7.
4. В **активном цикле** возьми **одну** первую задачу со статусом `161e0d7`.
5. **Пропускай** `done`, `blocked`, `skipped`, `owner: human`.
6. **Перед кодом:** `git log --oneline main --grep="<ID>"` + `rg "<ключевая функция>"`. Если уже в main → только статус `done`, **без кода**.
7. **Не создавай новый PR, если работа уже есть в unmerged ветке.** Лучше cherry-pick/merge её в main, чем пересоздавать.
8. `in_progress` старше 24 ч → `161e0d7` или `blocked` с причиной.
9. Переведи в `in_progress` → acceptance → `done` или `blocked`.
10. Запиши в [TESTLOG.md](./TESTLOG.md). Верификация: `pnpm typecheck`, api/host-agent tests.
11. **CI — gate.** Если `pnpm typecheck` или tests красные → `done` НЕ ставить. Чини или `blocked`.
12. **Обязательно commit+push** `MARATHON.md` + `TESTLOG.md` (иначе следующий run повторит задачу).
13. **Код — push в `main` (docs/fixes) или один PR на задачу.** Не плодить DRAFT-дубли.
14. Нет новых M-NN в сканере → см. **idle-политику** ниже (не крутить пустые коммиты).

### Idle-политика (анти-500 пустых runs)

Когда `pendingMnn=0` и сканер `grouped=0`:

| idleStreak | Действие |
|------------|----------|
| 0–2 | **Анализ:** rg новых паттернов, `pnpm outdated`, `audit`, git log. Если нашёл → добавить в scan. Чисто → TESTLOG note, exit **без commit**. |
| ≥3 | **EXPAND SCANNER** — добавить категорию в `marathon-scan.mjs` (deps, audit, docs TODO, .env drift…) → `--sync-marathon` → commit. |
| pr_in_flight | Проверить жив ли PR; мёртв >1ч → закрыть, вернуть M-NN в pending. |

**Запрещено:** «Marathon idle» + commit Last run + exit. Это сжигание токенов.

**Статусы:** `161e0d7` | `in_progress` | `done` | `blocked` | `skipped`  
**Owner:** `agent` | `human`

### Контракт automation (жёсткие правила)

- **`done` = код в `main` + CI зелёный + acceptance пройден.** Docs-only `done` без кода = баг.
- **Старые задачи (C1–C4, UX, REG) со статусом `done` — НЕ ТРОГАТЬ.** Reconcile подтверждает evidence в main; повтор = баг.
- **M-NN со статусом `done`/`in_progress` — НЕ ТРОГАТЬ.** Сканер пропускает их по файлу.
- **Unmerged ветки ≠ done.** Если фикс в ветке, но не в main → не mark done.
- **Открытые PR игнорируются** при выборе задачи.
- **Reconcile в начале каждого run** (`--apply`) — только статусы, без кода.
- **Один канал доставки:** push в main. ~100 DRAFT-PR — superseded, не трогать.
- **Memory выключена** — только MARATHON.md + TESTLOG.md в репо.

### Анти-дубли (важно)

- Строки `*-F*` (fix-wave) **удалены** — дублировали `*-S*`. Не восстанавливать.
- `UX-08` = `C2-S05` skip-link — только в Wave UX как `skipped`.
- **Docs-only `done` без кода в main = баг.** Статус `done` только если acceptance проходит на `main`.
- **Unmerged ветки ≠ done.** Фикс в ветке без merge → `161e0d7` или merge, не mark done.
- **Reconcile (`scripts/marathon-reconcile.mjs --apply`) в начале run** — только статусы legacy-задач, без кода.
- **Сканер (`scripts/marathon-scan.mjs --next`)** — пропускает M-NN done/in_progress по файлу.
- **Legacy C*/UX*/REG* с `done` — automation НИКОГДА не берёт в работу** (нет 161e0d7 в основных циклах).
- **Открытые PR не делают задачу in_progress.** Automation выбирает по MARATHON, не по PR-списку.
- **~100 DRAFT-PR (2026-08-03) — superseded by merge-backlog `adc6fd3`.** Не закрывать вручную, не плодить новые.

### Самоулучшение (meta) — automation чинит сам процесс

Marathon **обязан** улучшать себя, если обнаружена лишняя работа, рассинхрон или баг процесса. Это **не** product-код — правки в `scripts/marathon-*.mjs`, `MARATHON.md`, `TESTLOG.md`.

**Каждый run (после reconcile, до --next):**
```bash
node scripts/marathon-groom.mjs --apply
```

| Сигнал | Что делать |
|--------|------------|
| `phantom_161e0d7` | 9a363c8 в таблице, сканер не видит → `skipped` (groom) |
| `stale_in_progress` | in_progress >24ч без коммита → `161e0d7` |
| `duplicate_161e0d7` | два 9a363c8 с одним Key → skip дубль |
| `done_but_active` | done, но сканер всё ещё видит → `161e0d7` (reopen) или **починить сканер** |
| `queue_drift` | сканер нашёл новое, таблица пуста → `--sync-marathon` |
| `raw_explosion` | raw/grouped >4× → улучшить группировку в `marathon-scan.mjs` |

**Когда править сканер/reconcile (а не M-NN задачу):**
- Ложное срабатывание (vendor `public/games/`, `isDev` console, ASCII `XXX`, неверный `/api` prefix) → exclusion в scan + `skipped` задачи
- Задача уже в `main`, но 161e0d7 → reconcile/groom, **без кода**
- «0 161e0d7» при непустой M-NN таблице → groom + sync, исправить текст в MARATHON

**Когда НЕ трогать meta:** product acceptance, blocked human, done legacy с evidence PASS.

**Лимит за run:** одно meta-улучшение **или** одна M-NN. Если groom нашёл `raw_explosion` / баг сканера — приоритет meta, M-NN отложить.

---

## Cycle 1 — API Server ✅

| ID | Задача | Priority | Status | Owner | Acceptance |
|----|--------|----------|--------|-------|------------|
| C1-S01 | Инвентаризация auth (URL/query vs headers) | P0 | done | agent | Таблица в TESTLOG #marathon-c1 |
| C1-S02 | SSE `/events/stream` auth + rate limit | P0 | done | agent | 401 без токена; limiter 30/min |
| C1-S03 | Объединить timingSafe модули | P1 | done | agent | Один timingSafe.ts |
| C1-S04 | Workers audit | P1 | done | agent | TESTLOG |
| C1-S05 | Signaling WS auth audit | P0 | done | agent | ws-ticket documented |
| C1-S06 | Storage ACL legacy public read | P1 | done | agent | Orphan 403; catalog public; **#164** |
| C1-S07 | Rate limits enrich + loans read | P2 | done | agent | enrichLimiter + readLimiter |
| C1-S08 | joinCodes deprecation | P2 | done | agent | Deprecation header |
| C1-D01 | Smoke + ledger | P0 | done | agent | CI |
| C1-D02 | Economy E2E | P1 | done | agent | vitest |
| C1-D03 | Security pass | P1 | done | agent | SSE closed |
| C1-F05 | Central auth middleware | P2 | done | agent | `lib/authMiddleware.ts` **#145** |

## Cycle 2 — Web UI ✅

| ID | Задача | Priority | Status | Owner |
|----|--------|----------|--------|-------|
| C2-S01 | Raw fetch audit | P1 | done | agent |
| C2-S02 | embed/admin codegen | P1 | done | agent | **#148** |
| C2-S03 | landing hosts dup | P2 | done | agent |
| C2-S04 | RU browser-play | P1 | done | agent |
| C2-S05 | a11y player + skip-link | P1 | done | agent |
| C2-S06 | /wallet route | P2 | done | agent |
| C2-S07 | shadcn sr-only RU | P3 | done | agent | **#94** |
| C2-S08 | nav Играть | P2 | done | agent |
| C2-D01 | pages-api-smoke | P1 | done | agent |
| C2-D02 | OpenAPI gaps | P1 | done | agent | **#102** |
| C2-D03 | invite flow | P1 | done | agent |

## Cycle 3 — Host Agent ✅ (agent; C3-D03 blocked human)

| ID | Задача | Priority | Status | Owner |
|----|--------|----------|--------|-------|
| C3-S01 | save zip traversal | P0 | done | agent |
| C3-S02 | pushSave confirm | P0 | done | agent |
| C3-S03 | focus-guard | P1 | done | agent |
| C3-S04 | captureMode native | P1 | done | agent |
| C3-S05 | limited-user launch | P2 | done | agent | **#130** |
| C3-S06 | RTMP drift | P2 | done | agent | **#130** |
| C3-S07 | ViGEm packaging | P2 | done | agent | **#130** |
| C3-S08 | renderer split | P3 | done | agent | **#131** |
| C3-D01 | unit tests | P1 | done | agent |
| C3-D02 | agent-api-smoke | P1 | done | agent |
| C3-D03 | Windows E2E | P0 | blocked | human |

## Cycle 4 — Cross-cutting ✅

| ID | Задача | Status | Owner |
|----|--------|--------|-------|
| C4-S01 | schema drift | done | agent |
| C4-S02 | OpenAPI parity | done | agent |
| C4-S03 | CI gaps | done | agent |
| C4-S04 | scripts parity | done | agent |
| C4-S05 | .env.example | done | agent |
| C4-S06 | TESTPLAN phase 6 | blocked | human |
| C4-S07 | api-client typecheck | done | agent |
| C4-S08 | dist hygiene | done | agent |
| C4-D01 | full regression | done | agent |
| C4-D02 | quotas/vds/embed | blocked | human |
| C4-D03 | CI hardening | done | agent |

## Wave UX ✅

| ID | Task | Status |
|----|------|--------|
| UX-01 | setup bind docs | done |
| UX-02 | dashboard agent | done |
| UX-03 | TURN/STUN hints | done | **#83** |
| UX-04 | wallet labels | done |
| UX-05 | quotas validation | done | **#83** |
| UX-06 | API errors RU | done | **#80** |
| UX-07 | spinner RU | done |
| UX-08 | skip-link | skipped | (= C2-S05, done) |

## Wave Regression ✅ (REG-03 blocked human)

| ID | Task | Status | Owner |
|----|------|--------|-------|
| REG-01 | typecheck + build | done | agent |
| REG-02 | smokes | done | agent |
| REG-03 | Windows manual | blocked | human |
| REG-04 | TESTLOG summary | done | agent |
| REG-05 | TESTPLAN 5-7 | done | agent |

## Wave Maintenance ← **активный** (automation-generated)

Automation **каждый run** создаёт и выполняет одну новую M-NN (если сканер нашёл кандидата).

### Правила самосоздания

1. **Каждый run:**
   - `node scripts/marathon-reconcile.mjs --apply` (только статусы legacy, без кода)
   - `node scripts/marathon-groom.mjs --apply` (meta: phantom/stale/drift — только MARATHON)
   - `node scripts/marathon-scan.mjs --sync-marathon` (обновить 161e0d7 из сканера, с группировкой)
   - `node scripts/marathon-scan.mjs --next` → первая **161e0d7** M-NN из таблицы
   - Если `idle: true` → `Marathon idle`, код не менять
   - Иначе: `in_progress` → выполни → `pnpm typecheck` → `done` + TESTLOG
2. **Один M-NN за run.**
3. **Никогда не повторять:** legacy `done`, M-NN `done`/`in_progress`, blocked human.
4. **Группировка:** C = по route-файлу; E/H = lib/renderer без тестов одной задачей; F = raw fetch по файлу; G = HOSTING backlog (H-NN); vendor `public/games/` и `isDev` console — исключены.
5. Приоритет категорий: B TODO → C OpenAPI → A RU → G HOSTING → F fetch → E renderer-тесты → H api-lib → D debug → I eslint.

### Очередь M-NN

| ID | Cat | Задача | Файл | Key | Status | Owner |
|----|-----|--------|------|-----|--------|-------|
| M-01 | C | OpenAPI gap: routes/downloads.ts (2 routes) | `routes/downloads.ts` | c:artifacts/api-server/src/routes/downloads.ts | done | agent |
| M-02 | C | OpenAPI gap: routes/enrich.ts (1 route) | `routes/enrich.ts` | c:artifacts/api-server/src/routes/enrich.ts | done | agent |
| M-03 | C | OpenAPI gap: routes/events.ts (1 route) | `routes/events.ts` | c:artifacts/api-server/src/routes/events.ts | done | agent |
| M-04 | C | OpenAPI gap: routes/hosts.ts (8 routes) | `routes/hosts.ts` | c:artifacts/api-server/src/routes/hosts.ts | done | agent |
| M-05 | C | OpenAPI gap: routes/players.ts (1 route) | `routes/players.ts` | c:artifacts/api-server/src/routes/players.ts | done | agent |
| M-06 | C | OpenAPI gap: routes/premium.ts (1 route) | `routes/premium.ts` | c:artifacts/api-server/src/routes/premium.ts | done | agent |
| M-07 | C | OpenAPI gap: routes/public.ts (1 route) | `routes/public.ts` | c:artifacts/api-server/src/routes/public.ts | done | agent |
| M-08 | C | OpenAPI gap: routes/sessions.ts (1 route) | `routes/sessions.ts` | c:artifacts/api-server/src/routes/sessions.ts | done | agent |
| M-09 | C | OpenAPI gap: routes/storage.ts (3 routes) | `routes/storage.ts` | c:artifacts/api-server/src/routes/storage.ts | done | agent |
| M-10 | C | OpenAPI gap: routes/submissions.ts (3 routes) | `routes/submissions.ts` | c:artifacts/api-server/src/routes/submissions.ts | done | agent |
| M-11 | C | OpenAPI gap: routes/vds.ts (5 routes) | `routes/vds.ts` | c:artifacts/api-server/src/routes/vds.ts | done | agent |
| M-12 | C | OpenAPI gap: routes/vt.ts (2 routes) | `routes/vt.ts` | c:artifacts/api-server/src/routes/vt.ts | done | agent |
| M-13 | E | host-agent renderer: unit-тесты (18 модулей) | `renderer/*.ts` | e:renderer | done | agent |
| M-44 | G | HOSTING H-01: Match по title, не HWND/PID | `HOSTING.md` | g:H-01 | done | agent |
| M-45 | G | HOSTING H-02: Browser watch: любой Chrome = alive | `HOSTING.md` | g:H-02 | done | agent |
| M-46 | G | HOSTING H-07: Unit tests capture/focus | `HOSTING.md` | g:H-07 | done | agent |
| M-47 | G | HOSTING H-08: HWND-based match после spawn | `HOSTING.md` | g:H-08 | done | agent |
| M-34 | F | web: raw fetch → codegen (3 calls) | `artifacts/web/src/pages/quota-new.tsx` | f:artifacts/web/src/pages/quota-new.tsx | done | agent |
| M-35 | F | web: raw fetch → codegen (2 calls) | `artifacts/web/src/pages/profile.tsx` | f:artifacts/web/src/pages/profile.tsx | done | agent |
| M-36 | F | web: raw fetch → codegen (6 calls) | `artifacts/web/src/pages/play.tsx` | f:artifacts/web/src/pages/play.tsx | done | agent |
| M-37 | F | web: raw fetch → codegen (1 call) | `artifacts/web/src/pages/host/library.tsx` | f:artifacts/web/src/pages/host/library.tsx | done | agent |
| M-38 | F | web: raw fetch → codegen (1 call) | `artifacts/web/src/pages/host/browser-play.tsx` | f:artifacts/web/src/pages/host/browser-play.tsx | pending | agent |
| M-39 | F | web: raw fetch → codegen (1 call) | `artifacts/web/src/pages/games.tsx` | f:artifacts/web/src/pages/games.tsx | pending | agent |
| M-40 | F | web: raw fetch → codegen (6 calls) | `artifacts/web/src/pages/game-detail.tsx` | f:artifacts/web/src/pages/game-detail.tsx | pending | agent |
| M-41 | F | web: raw fetch → codegen (3 calls) | `artifacts/web/src/pages/embed.tsx` | f:artifacts/web/src/pages/embed.tsx | pending | agent |
| M-42 | F | web: raw fetch → codegen (1 call) | `artifacts/web/src/components/vt-scanner.tsx` | f:artifacts/web/src/components/vt-scanner.tsx | pending | agent |
| M-43 | F | web: raw fetch → codegen (1 call) | `artifacts/web/src/components/quota-ai-chat.tsx` | f:artifacts/web/src/components/quota-ai-chat.tsx | pending | agent |
| M-48 | H | api-server lib: unit-тесты (45 модулей) | `artifacts/api-server/src/lib/*.ts` | h:api-lib | pending | agent |
| M-49 | I | eslint/ts suppressions (3) | `artifacts/web/src/pages/play.tsx` | i:artifacts/web/src/pages/play.tsx | pending | agent |
| M-50 | I | eslint/ts suppressions (1) | `artifacts/web/src/pages/game-detail.tsx` | i:artifacts/web/src/pages/game-detail.tsx | pending | agent |
| M-51 | I | eslint/ts suppressions (1) | `artifacts/web/src/components/webgl-video-shader.tsx` | i:artifacts/web/src/components/webgl-video-shader.tsx | pending | agent |
| M-52 | I | eslint/ts suppressions (1) | `artifacts/host-agent/src/main/sentry.ts` | i:artifacts/host-agent/src/main/sentry.ts | pending | agent |
| M-53 | I | eslint/ts suppressions (2) | `artifacts/api-server/src/lib/sentry.ts` | i:artifacts/api-server/src/lib/sentry.ts | pending | agent |


> Automation: `--sync-marathon` пересобирает 161e0d7 из сканера (сохраняет done/in_progress).
> `--next` берёт первую 161e0d7 из этой таблицы. При `done` — только смена Status.

---

## Automation prompt (вставить в Cursor Automations)

**Короткий (ЕДИНСТВЕННЫЙ — вставить в Automation trigger, заменить старый «Прочитай MARATHON»):**

> Готовый текст: **[MARATHON_AUTOMATION_PROMPT.txt](./MARATHON_AUTOMATION_PROMPT.txt)** — скопировать целиком в trigger.

> **ЗАПРЕЩЕНО при 161e0d7Mnn>0:** «Прочитай MARATHON.md», list-cloud-agents, automation_memory, анализ прошлых runs, правка промпта — это жжёт токены впустую. Скрипты уже дали pick.
> **Meta-улучшения** — при groom issues (phantom/stale/drift) **или** `reason: scanner_empty_expand` (3+ idle runs, сканер пуст).
> **pr_in_flight** — только non-DRAFT PR; DRAFT не блокирует.

**Полный:**
```
git pull origin main
node scripts/marathon-groom.mjs --should-run --mark-skipped || exit 0
# exit 2 = STOP: commit+push MARATHON если Result изменился; дальше НЕ идти
node scripts/marathon-reconcile.mjs --apply   # legacy done, БЕЗ кода
node scripts/marathon-groom.mjs --apply        # meta: phantom/stale/drift, только MARATHON
node scripts/marathon-scan.mjs --sync-marathon # обновить M-NN
# Коммитить ТОЛЬКО если git diff --quiet ≠ 0. Иначе exit без commit.
if git diff --quiet; then echo "no changes"; else git add -A && git commit -m "chore(marathon): groom+sync" && git push origin main; fi

PICK=$(node scripts/marathon-scan.mjs --next)
echo "$PICK"
# idle:true → НЕ коммитить Last run. reason=scanner_empty_expand → расширить сканер.
# pick.id → in_progress → код → pnpm typecheck → done + TESTLOG → commit.

Один M-NN или одно meta-улучшение за run. Push в main.
```

> **Важно:** cron каждые 2 мин — **не** блокировать run по интервалу. Skip только при **non-DRAFT** PR на next M-NN или активном in_progress.
