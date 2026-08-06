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

**Две команды — и можно играть в браузере (Rogue Fable III без Windows-агента):**

```bash
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git decentral-hub
cd decentral-hub
pnpm setup    # .env, секреты, Docker Postgres (если есть), схема БД
pnpm dev      # API :8080 + Web :5000
```

Открой http://localhost:5000/games

| Что | URL |
|---|---|
| Каталог игр | http://localhost:5000/games |
| API health | http://localhost:8080/api/healthz |
| Smoke-тест | `./scripts/smoke-api.sh` |

**Требования:** Node.js 20+ (см. `.nvmrc`), pnpm 9+, PostgreSQL 16 *или* Docker (setup поднимет Postgres+Redis сам).

Подробнее — [`LOCAL_SETUP.md`](./LOCAL_SETUP.md). Полный план тестирования — [`TESTPLAN.md`](./TESTPLAN.md).

### Требования

- Node.js 20+ (рекомендуется 22, как в CI)
- pnpm 9+
- PostgreSQL 16 **или** Docker Desktop (для `infra/docker-compose.dev.yml`)

### Первичная настройка (альтернатива)

**Windows:**

```bat
scripts\setup-local.bat
scripts\dev-local.bat
```

**Git Bash / Linux / macOS:**

```bash
chmod +x scripts/*.sh
./scripts/setup-local.sh
./scripts/dev-local.sh
```

### Переменные окружения (`.env`)

Создаётся автоматически при `pnpm setup`. Секреты `WALLET_ENCRYPTION_KEY` и `JWT_SECRET` генерируются сами.

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | PostgreSQL (по умолчанию — docker compose) |
| `PORT` | API-сервер (8080) |
| `WEB_PORT` | Vite dev-сервер (5000) |
| `WALLET_ENCRYPTION_KEY` | Кошелёк (автоген) |
| `JWT_SECRET` | JWT auth (автоген) |
| `API_PROXY_TARGET` | Куда Vite проксирует `/api` |

TURN, object storage, VirusTotal — **опционально**, можно настроить позже.

### Запуск (два терминала или один скрипт)

```bash
pnpm dev
# или ./scripts/dev-local.sh
```

**Вручную в двух терминалах:**

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
