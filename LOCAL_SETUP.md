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

## Быстрый старт

### Вариант A — одна команда (рекомендуется)

Нужны: Node 20+, pnpm, [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git
cd GLM2pHost228322MLGsnoopDOGsigmaTROLOLO
pnpm quickstart
```

Windows: `scripts\quickstart.bat`

Скрипт сам: поднимет Postgres + Redis в Docker, создаст `.env` с секретами, применит схему БД, запустит API и Web.

| Сервис | URL |
|---|---|
| Web | http://localhost:5000 |
| API | http://localhost:8080/api/healthz |
| Хост | http://localhost:5000/host |

**Уже настроено?** `pnpm dev`

---

### Вариант B — свой PostgreSQL (без Docker)

```bat
copy .env.example .env
:: отредактируй DATABASE_URL если не стандартный Docker
scripts\setup-local.bat
scripts\dev-local.bat
```

Linux/macOS/Git Bash:

```bash
cp .env.example .env
pnpm setup
pnpm dev
```

---

## Роли

| Кто | Задача |
|---|---|
| **Вы** | Браузер, 2 окна WebRTC, Electron-агент, скрины/console при багах |
| **Agent** | Фиксы в коде, TESTPLAN/TESTLOG, smoke при необходимости |

Не нужно заново clone/setup, если healthz ok и `dev-local.bat` уже запущен.
