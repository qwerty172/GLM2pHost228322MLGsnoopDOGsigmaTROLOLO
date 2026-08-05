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

**Три команды** — если установлены Node 22+, pnpm и Docker:

```bash
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git decentral-hub
cd decentral-hub
pnpm setup    # .env + Postgres в Docker + миграции
pnpm dev      # API :8080 + Web :5000
```

Открой http://localhost:5000 · API health: http://localhost:8080/api/healthz

| Команда | Что делает |
|---|---|
| `pnpm setup` | Создаёт `.env` с секретами, поднимает Postgres, `db push` |
| `pnpm dev` | API + Web одновременно |
| `pnpm dev:api` / `pnpm dev:web` | Только один сервис |
| `pnpm db:up` / `pnpm db:down` | Postgres в Docker |
| `pnpm verify` | typecheck + тесты (перед коммитом) |

**Без Docker?** Установи PostgreSQL 16, поправь `DATABASE_URL` в `.env`, затем `pnpm setup:env && pnpm install && pnpm --filter @workspace/db run push`.

Полный план тестирования — [`TESTPLAN.md`](./TESTPLAN.md). Пошаговая инструкция — [`LOCAL_SETUP.md`](./LOCAL_SETUP.md).

### Требования

- Node.js 22+ (см. `.nvmrc`)
- pnpm 10+ (`corepack enable`)
- Docker — для `pnpm db:up` (или свой PostgreSQL 16)

### Переменные окружения (`.env`)

Создаётся автоматически через `pnpm setup`. Ключевые поля:

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | PostgreSQL (по умолчанию — Docker: `decentral_hub:decentral_hub@localhost:5432`) |
| `PORT` | API-сервер (8080) |
| `WEB_PORT` | Vite dev-сервер (5000) |
| `WALLET_ENCRYPTION_KEY` | Генерируется при setup |
| `JWT_SECRET` | Генерируется при setup (нужен для auth) |
| `REDIS_URL` | Опционально — rate limit / кэш (закомментирован в `.env.example`) |
| `TURN_*` | Опционально — WebRTC через coturn (см. `infra/docker-compose.dev.yml`) |

### Альтернатива: скрипты в `scripts/`

```bash
./scripts/setup-local.sh   # то же что pnpm setup (с Docker если есть)
./scripts/dev-local.sh     # то же что pnpm dev
./scripts/smoke-api.sh     # smoke-тест API
```

### Windows (cmd)

```bat
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git
cd GLM2pHost228322MLGsnoopDOGsigmaTROLOLO
pnpm setup
pnpm dev
```

Подробнее — [LOCAL_SETUP.md](./LOCAL_SETUP.md).

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
