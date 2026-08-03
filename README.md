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

## Быстрый старт (3 команды)

```bash
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git
cd GLM2pHost228322MLGsnoopDOGsigmaTROLOLO

pnpm db:up    # PostgreSQL + Redis в Docker (или свой Postgres — см. ниже)
pnpm setup    # .env, зависимости, схема БД
pnpm dev      # API :8080 + Web :5000
```

Открой http://localhost:5000 — готово.

| Команда | Что делает |
|---|---|
| `pnpm db:up` | Docker: Postgres + Redis (можно пропустить, если Postgres уже есть) |
| `pnpm setup` | Создаёт `.env`, генерирует секреты, `pnpm install`, миграции |
| `pnpm dev` | Запускает API и Web одновременно |
| `pnpm smoke` | Smoke-тест API (healthz, games, guest) |

Полный план тестирования — [`TESTPLAN.md`](./TESTPLAN.md). Пошаговая инструкция — [`LOCAL_SETUP.md`](./LOCAL_SETUP.md).

### Требования

- Node.js 20+, pnpm 9+
- **Docker** (рекомендуется) — `pnpm db:up` поднимает Postgres и Redis
- Или PostgreSQL 16 вручную: `createdb decentral_hub`, поправь `DATABASE_URL` в `.env`

### Windows

```bat
pnpm db:up
pnpm setup
pnpm dev
```

Или `scripts\setup-local.bat` и `scripts\dev-local.bat` — то же самое.

### Переменные окружения (`.env`)

Создаётся автоматически при `pnpm setup`. Ключевые:

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | PostgreSQL (дефолт под Docker: `decentral_hub:decentral_hub@localhost:5432`) |
| `PORT` | API-сервер (8080) |
| `WEB_PORT` | Web dev-сервер (5000) |
| `WALLET_ENCRYPTION_KEY` | Генерируется при setup |
| `JWT_SECRET` | Генерируется при setup |
| `API_PROXY_TARGET` | Куда Vite проксирует `/api` (http://localhost:8080) |

Остальное (TURN, Sentry, VirusTotal) — на потом, для локальной разработки не нужно.

### Запуск по отдельности

```bash
pnpm --filter @workspace/api-server run dev   # только API
pnpm --filter @workspace/web run dev          # только Web
```

### Smoke-тест API

```bash
pnpm smoke
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

## Быстрый старт (legacy / подробнее)

<details>
<summary>Старые скрипты и ручной запуск</summary>

**Git Bash / Linux / macOS:**

```bash
chmod +x scripts/*.sh
./scripts/setup-local.sh
./scripts/dev-local.sh
./scripts/smoke-api.sh
```

**Переменные:** `.env` подхватывается через `dotenv-cli` в dev-скриптах.

</details>

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
