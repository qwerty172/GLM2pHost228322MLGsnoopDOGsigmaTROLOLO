# DecentralHub Marathon — живой бэклог

> **Активный цикл:** Wave UX — удобство и ранний ручной тест ([UX_BACKLOG.md](./UX_BACKLOG.md)), затем остатки техдолга  
> **Automation:** Cursor Automation `DecentralHub Marathon — следующий цикл`  
> **Cron (факт):** `0/2 * * * *` (каждые 2 мин) — **каждый run выполняет одну M-NN**, без интервального skip  
> **Cron (рекомендуемый):** пн/чт 09:00 UTC — `0 9 * * 1,4`  
> **Memory:** выключить в Automation — только этот файл в репо  
> **Хостинг / окна / тесты:** [HOSTING.md](./HOSTING.md)  
> **Ручной MVP-тест на Windows (не cloud):** [MVP_MANUAL_TEST.md](./MVP_MANUAL_TEST.md)  
> **Последнее обновление:** 2026-08-05 (M-135 done; link.test.ts)

## Last run (automation)

| Поле | Значение |
|------|----------|
| Дата | 2026-08-05 18:23 UTC|
| Task ID | M-166|
| Результат | U-24: PreSessionScreen на /play; PreSessionModal удалён; pnpm test 340 PASS|

**Поле Commit удалено навсегда.** Хэш коммита нельзя записать внутрь него самого — это породило 250+ коммитов «fix hash». Поиск задачи: `git log --grep="M-NN"`.

### Efficiency (auto)

| Метрика | 7d |
|---|---|
| feat(marathon) | 234 |
| commit-hash waste | 250 (52%) |
| task hit rate | 29% |
| idle draft PRs | 41 |
| pending M-NN | 16 |
| branch lag (ahead main) | 0 |

**Рекомендации:**
- `no_hash_commits`: 250 отдельных commit-hash за 7д — используй scripts/marathon-efficiency.mjs --update-last-run в том же коммите
- `close_idle_drafts`: 41 draft PR «Marathon idle» — закрыть: node scripts/marathon-efficiency.mjs --apply
- `low_hit_rate`: Hit rate 29% (234 feat / 815 marathon commits) — см. idle-политику и push main

---

## Сейчас в очереди

**Основные циклы (1–4 + Wave UX/Regression):** agent-задач нет — idle.

**Wave UX (текущий приоритет):** [UX_BACKLOG.md](./UX_BACKLOG.md) — путь к рабочему MVP («скачал → запустил → стримит»).
Добавлены новые P0-блокеры (U-31 `.exe` вместо ZIP+npm, U-32 честный тест токена) поверх guided-flow/self-check (U-13/U-14).
Категория **R** идёт в очереди раньше техдолга **по конструкции сканера** (`CAT_ORDER.R = -1`); пока открыт P0 — P1/P2 не берутся.

**Wave Maintenance (заморожено до исчерпания Wave UX):** auth-verifier тесты (M-136…M-139, категория **Q**) —
не трогать automation, пока в UX_BACKLOG.md остаётся хоть один `todo`. Покрытие тестами не двигает к MVP.

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

| Ситуация | Действие |
|------------|----------|
| pendingMnn>0 | **EXECUTE** первую M-NN — без анализа, без meta, без efficiency-отдельного-run |
| scanner_empty | **СНАЧАЛА пополнить [UX_BACKLOG.md](./UX_BACKLOG.md)** по § Генератор UX-задач (техдолг исчерпан → качаем удобство). Только если UX-бэклог тоже пуст — новая техническая категория в `marathon-scan.mjs`. |
| pr_in_flight | STOP или закрыть мёртвый PR >1ч |
| полный idle | `exit 3` — cron не поднимает агента вообще (экономия токенов) |

**Направление на текущем этапе (важнее покрытия тестами):** платформа должна стать пригодной для
**самостоятельного ручного теста владельцем** — меньше окон, меньше копипаста, меньше предварительных знаний.
Категория **R** (`UX_BACKLOG.md`) идёт в очереди **раньше** любых тестовых категорий; пока открыт **P0** — P1/P2 не берутся.

**Запрещено (все три петли из 1000+ пустых runs):**
1. **Idle-коммит** — «Marathon idle» + commit Last run (~300 мусорных коммитов 03.08)
2. **Hash-коммит** — «fix Last run commit hash» (~250 коммитов; поле Commit удалено)
3. **Работа не в main** — 529 из 541 PR остались unmerged; в конце run — merge своей ветки в main + push

**Efficiency:** `marathon-efficiency.mjs --apply` — **фоном в том же run** (§ Efficiency пишет только при изменении метрик). Никогда отдельный run.

**Last run:** `node scripts/marathon-last-run.mjs --task M-NN --result "..."` — **в том же коммите**, что feat.

**Дедуп:** groom сам флипает pending → done, если `feat(marathon): M-NN` уже в `origin/main` (`done_on_main`).

**Статусы:** `161e0d7` | `in_progress` | `done` | `blocked` | `skipped`  
**Owner:** `agent` | `human`

### Генератор UX-задач

Запускать, когда в [UX_BACKLOG.md](./UX_BACKLOG.md) не осталось строк со статусом `todo`.
Промпт ниже вставляется в composer как есть — он самодостаточный.

```
Ты работаешь в монорепо DecentralHub (/workspace) — P2P cloud gaming: хосты стримят игры
с Windows-ПК через WebRTC, игроки играют в браузере. Весь UI на русском.

ЦЕЛЬ: владелец проекта должен сам сесть и протестировать платформу от начала до конца,
не читая код и документацию. Твоя работа — найти, что этому мешает, и выписать задачи.

ЧТО ЦЕНИМ (в порядке важности):
1. Меньше окон, приложений и переключений контекста.
2. Меньше ручного копипаста (токены, URL, пути к файлам) — система должна подставлять сама.
3. Меньше предварительных знаний (что такое квота, LZT, hostToken, invite-код).
4. Меньше шагов до результата: «скачал → запустил → играю» вместо чек-листа из 15 пунктов.
5. Понятные состояния: загрузка, пусто, ошибка — по-русски и с понятным следующим действием.
6. Обновление без переустановки: версия видна, совместимость проверяется заранее, обновление — одной кнопкой.
7. Самодиагностика: одна проверка отвечает «можно тестировать?» и предлагает ровно одно действие при проблеме.

ГЛАВНЫЕ МЕТРИКИ (сначала измерь текущий поток, затем формулируй задачу):
- `stepsToStream` — действия от нового аккаунта хоста до первого видео у игрока;
- `surfaceCount` — окна/приложения/вкладки на этом пути;
- `manualInputCount` — ручные токены, URL, пути, коды и повторный ввод данных;
- `deadEndCount` — ошибки/пустые состояния без понятного следующего действия;
- `updateSteps` — действия от сообщения о новой версии до запуска обновлённого агента.

ЦЕЛЕВОЙ ПОРЯДОК: первый стрим без документации, максимум браузер + агент,
ноль ручных токенов/URL, одна кнопка диагностики, обновление без повторного ZIP.

СДЕЛАЙ:
1. Пройди реальные потоки по коду (не выдумывай):
   - Хост: artifacts/web/src/pages/host/*, artifacts/web/src/components/host-auth-guard.tsx,
     artifacts/host-agent/src/renderer/*, artifacts/host-agent/src/main/*,
     artifacts/api-server/src/routes/downloads.ts
   - Игрок: artifacts/web/src/pages/{landing,games,game-detail,hosts,play,wallet,profile}.tsx,
     artifacts/web/src/components/*
2. Для каждого потока посчитай: сколько кликов, экранов, окон, ручных вводов до результата.
3. Найди места, где: дублируется функциональность; основное действие спрятано в свёрнутом блоке;
   показывается технический текст; десктоп и мобила ведут себя по-разному; нужен ручной путь к файлу.
4. Отдельно проверь установку/обновление/диагностику: версия агента, `autoUpdater`, `/ping`,
   heartbeat, telemetry, совместимость API ↔ agent и безопасный экспорт диагностики.
   Не предлагай «добавить» уже существующий механизм — найди, почему он не виден или не завершает
   пользовательский поток, и сформулируй задачу на результат.
5. Выпиши 8–12 задач в таблицу формата UX_BACKLOG.md:

| U-NN | P0|P1|P2 | Задача | `путь/к/файлу.tsx`, `второй/файл.ts` | Критерий готовности | todo |

ПРАВИЛА ЗАДАЧ:
- Одна задача = один связный результат, выполнимый за один прогон агента.
- Заголовок описывает РЕЗУЛЬТАТ для пользователя, не рефакторинг.
  Хорошо: «Токен хоста вшит в скачиваемый агент — ноль копипаста».
  Плохо: «Улучшить UX онбординга», «Отрефакторить dashboard.tsx».
- Критерий готовности проверяемый: что увидит/сделает пользователь, чтобы понять «готово».
  Хорошо: «После start.bat агент уже привязан, поле токена не показывается».
  Плохо: «Стало удобнее».
- В критерии укажи измеримое «было → стало» хотя бы по одной метрике:
  `stepsToStream`, `surfaceCount`, `manualInputCount`, `deadEndCount` или `updateSteps`.
- Пакет задач формируй по порядку: P0 первого теста → P1 обновления/диагностика →
  P2 визуальная и мобильная полировка. Не генерируй P2, если найден новый P0.
- Файлы — реальные пути из репозитория, в обратных кавычках.
- P0 = блокирует первый самостоятельный тест. P1 = тест возможен, но больно. P2 = полировка.
- Нумерацию продолжай от последнего U-NN в файле, не переиспользуй ID.
- Не дублируй задачи со статусом done в UX_BACKLOG.md.

ОГРАНИЧЕНИЯ ПРОЕКТА (соблюдать):
- UI на русском; технические идентификаторы на английском.
- Типы API только из lib/api-client-react / lib/api-zod (не писать руками).
- Роутинг — wouter; UI — shadcn/ui + Tailwind v4; иконки lucide-react; тосты sonner.
- Логирование на сервере — pino, не console.log.
- Не редактировать lib/api-client-react/src/ и lib/api-zod/src/ (автогенерат).

РЕЗУЛЬТАТ: только строки таблицы для вставки в UX_BACKLOG.md. Без вступлений и рассуждений.
```

После генерации: вставить строки в `UX_BACKLOG.md` → `node scripts/marathon-scan.mjs --sync-marathon`
→ один коммит `feat(marathon): пополнить UX_BACKLOG (N задач)` → merge в `main`.

### Контракт automation (жёсткие правила)

- **`done` = код в `main` + CI зелёный + acceptance пройден.** Docs-only `done` без кода = баг.
- **Старые задачи (C1–C4, UX, REG) со статусом `done` — НЕ ТРОГАТЬ.** Reconcile подтверждает evidence в main; повтор = баг.
- **M-NN со статусом `done`/`in_progress` — НЕ ТРОГАТЬ.** Сканер пропускает их по файлу.
- **Unmerged ветки ≠ done.** Если фикс в ветке, но не в main → не mark done.
- **Задача категории R (UX):** статус меняется в **двух** местах — `M-NN → done` в MARATHON.md **и** `U-NN: todo → done` в [UX_BACKLOG.md](./UX_BACKLOG.md). Если забыть второе, groom увидит `done_but_active` и вернёт задачу в очередь.
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
- **~240+ open DRAFT PR (legacy)** — **ИГНОР навсегда.** Не закрывать, не мержить, не тратить run. Блокирует только **non-draft** PR на текущую M-NN (`pr_in_flight`).

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
| M-38 | F | web: raw fetch → codegen (1 call) | `artifacts/web/src/pages/host/browser-play.tsx` | f:artifacts/web/src/pages/host/browser-play.tsx | done | agent |
| M-40 | F | web: raw fetch → codegen (6 calls) | `artifacts/web/src/pages/game-detail.tsx` | f:artifacts/web/src/pages/game-detail.tsx | done | agent |
| M-41 | F | web: raw fetch → codegen (3 calls) | `artifacts/web/src/pages/embed.tsx` | f:artifacts/web/src/pages/embed.tsx | done | agent |
| M-42 | F | web: raw fetch → codegen (1 call) | `artifacts/web/src/components/vt-scanner.tsx` | f:artifacts/web/src/components/vt-scanner.tsx | done | agent |
| M-49 | I | eslint/ts suppressions (3) | `artifacts/web/src/pages/play.tsx` | i:artifacts/web/src/pages/play.tsx | done | agent |
| M-50 | I | eslint/ts suppressions (1) | `artifacts/web/src/pages/game-detail.tsx` | i:artifacts/web/src/pages/game-detail.tsx | done | agent |
| M-51 | I | eslint/ts suppressions (1) | `artifacts/web/src/components/webgl-video-shader.tsx` | i:artifacts/web/src/components/webgl-video-shader.tsx | done | agent |
| M-52 | I | eslint/ts suppressions (1) | `artifacts/host-agent/src/main/sentry.ts` | i:artifacts/host-agent/src/main/sentry.ts | done | agent |
| M-53 | I | eslint/ts suppressions (2) | `artifacts/api-server/src/lib/sentry.ts` | i:artifacts/api-server/src/lib/sentry.ts | done | agent |
| M-54 | J | host-agent main: unit-тест (app-launcher.ts) | `artifacts/host-agent/src/main/app-launcher.ts` | j:artifacts/host-agent/src/main/app-launcher.ts | done | agent |
| M-55 | J | host-agent main: unit-тест (crypto-key.ts) | `artifacts/host-agent/src/main/crypto-key.ts` | j:artifacts/host-agent/src/main/crypto-key.ts | done | agent |
| M-56 | J | host-agent main: unit-тест (gamepad-injection.ts) | `artifacts/host-agent/src/main/gamepad-injection.ts` | j:artifacts/host-agent/src/main/gamepad-injection.ts | done | agent |
| M-57 | J | host-agent main: unit-тест (input-injection.ts) | `artifacts/host-agent/src/main/input-injection.ts` | j:artifacts/host-agent/src/main/input-injection.ts | done | agent |
| M-58 | J | host-agent main: unit-тест (limited-user-launch.ts) | `artifacts/host-agent/src/main/limited-user-launch.ts` | j:artifacts/host-agent/src/main/limited-user-launch.ts | done | agent |
| M-59 | J | host-agent main: unit-тест (logger.ts) | `artifacts/host-agent/src/main/logger.ts` | j:artifacts/host-agent/src/main/logger.ts | done | agent |
| M-60 | J | host-agent main: unit-тест (rtmp-relay.ts) | `artifacts/host-agent/src/main/rtmp-relay.ts` | j:artifacts/host-agent/src/main/rtmp-relay.ts | done | agent |
| M-61 | J | host-agent main: unit-тест (save-paths.ts) | `artifacts/host-agent/src/main/save-paths.ts` | j:artifacts/host-agent/src/main/save-paths.ts | done | agent |
| M-62 | J | host-agent main: unit-тест (save-sync.ts) | `artifacts/host-agent/src/main/save-sync.ts` | j:artifacts/host-agent/src/main/save-sync.ts | done | agent |
| M-63 | J | host-agent main: unit-тест (sentry.ts) | `artifacts/host-agent/src/main/sentry.ts` | j:artifacts/host-agent/src/main/sentry.ts | done | agent |
| M-64 | J | host-agent main: unit-тест (spawn-hwnd.ts) | `artifacts/host-agent/src/main/spawn-hwnd.ts` | j:artifacts/host-agent/src/main/spawn-hwnd.ts | done | agent |
| M-65 | J | host-agent main: unit-тест (steam-scanner.ts) | `artifacts/host-agent/src/main/steam-scanner.ts` | j:artifacts/host-agent/src/main/steam-scanner.ts | done | agent |
| M-66 | J | host-agent main: unit-тест (tray.ts) | `artifacts/host-agent/src/main/tray.ts` | j:artifacts/host-agent/src/main/tray.ts | done | agent |
| M-67 | J | host-agent main: unit-тест (wake-scheduler.ts) | `artifacts/host-agent/src/main/wake-scheduler.ts` | j:artifacts/host-agent/src/main/wake-scheduler.ts | done | agent |
| M-68 | K | host-agent shared: unit-тест (input.ts) | `artifacts/host-agent/src/shared/input.ts` | k:artifacts/host-agent/src/shared/input.ts | done | agent |
| M-69 | L | web lib: unit-тест (agent-local.ts) | `artifacts/web/src/lib/agent-local.ts` | l:artifacts/web/src/lib/agent-local.ts | done | agent |
| M-70 | L | web lib: unit-тест (api-errors.ts) | `artifacts/web/src/lib/api-errors.ts` | l:artifacts/web/src/lib/api-errors.ts | done | agent |
| M-71 | L | web lib: unit-тест (ice-prewarm.ts) | `artifacts/web/src/lib/ice-prewarm.ts` | l:artifacts/web/src/lib/ice-prewarm.ts | done | agent |
| M-72 | L | web lib: unit-тест (put-external-blob.ts) | `artifacts/web/src/lib/put-external-blob.ts` | l:artifacts/web/src/lib/put-external-blob.ts | done | agent |
| M-73 | L | web lib: unit-тест (quota-compatibility.ts) | `artifacts/web/src/lib/quota-compatibility.ts` | l:artifacts/web/src/lib/quota-compatibility.ts | done | agent |
| M-74 | L | web lib: unit-тест (sentry.ts) | `artifacts/web/src/lib/sentry.ts` | l:artifacts/web/src/lib/sentry.ts | done | agent |
| M-75 | L | web lib: unit-тест (utils.ts) | `artifacts/web/src/lib/utils.ts` | l:artifacts/web/src/lib/utils.ts | done | agent |
| M-76 | M | web hooks: unit-тест (use-platform-events.ts) | `artifacts/web/src/hooks/use-platform-events.ts` | m:artifacts/web/src/hooks/use-platform-events.ts | done | agent |
| M-77 | L | web lib: unit-тест (connection-labels.ts) | `artifacts/web/src/lib/connection-labels.ts` | l:artifacts/web/src/lib/connection-labels.ts | done | agent |
| M-78 | M | web hooks: unit-тест (use-auth.tsx) | `artifacts/web/src/hooks/use-auth.tsx` | m:artifacts/web/src/hooks/use-auth.tsx | done | agent |
| M-79 | M | web hooks: unit-тест (use-mobile.tsx) | `artifacts/web/src/hooks/use-mobile.tsx` | m:artifacts/web/src/hooks/use-mobile.tsx | done | agent |
| M-80 | M | web hooks: unit-тест (use-player-wallet.tsx) | `artifacts/web/src/hooks/use-player-wallet.tsx` | m:artifacts/web/src/hooks/use-player-wallet.tsx | done | agent |
| M-81 | N | web components: unit-тест (KeyboardOverlay.tsx) | `artifacts/web/src/components/KeyboardOverlay.tsx` | n:artifacts/web/src/components/KeyboardOverlay.tsx | done | agent |
| M-82 | N | web components: unit-тест (TouchOverlay.tsx) | `artifacts/web/src/components/TouchOverlay.tsx` | n:artifacts/web/src/components/TouchOverlay.tsx | done | agent |
| M-83 | N | web components: unit-тест (host-auth-guard.tsx) | `artifacts/web/src/components/host-auth-guard.tsx` | n:artifacts/web/src/components/host-auth-guard.tsx | done | agent |
| M-84 | N | web components: unit-тест (layout.tsx) | `artifacts/web/src/components/layout.tsx` | n:artifacts/web/src/components/layout.tsx | done | agent |
| M-85 | N | web components: unit-тест (quota-ai-chat.tsx) | `artifacts/web/src/components/quota-ai-chat.tsx` | n:artifacts/web/src/components/quota-ai-chat.tsx | done | agent |
| M-86 | N | web components: unit-тест (site-nav.tsx) | `artifacts/web/src/components/site-nav.tsx` | n:artifacts/web/src/components/site-nav.tsx | done | agent |
| M-87 | N | web components: unit-тест (vt-scanner.tsx) | `artifacts/web/src/components/vt-scanner.tsx` | n:artifacts/web/src/components/vt-scanner.tsx | done | agent |
| M-88 | N | web components: unit-тест (wallet-history.tsx) | `artifacts/web/src/components/wallet-history.tsx` | n:artifacts/web/src/components/wallet-history.tsx | done | agent |
| M-89 | N | web components: unit-тест (webgl-video-shader.tsx) | `artifacts/web/src/components/webgl-video-shader.tsx` | n:artifacts/web/src/components/webgl-video-shader.tsx | done | agent |
| M-90 | O | web pages: unit-тест (admin/games) | `pages/admin/games.tsx` | o:artifacts/web/src/pages/admin/games.tsx | done | agent |
| M-91 | O | web pages: unit-тест (embed) | `pages/embed.tsx` | o:artifacts/web/src/pages/embed.tsx | done | agent |
| M-92 | O | web pages: unit-тест (exchange) | `pages/exchange.tsx` | o:artifacts/web/src/pages/exchange.tsx | done | agent |
| M-93 | O | web pages: unit-тест (game-detail) | `pages/game-detail.tsx` | o:artifacts/web/src/pages/game-detail.tsx | done | agent |
| M-94 | O | web pages: unit-тест (games) | `pages/games.tsx` | o:artifacts/web/src/pages/games.tsx | done | agent |
| M-95 | O | web pages: unit-тест (host/binding-form) | `pages/host/binding-form.tsx` | o:artifacts/web/src/pages/host/binding-form.tsx | done | agent |
| M-96 | O | web pages: unit-тест (host/browser-play) | `pages/host/browser-play.tsx` | o:artifacts/web/src/pages/host/browser-play.tsx | done | agent |
| M-97 | O | web pages: unit-тест (host/dashboard) | `pages/host/dashboard.tsx` | o:artifacts/web/src/pages/host/dashboard.tsx | done | agent |
| M-98 | O | web pages: unit-тест (host/library) | `pages/host/library.tsx` | o:artifacts/web/src/pages/host/library.tsx | done | agent |
| M-99 | O | web pages: unit-тест (host/setup) | `pages/host/setup.tsx` | o:artifacts/web/src/pages/host/setup.tsx | done | agent |
| M-100 | O | web pages: unit-тест (hosts) | `pages/hosts.tsx` | o:artifacts/web/src/pages/hosts.tsx | done | agent |
| M-101 | O | web pages: unit-тест (landing) | `pages/landing.tsx` | o:artifacts/web/src/pages/landing.tsx | done | agent |
| M-102 | O | web pages: unit-тест (play) | `pages/play.tsx` | o:artifacts/web/src/pages/play.tsx | done | agent |
| M-103 | O | web pages: unit-тест (profile) | `pages/profile.tsx` | o:artifacts/web/src/pages/profile.tsx | done | agent |
| M-104 | O | web pages: unit-тест (quota-detail) | `pages/quota-detail.tsx` | o:artifacts/web/src/pages/quota-detail.tsx | done | agent |
| M-105 | O | web pages: unit-тест (quotas) | `pages/quotas.tsx` | o:artifacts/web/src/pages/quotas.tsx | done | agent |
| M-106 | O | web pages: unit-тест (wallet) | `pages/wallet.tsx` | o:artifacts/web/src/pages/wallet.tsx | done | agent |
| M-107 | P | api-server routes: unit-тест (admin.ts) | `routes/admin.ts` | p:artifacts/api-server/src/routes/admin.ts | done | agent |
| M-108 | P | api-server routes: unit-тест (agentAuth.ts) | `routes/agentAuth.ts` | p:artifacts/api-server/src/routes/agentAuth.ts | done | agent |
| M-109 | P | api-server routes: unit-тест (agentTelemetry.ts) | `routes/agentTelemetry.ts` | p:artifacts/api-server/src/routes/agentTelemetry.ts | done | agent |
| M-110 | P | api-server routes: unit-тест (auth.ts) | `routes/auth.ts` | p:artifacts/api-server/src/routes/auth.ts | done | agent |
| M-111 | P | api-server routes: unit-тест (devKeys.ts) | `routes/devKeys.ts` | p:artifacts/api-server/src/routes/devKeys.ts | done | agent |
| M-112 | P | api-server routes: unit-тест (downloads.ts) | `routes/downloads.ts` | p:artifacts/api-server/src/routes/downloads.ts | done | agent |
| M-113 | P | api-server routes: unit-тест (embed.ts) | `routes/embed.ts` | p:artifacts/api-server/src/routes/embed.ts | done | agent |
| M-114 | P | api-server routes: unit-тест (enrich.ts) | `routes/enrich.ts` | p:artifacts/api-server/src/routes/enrich.ts | done | agent |
| M-115 | P | api-server routes: unit-тест (events.ts) | `routes/events.ts` | p:artifacts/api-server/src/routes/events.ts | done | agent |
| M-116 | P | api-server routes: unit-тест (games.ts) | `routes/games.ts` | p:artifacts/api-server/src/routes/games.ts | done | agent |
| M-117 | P | api-server routes: unit-тест (health.ts) | `routes/health.ts` | p:artifacts/api-server/src/routes/health.ts | done | agent |
| M-118 | P | api-server routes: unit-тест (hosts.ts) | `routes/hosts.ts` | p:artifacts/api-server/src/routes/hosts.ts | done | agent |
| M-119 | P | api-server routes: unit-тест (joinCodes.ts) | `routes/joinCodes.ts` | p:artifacts/api-server/src/routes/joinCodes.ts | done | agent |
| M-120 | P | api-server routes: unit-тест (loans.ts) | `routes/loans.ts` | p:artifacts/api-server/src/routes/loans.ts | done | agent |
| M-121 | P | api-server routes: unit-тест (players.ts) | `routes/players.ts` | p:artifacts/api-server/src/routes/players.ts | done | agent |
| M-122 | P | api-server routes: unit-тест (premium.ts) | `routes/premium.ts` | p:artifacts/api-server/src/routes/premium.ts | done | agent |
| M-123 | P | api-server routes: unit-тест (public.ts) | `routes/public.ts` | p:artifacts/api-server/src/routes/public.ts | done | agent |
| M-124 | P | api-server routes: unit-тест (quotaAiChat.ts) | `routes/quotaAiChat.ts` | p:artifacts/api-server/src/routes/quotaAiChat.ts | done | agent |
| M-125 | P | api-server routes: unit-тест (quotas.ts) | `routes/quotas.ts` | p:artifacts/api-server/src/routes/quotas.ts | done | agent |
| M-126 | P | api-server routes: unit-тест (saves.ts) | `routes/saves.ts` | p:artifacts/api-server/src/routes/saves.ts | done | agent |
| M-127 | P | api-server routes: unit-тест (sessions.ts) | `routes/sessions.ts` | p:artifacts/api-server/src/routes/sessions.ts | done | agent |
| M-128 | P | api-server routes: unit-тест (storage.ts) | `routes/storage.ts` | p:artifacts/api-server/src/routes/storage.ts | done | agent |
| M-129 | P | api-server routes: unit-тест (submissions.ts) | `routes/submissions.ts` | p:artifacts/api-server/src/routes/submissions.ts | done | agent |
| M-130 | P | api-server routes: unit-тест (vds.ts) | `routes/vds.ts` | p:artifacts/api-server/src/routes/vds.ts | done | agent |
| M-131 | P | api-server routes: unit-тест (verifier.ts) | `routes/verifier.ts` | p:artifacts/api-server/src/routes/verifier.ts | done | agent |
| M-132 | P | api-server routes: unit-тест (vt.ts) | `routes/vt.ts` | p:artifacts/api-server/src/routes/vt.ts | done | agent |
| M-133 | P | api-server routes: unit-тест (wallet.ts) | `routes/wallet.ts` | p:artifacts/api-server/src/routes/wallet.ts | done | agent |
| M-134 | Q | auth-verifier: unit-тест (challenge.ts) | `auth-verifier/challenge.ts` | q:lib/auth-verifier/src/challenge.ts | done | agent |
| M-135 | Q | auth-verifier: unit-тест (link.ts) | `auth-verifier/link.ts` | q:lib/auth-verifier/src/link.ts | done | agent |
| M-140 | R | UX U-01 (P0): Platform URL в агенте заполняется сам — не вводить руками | `routes/downloads.ts` | r:U-01 | done | agent |
| M-141 | R | UX U-02 (P0): Токен хоста вшит в скачиваемый агент — ноль копипаста | `routes/downloads.ts` | r:U-02 | done | agent |
| M-142 | R | UX U-03 (P0): «Выйти в онлайн» на главном экране агента, не в свёрнутых на | `renderer/*.ts` | r:U-03 | done | agent |
| M-143 | R | UX U-04 (P0): Выбор `.exe` через файловый диалог вместо ручного пути | `pages/host/library.tsx` | r:U-04 | done | agent |
| M-144 | R | UX U-05 (P0): Квик-старт показывает реальное состояние, а не «шаг 1 всегда | `pages/host/dashboard-helpers.ts` | r:U-05 | done | agent |
| M-145 | R | UX U-20 (P0): «Играть» ведёт в одно и то же место на десктопе и мобиле | `artifacts/web/src/components/site-nav.tsx` | r:U-20 | done | agent |
| M-146 | R | UX U-21 (P0): Кнопка «Играть сейчас» подбирает хост сама — без выбора из с | `pages/landing.tsx` | r:U-21 | done | agent |
| M-147 | R | UX U-31 (P0): Кнопка «Скачать агент» отдаёт готовый `.exe`, а не ZIP с Nod | `routes/downloads.ts` | r:U-31 | done | agent |
| M-148 | R | UX U-32 (P0): Тест реально проверяет, что hostToken лежит внутри ZIP, а не | `routes/downloads.test.ts` | r:U-32 | done | agent |
| M-149 | R | UX U-13 (P0): Дашборд всегда показывает одно следующее действие до первого | `pages/host/dashboard.tsx` | r:U-13 | done | agent |
| M-150 | R | UX U-14 (P0): «Проверить готовность» проверяет весь путь хоста одной кнопк | `pages/host/dashboard.tsx` | r:U-14 | done | agent |
| M-136 | Q | auth-verifier: unit-тест (otp.ts) | `auth-verifier/otp.ts` | q:lib/auth-verifier/src/otp.ts | done | agent |
| M-151 | R | UX U-06 (P1): Один способ привязки агента вместо трёх | `pages/host/dashboard.tsx` | r:U-06 | done | agent |
| M-152 | R | UX U-07 (P1): Убрать дублирующий legacy BindingForm с ценами в USD | `pages/host/binding-form.tsx` | r:U-07 | done | agent |
| M-153 | R | UX U-08 (P1): Кнопка «Войти на сайте» в агенте открывает существующий марш | `artifacts/host-agent/src/main/index.ts` | r:U-08 | done | agent |
| M-154 | R | UX U-09 (P1): Возврат хоста по сохранённому токену — поле «у меня уже есть | `artifacts/web/src/components/host-auth-guard.tsx` | r:U-09 | done | agent |
| M-155 | R | UX U-10 (P1): Библиотека и «быстрое добавление игры» — один компонент | `pages/host/add-game-modal.tsx` | r:U-10 | done | agent |
| M-156 | R | UX U-11 (P2): Русский язык во всём UI агента | `renderer/*.ts` | r:U-11 | done | agent |
| M-157 | R | UX U-12 (P2): INSTALL.txt и подсказки дашборда описывают один и тот же пот | `artifacts/host-agent/INSTALL.txt` | r:U-12 | done | agent |
| M-158 | R | UX U-33 (P1): Порты файрвола согласованы между документацией и кодом | `artifacts/host-agent/INSTALL.txt` | r:U-33 | done | agent |
| M-160 | R | UX U-16 (P1): Обновление агента видно и устанавливается одной кнопкой | `artifacts/host-agent/src/main/index.ts` | r:U-16 | done | agent |
| M-159 | R | UX U-15 (P1): Версия агента берётся из сборки, а не из захардкоженной стро | `artifacts/host-agent/src/main/index.ts` | r:U-15 | done | agent |
| M-161 | R | UX U-17 (P1): Несовместимая версия агента объясняется до запуска стрима | `routes/hosts.ts` | r:U-17 | done | agent |
| M-162 | R | UX U-18 (P1): Единая карточка диагностики вместо разрозненных heartbeat и  | `pages/host/dashboard.tsx` | r:U-18 | done | agent |
| M-163 | R | UX U-19 (P1): Диагностический отчёт копируется одной кнопкой без секретов | `pages/host/dashboard.tsx` | r:U-19 | done | agent |
| M-164 | R | UX U-22 (P1): Лендинг не прячет блок, когда онлайн-хостов нет | `pages/landing.tsx` | r:U-22 | done | agent |
| M-165 | R | UX U-23 (P1): Выбор игры у хоста — раскрывающийся список вместо модалки | `pages/hosts.tsx` | r:U-23 | done | agent |
| M-166 | R | UX U-24 (P1): Один экран подготовки сессии вместо модалки и дубля на `/pla | `pages/game-detail.tsx` | r:U-24 | done | agent |
| M-167 | R | UX U-25 (P1): Экранная клавиатура включена по умолчанию на тач-устройствах | `pages/play.tsx` | r:U-25 | pending | agent |
| M-168 | R | UX U-26 (P1): Никаких технических терминов в сообщениях игроку | `pages/play-helpers.ts` | r:U-26 | pending | agent |
| M-169 | R | UX U-27 (P2): Баланс LZT виден на мобиле | `artifacts/web/src/components/site-nav.tsx` | r:U-27 | pending | agent |
| M-170 | R | UX U-28 (P2): В каталоге у офлайн-игр честная подпись и путь дальше | `pages/games.tsx` | r:U-28 | pending | agent |
| M-171 | R | UX U-29 (P2): Фильтры каталога доступны на мобиле | `pages/games.tsx` | r:U-29 | pending | agent |
| M-172 | R | UX U-30 (P2): Понятная первая минута: сколько стоит и что такое LZT | `pages/game-detail.tsx` | r:U-30 | pending | agent |
| M-137 | Q | auth-verifier: unit-тест (providers/discord.ts) | `auth-verifier/providers/discord.ts` | q:lib/auth-verifier/src/providers/discord.ts | pending | agent |
| M-138 | Q | auth-verifier: unit-тест (providers/telegram.ts) | `auth-verifier/providers/telegram.ts` | q:lib/auth-verifier/src/providers/telegram.ts | pending | agent |
| M-139 | Q | auth-verifier: unit-тест (router.ts) | `auth-verifier/router.ts` | q:lib/auth-verifier/src/router.ts | pending | agent |


> Automation: `--sync-marathon` пересобирает 161e0d7 из сканера (сохраняет done/in_progress).
> `--next` берёт первую 161e0d7 из этой таблицы. При `done` — только смена Status.
> **Порядок важен:** сначала статус M-NN → `done` в этой таблице, **потом** `--sync-marathon`.
> Если сделать наоборот (сперва U-NN → done в UX_BACKLOG.md) — строка M-NN тихо исчезнет из
> таблицы вместо флипа в done (найдено на M-147/M-148, см. TESTLOG).

---

## Automation prompt (вставить в Cursor Automations)

**Короткий (ЕДИНСТВЕННЫЙ — вставить в Automation trigger, заменить старый «Прочитай MARATHON»):**

> Готовый текст: **[MARATHON_AUTOMATION_PROMPT.txt](./MARATHON_AUTOMATION_PROMPT.txt)** — скопировать целиком в trigger.

> **ЗАПРЕЩЕНО при 161e0d7Mnn>0:** «Прочитай MARATHON.md», list-cloud-agents, automation_memory, анализ прошлых runs, правка промпта — это жжёт токены впустую. Скрипты уже дали pick.
> **Meta-улучшения** — ТОЛЬКО при `scanner_empty` (immediate expand) **или** groom issues. При `pendingMnn>0` self-improvement = burn.
> **Efficiency** — `marathon-efficiency.mjs --apply` **фоном в том же run** (§ Efficiency); **никогда** отдельный run.
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
