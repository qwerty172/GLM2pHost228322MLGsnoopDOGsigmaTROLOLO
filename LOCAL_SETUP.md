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

- [Node.js 20+](https://nodejs.org/)
- [pnpm](https://pnpm.io/installation): `npm install -g pnpm`
- [Docker](https://www.docker.com/) (рекомендуется) **или** [PostgreSQL 16](https://www.postgresql.org/download/windows/) вручную

С Docker база поднимается автоматически (`pnpm up`). Без Docker:

```sql
CREATE DATABASE decentral_hub;
```

---

## Быстрый старт

```bash
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git
cd GLM2pHost228322MLGsnoopDOGsigmaTROLOLO

pnpm up        # PostgreSQL + Redis (Docker)
pnpm setup     # .env, секреты, install, схема БД
pnpm dev       # API + Web
```

Windows (cmd): те же три команды `pnpm up`, `pnpm setup`, `pnpm dev`.

Одна команда: `pnpm quickstart`.

| Сервис | URL |
|---|---|
| Web | http://localhost:5000 |
| API health | http://localhost:8080/api/healthz |

Smoke: `scripts\smoke-api.bat` или `./scripts/smoke-api.sh`

### Свой PostgreSQL (без Docker)

После `pnpm setup` отредактируй `DATABASE_URL` в `.env`:

```
DATABASE_URL=postgresql://postgres:ВАШ_ПАРОЛЬ@localhost:5432/decentral_hub
```

---

## Быстрый старт (Windows, legacy bat-скрипты)

```bat
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git
cd GLM2pHost228322MLGsnoopDOGsigmaTROLOLO

scripts\infra-up.bat
scripts\setup-local.bat
scripts\dev-local.bat
scripts\smoke-api.bat
```

---

## Быстрый старт (Git Bash / Linux / macOS, legacy sh-скрипты)

```bash
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git
cd GLM2pHost228322MLGsnoopDOGsigmaTROLOLO

chmod +x scripts/*.sh
./scripts/infra-up.sh
./scripts/setup-local.sh
./scripts/dev-local.sh
./scripts/smoke-api.sh
```

---

## Роли

| Кто | Задача |
|---|---|
| **Вы** | Браузер, 2 окна WebRTC, Electron-агент, скрины/console при багах |
| **Agent** | Фиксы в коде, TESTPLAN/TESTLOG, smoke при необходимости |

Не нужно заново clone/setup, если healthz ok и `dev-local.bat` уже запущен.
