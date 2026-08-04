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

Если healthz **не** ok — сначала [Быстрый старт](#быстрый-старт-windows) ниже.

---

## Куда вводить команды (Windows)

1. [Git for Windows](https://git-scm.com/download/win) — если нет `git`
2. **Git Bash**, **cmd** или **Windows Terminal** (Win+R → `cmd`)
3. Или **Cursor → Terminal → New Terminal** в папке проекта

## Требования

- [Node.js 20+](https://nodejs.org/) (рекомендуется 22 — см. `.nvmrc`)
- [pnpm](https://pnpm.io/installation): `npm install -g pnpm`
- **Вариант A:** [Docker](https://docs.docker.com/get-docker/) — `pnpm db:up` поднимет PostgreSQL
- **Вариант B:** [PostgreSQL 16](https://www.postgresql.org/download/windows/) вручную

База при ручной установке:

```sql
CREATE DATABASE decentral_hub;
```

---

## Быстрый старт (Windows)

```bat
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git
cd GLM2pHost228322MLGsnoopDOGsigmaTROLOLO

pnpm db:up
scripts\setup-local.bat
scripts\dev-local.bat
scripts\smoke-api.bat
```

Секреты (`WALLET_ENCRYPTION_KEY`, `JWT_SECRET`) генерируются автоматически.  
`DATABASE_URL` по умолчанию совпадает с Docker: `decentral_hub:decentral_hub@localhost:5432/decentral_hub`.

Если свой PostgreSQL — отредактируй `DATABASE_URL` в `.env` после setup.

| Сервис | URL |
|---|---|
| Web | http://localhost:5000 |
| API health | http://localhost:8080/api/healthz |

---

## Быстрый старт (Git Bash / Linux / macOS)

```bash
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git
cd GLM2pHost228322MLGsnoopDOGsigmaTROLOLO

pnpm db:up
pnpm setup
pnpm dev
pnpm smoke
```

Или через make: `make db-up && make setup && make dev`

---

## Роли

| Кто | Задача |
|---|---|
| **Вы** | Браузер, 2 окна WebRTC, Electron-агент, скрины/console при багах |
| **Agent** | Фиксы в коде, TESTPLAN/TESTLOG, smoke при необходимости |

Не нужно заново clone/setup, если healthz ok и `dev-local.bat` уже запущен.
