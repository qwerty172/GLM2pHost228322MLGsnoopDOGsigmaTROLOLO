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
- [PostgreSQL 16](https://www.postgresql.org/download/windows/)

База данных:

```sql
CREATE DATABASE decentral_hub;
```

---

## Быстрый старт (Windows)

```bat
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git
cd GLM2pHost228322MLGsnoopDOGsigmaTROLOLO
git checkout cursor/local-test-prep-9755

copy .env.example .env
notepad .env
```

В `.env` измените `DATABASE_URL`:

```
DATABASE_URL=postgresql://postgres:ВАШ_ПАРОЛЬ@localhost:5432/decentral_hub
```

```bat
scripts\setup-local.bat
scripts\dev-local.bat
scripts\smoke-api.bat
```

| Сервис | URL |
|---|---|
| Web | http://localhost:5000 |
| API health | http://localhost:8080/api/healthz |

---

## Быстрый старт (Git Bash / Linux / macOS)

```bash
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git
cd GLM2pHost228322MLGsnoopDOGsigmaTROLOLO
git checkout cursor/local-test-prep-9755

cp .env.example .env
# отредактируй DATABASE_URL

chmod +x scripts/*.sh
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

---

## Чеклист `.env` (минимум для работы)

| Переменная | Зачем |
|---|---|
| `DATABASE_URL` | PostgreSQL |
| `WALLET_ENCRYPTION_KEY` | 64 hex символов — `setup-local` генерирует, если пусто |
| `ADMIN_SECRET` | Панель `/admin` (заголовок `X-Admin-Secret`) |

Опционально для P2P через NAT: `TURN_SECRET`, `TURN_URLS` (см. [HOSTING.md](./HOSTING.md)).

Крипто без нод в `.env` — API отвечает «временно недоступно», это нормально для локалки.

---

## Первый администратор (`/admin`)

1. Запусти Web, зарегистрируй **хост** (дашборд).
2. Убедись, что в `.env` задан `ADMIN_SECRET` (в `.env.example` есть `change-me-local-dev`).
3. Выдай права админа:

```bat
node scripts\bootstrap-admin.mjs
```

Или SQL:

```sql
UPDATE hosts SET is_admin = 1 WHERE display_name ILIKE '%ваш_ник%';
```

4. Открой http://localhost:5000/admin → введи секрет.

`pnpm --filter @workspace/db run push` создаёт `platform_settings` и `drip_schedules` (миграция `0004_economy_admin`).
