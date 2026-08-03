# DecentralHub Marathon — живой бэклог

> **Активный цикл:** Wave Maintenance (automation-generated, каждый 2-й run)  
> **Automation:** Cursor Automation `DecentralHub Marathon — следующий цикл` (cron **пн/чт 09:00 UTC** — `0 9 * * 1,4`)  
> **Memory:** выключить в Automation — только этот файл в репо  
> **Хостинг / окна / тесты:** [HOSTING.md](./HOSTING.md)  
> **Последнее обновление:** 2026-08-03 (Wave Maintenance + scan/reconcile scripts)

## Last run (automation)

| Поле | Значение |
|------|----------|
| Дата | 2026-08-03 10:53 UTC |
| Task ID | idle |
| Результат | idle — reconcile PASS (14/14), все изменения в main зачтены |
| Commit | b9578c3 |

> Automation: **обновляй эту таблицу** в конце каждого запуска.

---

## Сейчас в очереди (pending)

**Основные циклы (1–4 + Wave UX/Regression):** agent-задач нет — idle.

**Wave Maintenance** (каждый 2-й run automation сам создаёт M-NN через `scripts/marathon-scan.mjs`):
- ~145 кандидатов (TODO/FIXME, OpenAPI gaps, RU-строки, debug leftovers, нет тестов)
- Один за run → `done` → TESTLOG → push

### Blocked (human — не трогать automation)

| ID | Задача | Причина |
|----|--------|---------|
| C3-D03 | Windows E2E agent | TESTPLAN фаза 4 — GUI + SendInput |
| C4-S06 | TESTPLAN phase 6 | quotas/VDS/embed ручной прогон |
| C4-D02 | quotas/vds/embed | = C4-S06 |
| REG-03 | Windows manual | Wave Regression |

**Cycles 1–4 и Wave UX — agent-задачи завершены.** Следующий agent-run → Wave Maintenance (scan) или idle.

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
14. Нет pending agent-задач → `Marathon idle`, код не менять.

**Статусы:** `pending` | `in_progress` | `done` | `blocked` | `skipped`  
**Owner:** `agent` | `human`

### Контракт automation (жёсткие правила)

- **`done` = код в `main` + CI зелёный + acceptance пройден.** Docs-only `done` без кода = баг.
- **Unmerged ветки ≠ done.** Если фикс в ветке, но не в main → `pending` или merge, не mark done.
- **Открытые PR игнорируются automation** при выборе задачи. Они не делают задачу «in_progress».
- **Reconcile перед задачей** — обязательный шаг, предотвращает дубли.
- **Один канал доставки:** push в main (docs/small fixes) или один PR (крупные). ~100 DRAFT-PR от 2026-08-03 — superseded, не трогать.
- **Memory выключена** — только MARATHON.md + TESTLOG.md в репо.

**Статусы:** `pending` | `in_progress` | `done` | `blocked` | `skipped`  
**Owner:** `agent` | `human`

### Анти-дубли (важно)

- Строки `*-F*` (fix-wave) **удалены** — дублировали `*-S*`. Не восстанавливать.
- `UX-08` = `C2-S05` skip-link — только в Wave UX как `skipped`.
- **Docs-only `done` без кода в main = баг.** Статус `done` только если acceptance проходит на `main`.
- **Unmerged ветки ≠ done.** Фикс в ветке без merge → `pending` или merge, не mark done.
- **Reconcile (`scripts/marathon-reconcile.mjs`) перед каждой задачей** — закрывает рассинхрон.
- **Открытые PR не делают задачу in_progress.** Automation выбирает по MARATHON, не по PR-списку.
- **~100 DRAFT-PR (2026-08-03) — superseded by merge-backlog `adc6fd3`.** Не закрывать вручную, не плодить новые.

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

Automation **сам создаёт** задачи здесь каждый **второй** запуск (когда нет pending в основных циклах).

### Правила самосоздания

1. **Каждый второй run** (чередование: run N = reconcile/idle, run N+1 = scan+create+do):
   - `node scripts/marathon-scan.mjs` → список кандидатов (ID `M-NN`)
   - Возьми **одного** кандидата (по приоритету: B TODO/FIXME → C OpenAPI gap → A RU-строка → E нет теста → D debug)
   - Добавь строку в таблицу ниже со статусом `in_progress`
   - Выполни, верифицируй (`pnpm typecheck`), `done` + строка в TESTLOG.md
2. **Один M-NN за run.** Не плодить пачку.
3. **Skip** кандидатов, которые уже есть в таблице как `done`/`in_progress`.
4. Если сканер пуст → `Marathon idle`.
5. Категории: `A`=RU-строки, `B`=TODO/FIXME, `C`=OpenAPI gap, `D`=debug leftover, `E`=нет теста.

### Очередь M-NN

| ID | Cat | Задача | Файл | Status | Owner |
|----|-----|--------|------|--------|-------|
| — | — | *(сканер `scripts/marathon-scan.mjs` добавит строки сюда)* | — | — | — |

> Automation: при создании задачи замени последнюю строку-плейсхолдер на реальную M-NN.
> При `done` оставь строку, добавь новую ниже.

---

## Automation prompt (вставить в Cursor Automations)

```
git pull origin main
node scripts/marathon-reconcile.mjs --apply   # закрывает рассинхрон pending vs main
git add MARATHON.md TESTLOG.md && git commit -m "chore(marathon): reconcile" && git push origin main || true
Прочитай MARATHON.md. Активный цикл в заголовке. Memory выключена.

РЕЖИМ ЗАПУСКА (чередование каждый второй run):
- Нечётный run (1,3,5…): если нет pending в основных циклах → "Marathon idle", код не трогать.
- Чётный run (2,4,6…): Wave Maintenance — САМ СОЗДАЁШЬ задачу:
    1. node scripts/marathon-scan.mjs            # список кандидатов M-NN
    2. Возьми ОДНОГО (приоритет: B TODO → C OpenAPI gap → A RU → E тест → D debug)
    3. Пропускай M-NN, уже done/in_progress в таблице Wave Maintenance
    4. Добавь строку в MARATHON.md (Wave Maintenance) со статусом in_progress
    5. Выполни, верифицируй (pnpm typecheck), → done + строка в TESTLOG.md
    6. Если сканер пуст → "Marathon idle"

ВЫБОР ЗАДАЧИ (основные циклы, если есть pending):
- Пропускай done, blocked, skipped, owner: human.
- Первая pending в АКТИВНОМ цикле.
- git log --oneline main --grep="<ID>" — если уже в main, только статус done, без кода.
- rg ключевые символы задачи в main — не дублируй unmerged ветки.
- Открытые PR игнорируй. Они не делают задачу in_progress.

ВЫПОЛНЕНИЕ:
1. in_progress → acceptance → pnpm typecheck && api/host-agent tests
2. done/blocked + строка в TESTLOG.md
3. Обнови таблицу "Last run" в MARATHON.md

ОБЯЗАТЕЛЬНО (иначе повтор на следующем cron):
git add MARATHON.md TESTLOG.md
git commit -m "chore(marathon): <ID> <кратко>"
git push origin main

Код — push в main или один PR. Не создавай DRAFT-дубли. Открытые PR не трогать.
Один M-NN за run. Не плодить пачку.
```
