# DecentralHub Marathon — живой бэклог

> **Активный цикл:** Wave Maintenance (каждый run — scan + одна M-NN)  
> **Automation:** Cursor Automation `DecentralHub Marathon — следующий цикл`  
> **Cron (факт):** `0/2 * * * *` (каждые 2 мин) — **каждый run выполняет одну M-NN**, без интервального skip  
> **Cron (рекомендуемый):** пн/чт 09:00 UTC — `0 9 * * 1,4`  
> **Memory:** выключить в Automation — только этот файл в репо  
> **Хостинг / окна / тесты:** [HOSTING.md](./HOSTING.md)  
> **Последнее обновление:** 2026-08-03 (M-13 done; host-agent renderer unit tests)

## Last run (automation)

| Поле | Значение |
|------|----------|
| Дата | 2026-08-03 19:12 UTC |
| Task ID | idle |
| Результат | Marathon idle |
| Commit | fe81f70 |

> Automation: **обновляй эту таблицу** в конце каждого запуска.

---

## Сейчас в очереди

**Основные циклы (1–4 + Wave UX/Regression):** agent-задач нет — idle.

**Wave Maintenance:** **Marathon idle** — сканер пуст, все M-NN закрыты.

**Workflow:**
- `node scripts/marathon-groom.mjs --should-run [--mark-skipped]` — skip только при `pr_in_flight` или активном `in_progress`; **без** интервального recent_run
- `node scripts/marathon-groom.mjs --apply` — meta: phantom/stale/drift, лишние pending → skip
- `node scripts/marathon-scan.mjs --sync-marathon` — обновить таблицу M-NN из сканера (группировка)
- `node scripts/marathon-scan.mjs --next` — первая **pending** из таблицы
- Один M-NN **или** одно meta-улучшение за run → `done` → TESTLOG → push

### Blocked (human — не трогать automation)

| ID | Задача | Причина |
|----|--------|---------|
| C3-D03 | Windows E2E agent | TESTPLAN фаза 4 — GUI + SendInput |
| C4-S06 | TESTPLAN phase 6 | quotas/VDS/embed ручной прогон |
| C4-D02 | quotas/vds/embed | = C4-S06 |
| REG-03 | Windows manual | Wave Regression |

**Cycles 1–4 и Wave UX — agent-задачи завершены.** Wave Maintenance: **M-01…M-13 done** — Marathon idle.

---

## Как пользоваться

1. **Сначала** `git pull origin main` — работать только от актуального `main`.
2. **Source of truth = `main`.** Открытые PR / unmerged ветки **НЕ считаются сделанными**. Только код в `main`.
3. **Перед задачей — reconcile:** `node scripts/marathon-reconcile.mjs`.
   - Если скрипт говорит «SHOULD BE done» → запусти `--apply`, закоммить docs, push. **Код не трогать.**
   - Это защищает от дублей: задача уже в main, но MARATHON ещё pending.
4. В **активном цикле** возьми **одну** первую задачу со статусом `pending`.
5. **Пропускай** `done`, `blocked`, `skipped`, `owner: human`.
6. **Перед кодом:** `git log --oneline main --grep="<ID>"` + `rg "<ключевая функция>"`. Если уже в main → только статус `done`, **без кода**.
7. **Не создавай новый PR, если работа уже есть в unmerged ветке.** Лучше cherry-pick/merge её в main, чем пересоздавать.
8. `in_progress` старше 24 ч → `pending` или `blocked` с причиной.
9. Переведи в `in_progress` → acceptance → `done` или `blocked`.
10. Запиши в [TESTLOG.md](./TESTLOG.md). Верификация: `pnpm typecheck`, api/host-agent tests.
11. **CI — gate.** Если `pnpm typecheck` или tests красные → `done` НЕ ставить. Чини или `blocked`.
12. **Обязательно commit+push** `MARATHON.md` + `TESTLOG.md` (иначе следующий run повторит задачу).
13. **Код — push в `main` (docs/fixes) или один PR на задачу.** Не плодить DRAFT-дубли.
14. Нет новых M-NN в сканере → `Marathon idle`, код не менять.

**Статусы:** `pending` | `in_progress` | `done` | `blocked` | `skipped`  
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
- **Unmerged ветки ≠ done.** Фикс в ветке без merge → `pending` или merge, не mark done.
- **Reconcile (`scripts/marathon-reconcile.mjs --apply`) в начале run** — только статусы legacy-задач, без кода.
- **Сканер (`scripts/marathon-scan.mjs --next`)** — пропускает M-NN done/in_progress по файлу.
- **Legacy C*/UX*/REG* с `done` — automation НИКОГДА не берёт в работу** (нет pending в основных циклах).
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
| `phantom_pending` | pending в таблице, сканер не видит → `skipped` (groom) |
| `stale_in_progress` | in_progress >24ч без коммита → `pending` |
| `duplicate_pending` | два pending с одним Key → skip дубль |
| `done_but_active` | done, но сканер всё ещё видит → `pending` (reopen) или **починить сканер** |
| `queue_drift` | сканер нашёл новое, таблица пуста → `--sync-marathon` |
| `raw_explosion` | raw/grouped >4× → улучшить группировку в `marathon-scan.mjs` |

**Когда править сканер/reconcile (а не M-NN задачу):**
- Ложное срабатывание (vendor `public/games/`, `isDev` console, ASCII `XXX`, неверный `/api` prefix) → exclusion в scan + `skipped` задачи
- Задача уже в `main`, но pending → reconcile/groom, **без кода**
- «0 pending» при непустой M-NN таблице → groom + sync, исправить текст в MARATHON

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
   - `node scripts/marathon-scan.mjs --sync-marathon` (обновить pending из сканера, с группировкой)
   - `node scripts/marathon-scan.mjs --next` → первая **pending** M-NN из таблицы
   - Если `idle: true` → `Marathon idle`, код не менять
   - Иначе: `in_progress` → выполни → `pnpm typecheck` → `done` + TESTLOG
2. **Один M-NN за run.**
3. **Никогда не повторять:** legacy `done`, M-NN `done`/`in_progress`, blocked human.
4. **Группировка:** C = по route-файлу; E = все renderer-модули одной задачей; vendor `public/games/` и `isDev` console — исключены.
5. Приоритет категорий: B TODO → C OpenAPI → A RU → E тест → D debug.

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


> Automation: `--sync-marathon` пересобирает pending из сканера (сохраняет done/in_progress).
> `--next` берёт первую pending из этой таблицы. При `done` — только смена Status.

---

## Automation prompt (вставить в Cursor Automations)

**Короткий (ЕДИНСТВЕННЫЙ — вставить в Automation trigger, заменить старый «Прочитай MARATHON»):**

> Готовый текст: **[MARATHON_AUTOMATION_PROMPT.txt](./MARATHON_AUTOMATION_PROMPT.txt)** — скопировать целиком в trigger.

> **ЗАПРЕЩЕНО при pendingMnn>0:** «Прочитай MARATHON.md», list-cloud-agents, automation_memory, анализ прошлых runs, правка промпта — это жжёт токены впустую. Скрипты уже дали pick.
> **Meta-улучшения** — только если groom нашёл phantom/stale/drift/raw_explosion **и** pending=0.
> **pr_in_flight** — только non-DRAFT PR; DRAFT не блокирует.

**Полный:**
```
git pull origin main
node scripts/marathon-groom.mjs --should-run --mark-skipped || exit 0   # skip: pr_in_flight / in_progress (НЕ recent_run)
# exit 2 = STOP: commit+push MARATHON если Result изменился; дальше НЕ идти
node scripts/marathon-reconcile.mjs --apply   # legacy done, БЕЗ кода
node scripts/marathon-groom.mjs --apply        # meta: phantom/stale/drift, только MARATHON
node scripts/marathon-scan.mjs --sync-marathon # обновить pending M-NN
git add MARATHON.md && git commit -m "chore(marathon): groom+sync" && git push origin main || true
Прочитай MARATHON.md. Memory выключена.

КАЖДЫЙ RUN:
0. `node scripts/marathon-groom.mjs --should-run --mark-skipped || exit 0` — exit 2 только pr_in_flight/in_progress.
1. Legacy done/blocked/skipped — НЕ ТРОГАТЬ.
2. groom --apply: если raw_explosion или баг сканера → почини marathon-scan.mjs, skip ложные задачи, commit meta.
3. node scripts/marathon-scan.mjs --next
   - idle:true → Marathon idle, обнови Last run, выход.
   - иначе pick = первая pending M-NN.
4. Перед кодом: gh pr list + rg/git log — если уже в main → done без кода; если в открытом PR → cherry-pick в main.
5. in_progress → выполни → pnpm typecheck → done + TESTLOG.
6. Обнови Last run. commit && push.

Один M-NN или одно meta-улучшение за run. Push в main.
```

> **Важно:** cron каждые 2 мин — **не** блокировать run по интервалу. Skip только при **non-DRAFT** PR на next M-NN или активном in_progress.
