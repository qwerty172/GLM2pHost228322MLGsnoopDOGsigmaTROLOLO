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

Нужны: **Node.js 20+**, **pnpm 9+**, **Docker** (или свой PostgreSQL 16).

```bash
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git decentral-hub
cd decentral-hub

pnpm dev:db    # PostgreSQL в Docker (пропусти, если БД уже есть)
pnpm setup     # .env, секреты, зависимости, схема БД
pnpm dev       # API :8080 + Web :5000
```

Открой http://localhost:5000/games — каталог игр должен загрузиться сразу.

Проверка API: `./scripts/smoke-api.sh` или http://localhost:8080/api/healthz

**Windows:** `scripts\setup-local.bat` и `scripts\dev-local.bat` (или `pnpm setup` / `pnpm dev` в Git Bash).

Подробнее — [`LOCAL_SETUP.md`](./LOCAL_SETUP.md). План тестирования — [`TESTPLAN.md`](./TESTPLAN.md).

### Требования

- Node.js 20+
- pnpm 9+
- PostgreSQL 16 (через Docker или вручную)
- Git Bash / WSL (Windows) или Linux/macOS

### Альтернатива без Docker (Linux)

```bash
./scripts/cloud-setup.sh   # ставит PostgreSQL, создаёт .env
pnpm dev
```

### Переменные окружения (`.env`)

Создаётся автоматически при `pnpm setup`. Редактировать вручную нужно редко.

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | PostgreSQL (по умолчанию совпадает с docker-compose) |
| `PORT` | API-сервер (8080) |
| `WEB_PORT` | Web/Vite (5000) |
| `WALLET_ENCRYPTION_KEY` | Генерируется при setup |
| `JWT_SECRET` | Генерируется при setup (логин/регистрация) |
| `API_PROXY_TARGET` | Куда Vite проксирует `/api` |

Опционально (можно на потом): `REDIS_URL`, TURN/WebRTC, object storage, VirusTotal — см. комментарии в `.env.example`.

`.env` подхватывается через `dotenv-cli` в dev-скриптах.

### Запуск вручную (два терминала)

```bash
# Терминал 1: API (порт 8080)
pnpm --filter @workspace/api-server run dev

# Терминал 2: Web (порт 5000)
pnpm --filter @workspace/web run dev
```

Или один скрипт: `pnpm dev` / `./scripts/dev-local.sh`

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
