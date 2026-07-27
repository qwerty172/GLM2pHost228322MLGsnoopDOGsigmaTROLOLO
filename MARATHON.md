# DecentralHub — MARATHON

> Очередь задач для часового Cursor Automation. Агент читает этот файл, берёт **первую задачу со статусом `pending`**, реализует, помечает `done`, обновляет [TESTLOG.md](./TESTLOG.md), коммитит и пушит.

## Правила для агента

1. Прочитай этот файл в начале каждого запуска.
2. Возьми **одну** первую задачу со статусом `pending` (сверху вниз).
3. После реализации: `pnpm typecheck` (или целевой пакет), обнови TESTLOG.
4. Поменяй статус задачи на `done` с кратким примечанием.
5. Коммит + `git push -u origin <ветка>`.
6. Если задача требует Windows/Electron — оставь `manual` и переходи к следующей.

Контекст: соглашения в `.cursorrules`, полный бэклог в [PLAN.md](./PLAN.md), тест-план в [TESTPLAN.md](./TESTPLAN.md).

---

## Прогресс по неделям

| Неделя | Тема | Статус | Итог |
|--------|------|--------|------|
| W1–W2 | Локальный тест, P2P, агент | done | Фазы 0–4 TESTPLAN verified (Windows) |
| W3 | dedup API | done | inviteCode канон, joinCode deprecated, ws-ticket |
| W4 | UX агента | done | `--bind-code`, setup banner, port discovery |
| W5 | infra | done | `.env.example`, worker math tests, unified CI |
| W6 | Биллинг блоков + экономика | in progress | см. очередь ниже |

---

## Очередь задач

| ID | PLAN | Задача | Статус | Примечание |
|----|------|--------|--------|------------|
| W6-1 | 1.6 | Точный остаток блочного времени после F5 | done | `blockMinsRemaining` в OpenAPI, enrichSession, play HUD |
| W6-2 | 1.7 | Идемпотентность block reconnect (интеграционный тест) | pending | два reclaim → одно списание |
| W6-3 | 3.5 | История блочных списаний в кошельке | pending | одна строка за блок |
| W6-4 | 3.8 | Economy E2E тест на тестовой БД | pending | deposit → play → credit → withdraw |
| W6-5 | 3.1 | Авто-воркер крипто-выплат | pending | pending withdrawals → retry worker |
| W6-6 | 2.3 | Отзыв ключа агента с дашборда | pending | revoke + UX «ключ отозван» |
| W6-7 | 1.10 | Уведомление «любимая игра снова онлайн» | pending | подписка + поллинг + Web Notifications |
| W6-8 | 1.9 | Пере-замер пинга в каталоге каждые 60с | pending | hosts.tsx, game-detail.tsx |
| W6-9 | 2.7 | Валидация обложек ≥300×170 | pending | submissions + storage |
| W6-10 | 3.4 | API `credit-settings` + toggle в профиле | pending | маршрут отсутствует |

---

## Формат обновления

После выполнения задачи добавь строку в TESTLOG (матрица проверок):

```
| **marathon W6-1 block timer** | **done** | blockMinsRemaining в OpenAPI, enrichSession, play HUD |
```

И измени статус в таблице выше на `done`.
