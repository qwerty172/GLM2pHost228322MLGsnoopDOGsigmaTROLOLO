# DecentralHub — P2P Cloud Gaming Platform

P2P-платформа: хосты стримят игры с Windows-ПК игрокам через браузер (WebRTC). Без дата-центров — только прямое соединение между ПК хоста и браузером игрока.

**Стек:** pnpm monorepo · TypeScript · React + Vite · Express 5 · PostgreSQL + Drizzle ORM · WebRTC · Electron (Windows agent)

---

## Архитектура

```
┌─────────────────┐    WebRTC     ┌──────────────────┐
│  Браузер игрока │◄─────────────►│  Windows-агент   │
│   /play/:token  │               │  (Electron app)  │
└────────┬────────┘               └────────┬─────────┘
         │ HTTP/WS                         │ HTTP/WS
         ▼                                 ▼
┌─────────────────────────────────────────────────────┐
│              API Server (Express 5)                 │
│  Сигналинг WebRTC · Сессии · Кошелёк · Каталог игр │
└─────────────────────────┬───────────────────────────┘
                          │ Drizzle ORM
                          ▼
                    PostgreSQL 16
```

### Пакеты в monorepo

| Путь | Описание |
|---|---|
| `artifacts/web` | React + Vite SPA — дашборд хоста, каталог игр, страница игрока |
| `artifacts/api-server` | Express 5 API — сигналинг, сессии, кошелёк, игры, загрузки |
| `artifacts/host-agent` | Electron-агент для Windows — захват экрана, SendInput, WebRTC |
| `lib/db` | Drizzle схема + миграции |
| `lib/api-spec` | OpenAPI YAML-спецификация |
| `lib/api-client-react` | Авто-генерированные React Query хуки (orval) |
| `lib/api-zod` | Авто-генерированные Zod-схемы (orval) |

---

## Быстрый старт (локально)

Полный план тестирования — в [`TESTPLAN.md`](./TESTPLAN.md). Журнал багов — [`TESTLOG.md`](./TESTLOG.md).

**Пошаговая инструкция:** [`LOCAL_SETUP.md`](./LOCAL_SETUP.md)

**Уже работает?** Если http://localhost:8080/api/healthz → `{"status":"ok"}` и http://localhost:5000 открывается — фазы 0–1 пройдены, начинайте **фазу 2** в TESTPLAN (обход страниц в браузере).

### Требования

- Node.js 20+
- pnpm 9+
- Docker (рекомендуется — Postgres одной командой) **или** PostgreSQL 16 вручную

### За 3 команды (рекомендуется)

```bash
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git
cd GLM2pHost228322MLGsnoopDOGsigmaTROLOLO

pnpm up        # Docker: PostgreSQL + Redis
pnpm setup     # .env, секреты, install, схема БД
pnpm dev       # API :8080 + Web :5000
```

Одна команда вместо трёх: `pnpm quickstart` (up + setup + dev).

| Сервис | URL |
|---|---|
| Web | http://localhost:5000 |
| API | http://localhost:8080/api/healthz |

Smoke: `./scripts/smoke-api.sh`

### Первичная настройка (Windows)

```bat
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git
cd GLM2pHost228322MLGsnoopDOGsigmaTROLOLO

pnpm up
pnpm setup
pnpm dev
```

### Первичная настройка (Git Bash / Linux / macOS)

```bash
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git
cd GLM2pHost228322MLGsnoopDOGsigmaTROLOLO

chmod +x scripts/*.sh
pnpm up
pnpm setup
pnpm dev
```

Подробнее — [LOCAL_SETUP.md](./LOCAL_SETUP.md).

### Переменные окружения (`.env`)

Создаётся автоматически при `pnpm setup`. Ключевые:

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | PostgreSQL (`decentral_hub` при Docker из `pnpm up`) |
| `PORT` | API-сервер (8080) |
| `WEB_PORT` | Web Vite (5000) — **не** путать с `PORT` |
| `WALLET_ENCRYPTION_KEY` | Автогенерация при setup |
| `JWT_SECRET` | Автогенерация при setup |
| `API_PROXY_TARGET` | Куда Vite проксирует `/api` (http://localhost:8080) |
| `BASE_PATH` | Базовый путь web (`/`) |

`.env` подхватывается через `dotenv-cli` в dev-скриптах. Redis, TURN, Sentry — опционально, можно настроить позже.

### Запуск (два терминала или один скрипт)

```bash
pnpm dev
# или: ./scripts/dev-local.sh
```

**Вручную (два терминала):**

```bash
# Терминал 1: API (порт 8080)
pnpm --filter @workspace/api-server run dev

# Терминал 2: Web (порт 5000, прокси /api -> :8080)
pnpm --filter @workspace/web run dev
```

Открой http://localhost:5000

### Smoke-тест API (фаза 1)

```bash
./scripts/smoke-api.sh
# или: ./scripts/smoke-api.sh http://localhost:8080
```

### Сборка production

```bash
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/web run build
```

### Кодогенерация (после изменения OpenAPI схемы)

```bash
pnpm --filter @workspace/api-spec run codegen
```

### Проверка типов

```bash
pnpm run typecheck
```

---

## Windows-агент (хост)

Агент — Electron-приложение для Windows. Захватывает окно игры через `desktopCapturer`, стримит по WebRTC, принимает ввод игрока через `SendInput` (koffi → user32).

```bash
cd artifacts/host-agent
pnpm install
pnpm run build    # tsc main + renderer
```

Для тестирования на Windows: скачать ZIP через `/api/downloads/host-agent.zip`, распаковать, запустить `start.bat`.

---

## Ключевые API-маршруты

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/api/games` | Каталог игр |
| `GET` | `/api/games/:slug` | Детали игры |
| `GET` | `/api/public/games/:slug/hosts` | Онлайн-хосты для игры |
| `POST` | `/api/sessions` | Создать сессию (хост) |
| `GET` | `/api/signal` | WebSocket сигналинг |
| `GET` | `/api/downloads/host-agent.zip` | Скачать агент |
| `GET` | `/api/hosts/@me` | Профиль хоста |
| `GET` | `/api/wallet/@me` | Кошелёк |

---

## Структура БД

Основные таблицы: `games`, `hosts`, `sessions`, `players`, `ledger`, `quotas`, `loans`, `deposits`, `withdrawals`.

Схема: `lib/db/src/schema/`

---

## Лицензия

MIT
