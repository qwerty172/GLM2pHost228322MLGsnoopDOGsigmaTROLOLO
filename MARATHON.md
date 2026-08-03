# DecentralHub Marathon — живой бэклог

> **Активный цикл:** Cycle 4 — Cross-cutting (первая pending: **C4-S02**)  
> **Automation:** Cursor Automation `DecentralHub Marathon — следующий цикл` (cron **пн/чт 09:00 UTC** — `0 9 * * 1,4`)  
> **Memory:** выключить в Automation — только этот файл в репо  
> **Хостинг / окна / тесты:** [HOSTING.md](./HOSTING.md)  
> **Последнее обновление:** 2026-08-03 (merge backlog: 11 задач → main)

## Last run (automation)

| Поле | Значение |
|------|----------|
| Дата | 2026-08-03 |
| Task ID | merge-backlog |
| Результат | done |
| Commit | merge: C1-F05, C2-S07/D02, C3-S05–S08, UX-03/05/06 → main |

> Automation: **обновляй эту таблицу** в конце каждого запуска.

---

## Сейчас в очереди (pending)

### Cycle 4 ← **активный** (1 pending agent)

1. `C4-S02` — OpenAPI parity (полная: admin/auth/agent/dev routes)

### Blocked (human — не трогать automation)

| ID | Задача | Причина |
|----|--------|---------|
| C3-D03 | Windows E2E agent | TESTPLAN фаза 4 — GUI + SendInput |
| C4-S06 | TESTPLAN phase 6 | quotas/VDS/embed ручной прогон |
| C4-D02 | quotas/vds/embed | = C4-S06 |
| REG-03 | Windows manual | Wave Regression |

**Cycles 1–3 и Wave UX — agent-задачи завершены.** Следующий agent-run → C4-S02 или `Marathon idle`.

---

## Как пользоваться

1. **Сначала** `git pull origin main` — работать только от актуального `main`.
2. В **активном цикле** возьми **одну** первую задачу со статусом `pending`.
3. **Пропускай** `done`, `blocked`, `skipped`, `owner: human`.
4. **Перед кодом:** `git log --oneline main --grep="<ID>"` — если уже в main, только статус `done`, **без кода**.
5. **Проверь код:** `rg "<ключевая функция>" main` — не дублируй работу из unmerged веток.
6. `in_progress` старше 24 ч → `pending` или `blocked` с причиной.
7. Переведи в `in_progress` → acceptance → `done` или `blocked`.
8. Запиши в [TESTLOG.md](./TESTLOG.md). Верификация: `pnpm typecheck`, api/host-agent tests.
9. **Обязательно commit+push** `MARATHON.md` + `TESTLOG.md`.
10. **Код — push в `main` или один PR.** Закрой дубли «superseded by #N».
11. Нет pending agent-задач → `Marathon idle`, код не менять.

**Статусы:** `pending` | `in_progress` | `done` | `blocked` | `skipped`  
**Owner:** `agent` | `human`

### Анти-дубли (важно)

- Строки `*-F*` (fix-wave) **удалены** — дублировали `*-S*`. Не восстанавливать.
- `UX-08` = `C2-S05` skip-link — только в Wave UX как `skipped`.
- **Docs-only `done` без кода в main = баг.** Статус `done` только если acceptance проходит на `main`.
- **Unmerged ветки ≠ done.** Если фикс в ветке, но не в main → `pending` или merge, не mark done.
- **Один PR/merge на задачу.** ~100 DRAFT-PR закрыты 2026-08-03 (superseded by merge-backlog).

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

## Cycle 4 — Cross-cutting ← **активный**

| ID | Задача | Status | Owner |
|----|--------|--------|-------|
| C4-S01 | schema drift | done | agent |
| C4-S02 | OpenAPI parity | pending | agent |
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

---

## Automation prompt (вставить в Cursor Automations)

```
git pull origin main
Прочитай MARATHON.md. Активный цикл в заголовке. Memory выключена.

ВЫБОР ЗАДАЧИ (одна за запуск):
- Пропускай done, blocked, skipped, owner: human.
- Первая pending в АКТИВНОМ цикле (сейчас Cycle 4 → C4-S02).
- git log --oneline main --grep="<ID>" — если уже в main, только статус done, без кода.
- rg ключевые символы задачи в main — не дублируй unmerged ветки.
- Если in_progress = Last run ID — продолжи; in_progress >24ч → pending/blocked.
- Нет pending agent-задач → "Marathon idle", код не трогать.

ВЫПОЛНЕНИЕ:
1. in_progress → acceptance → pnpm typecheck && api/host-agent tests
2. done/blocked + строка в TESTLOG.md
3. Обнови таблицу "Last run" в MARATHON.md

ОБЯЗАТЕЛЬНО (иначе повтор на следующем cron):
git add MARATHON.md TESTLOG.md
git commit -m "chore(marathon): <ID> <кратко>"
git push origin main

Код — push в main или один PR. Не создавай DRAFT-дубли. Закрой superseded PR.
```
