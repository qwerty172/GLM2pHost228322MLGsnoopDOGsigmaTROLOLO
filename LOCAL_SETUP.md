# Локальный запуск на своём ПК

> Команды вводятся **на вашем компьютере** (cmd, Git Bash, Terminal в Cursor).
> Cursor Agent чинит код; вы проверяете в браузере.

Полный план тестирования: [TESTPLAN.md](./TESTPLAN.md). Журнал багов: [TESTLOG.md](./TESTLOG.md).

---

## Ты здесь

Если у вас уже работает:

| Проверка | URL |
|---|---|
| API | http://localhost:8080/api/healthz → `{"status":"ok"}` |
| Web | http://localhost:5000 |

**→ Фазы 0–1 пройдены. Переходите к [TESTPLAN § Фаза 2](./TESTPLAN.md#фаза-2--web-обход-всех-страниц--сейчас).**

Быстрый чек перед обходом страниц:

1. F12 → **Network** на :5000 — нет красных `/api`?
2. Откройте http://localhost:5000/games — видна **Rogue Fable III**?
3. Пройдите таблицу URL из TESTPLAN §2.2; баги — в TESTLOG

Если healthz **не** ok — сначала [Быстрый старт](#быстрый-старт) ниже.

---

## Быстрый старт

**Две команды:**

```bash
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git
cd GLM2pHost228322MLGsnoopDOGsigmaTROLOLO
pnpm setup
pnpm dev
```

| Сервис | URL |
|---|---|
| Web | http://localhost:5000 |
| API health | http://localhost:8080/api/healthz |

`pnpm setup` автоматически:
- поднимает PostgreSQL + Redis через Docker (если установлен Docker Desktop);
- создаёт `.env` из шаблона;
- генерирует `WALLET_ENCRYPTION_KEY` и `JWT_SECRET`;
- ставит зависимости и применяет схему БД.

**На потом:** `pnpm setup -- --full` (с typecheck), TURN/coturn, Windows-агент, внешние API-ключи.

### Требования

- [Node.js 20+](https://nodejs.org/)
- [pnpm](https://pnpm.io/installation): `npm install -g pnpm`
- **Docker Desktop** (рекомендуется) — Postgres поднимается сам  
  *или* [PostgreSQL 16](https://www.postgresql.org/download/) вручную + правка `DATABASE_URL` в `.env`

### Windows (cmd)

Те же команды работают в cmd/PowerShell:

```bat
pnpm setup
pnpm dev
```

Или напрямую: `scripts\setup-local.bat` → `scripts\dev-local.bat`

### Smoke-тест и демо

```bash
./scripts/smoke-api.sh
pnpm demo    # тест-сессия + ссылка (нужен запущенный pnpm dev)
```

---

## Роли

| Кто | Задача |
|---|---|
| **Вы** | Браузер, 2 окна WebRTC, Electron-агент, скрины/console при багах |
| **Agent** | Фиксы в коде, TESTPLAN/TESTLOG, smoke при необходимости |

Не нужно заново clone/setup, если healthz ok и `pnpm dev` уже запущен.
