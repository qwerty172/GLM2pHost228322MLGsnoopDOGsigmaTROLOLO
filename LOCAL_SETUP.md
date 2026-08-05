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

### Требования

- [Node.js 20+](https://nodejs.org/)
- [pnpm](https://pnpm.io/installation): `npm install -g pnpm`
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (рекомендуется) **или** [PostgreSQL 16](https://www.postgresql.org/download/) вручную

### Три команды

```bash
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git
cd GLM2pHost228322MLGsnoopDOGsigmaTROLOLO

pnpm setup   # один раз: docker, .env, install, миграции
pnpm dev     # API + Web
pnpm smoke   # проверка API (когда dev запущен)
```

| Сервис | URL |
|---|---|
| Web | http://localhost:5000 |
| API health | http://localhost:8080/api/healthz |

### Windows (cmd)

```bat
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git
cd GLM2pHost228322MLGsnoopDOGsigmaTROLOLO

pnpm run setup:win
pnpm dev
```

### Без Docker

1. Создай базу `decentral_hub` в PostgreSQL
2. Скопируй `.env.example` → `.env`, пропиши `DATABASE_URL`
3. `pnpm setup` (или вручную: `pnpm install` + `pnpm --filter @workspace/db run push`)

---

## Полезные команды

| Команда | Когда |
|---|---|
| `pnpm dev` | Ежедневная разработка |
| `pnpm smoke` | Проверить API после изменений |
| `pnpm docker:up` | Только postgres + redis |
| `pnpm docker:down` | Остановить контейнеры |
| `pnpm typecheck` | Проверка типов (перед коммитом) |
| `./scripts/dev-local.sh` | Альтернатива `pnpm dev` (bash) |

Секреты (`WALLET_ENCRYPTION_KEY`, `JWT_SECRET`, `ADMIN_SECRET`) генерируются автоматически при `pnpm setup`.  
TURN/WebRTC, Redis в проде, Sentry — опционально, см. `.env.example`.

---

## Роли

| Кто | Задача |
|---|---|
| **Вы** | Браузер, 2 окна WebRTC, Electron-агент, скрины/console при багах |
| **Agent** | Фиксы в коде, TESTPLAN/TESTLOG, smoke при необходимости |

Не нужно заново clone/setup, если healthz ok и `pnpm dev` уже запущен.
