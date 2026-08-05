# Локальный запуск на своём ПК

> Команды вводятся **на вашем компьютере** (cmd, Git Bash, Terminal в Cursor).

Полный план тестирования: [TESTPLAN.md](./TESTPLAN.md). Журнал багов: [TESTLOG.md](./TESTLOG.md).

---

## Ты здесь

Если у вас уже работает:

| Проверка | URL |
|---|---|
| API | http://localhost:8080/api/healthz → `{"status":"ok"}` |
| Web | http://localhost:5000 |

**→ Фазы 0–1 пройдены. Переходите к [TESTPLAN § Фаза 2](./TESTPLAN.md#фаза-2--web-обход-всех-страниц--сейчас).**

Если healthz **не** ok — сначала [Быстрый старт](#быстрый-старт) ниже.

---

## Быстрый старт

**Одна команда** (рекомендуется):

```bash
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git
cd GLM2pHost228322MLGsnoopDOGsigmaTROLOLO
pnpm dev
```

Скрипт сам создаст `.env`, сгенерирует секреты, поднимет PostgreSQL+Redis в Docker, применит схему и запустит API + Web.

**Windows (cmd):** то же самое, или `scripts\dev-up.bat`

| Сервис | URL |
|---|---|
| Web | http://localhost:5000 |
| API health | http://localhost:8080/api/healthz |

### Требования

- [Node.js 20+](https://nodejs.org/)
- [pnpm](https://pnpm.io/installation): `npm install -g pnpm`
- [Docker Desktop](https://docs.docker.com/get-docker/) — для PostgreSQL и Redis из коробки

**Без Docker:** установите [PostgreSQL 16](https://www.postgresql.org/download/), создайте базу `decentral_hub`, укажите `DATABASE_URL` в `.env`, затем `pnpm setup && pnpm dev`.

### Полезные команды

| Команда | Что делает |
|---|---|
| `pnpm dev` | Всё в одном |
| `pnpm setup` | Только настройка (без запуска серверов) |
| `pnpm db:up` / `pnpm db:down` | Docker: postgres + redis |
| `scripts\dev-local.bat` / `./scripts/dev-local.sh` | Только API + Web |
| `scripts\smoke-api.bat` / `./scripts/smoke-api.sh` | Smoke-тест API |

---

## Роли

| Кто | Задача |
|---|---|
| **Вы** | Браузер, 2 окна WebRTC, Electron-агент, скрины/console при багах |
| **Agent** | Фиксы в коде, TESTPLAN/TESTLOG, smoke при необходимости |

Не нужно заново clone/setup, если healthz ok и dev-серверы уже запущены.
