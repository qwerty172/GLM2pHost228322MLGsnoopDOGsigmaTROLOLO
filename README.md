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

**Три команды — и работаешь:**

```bash
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git
cd GLM2pHost228322MLGsnoopDOGsigmaTROLOLO
pnpm setup    # .env + секреты + Docker postgres/redis + install + схема БД
pnpm dev      # API :8080 + Web :5000
pnpm smoke    # проверка API
```

Открой http://localhost:5000 — если healthz ok, фазы 0–1 пройдены (см. [TESTPLAN.md](./TESTPLAN.md)).

Полная инструкция: [`LOCAL_SETUP.md`](./LOCAL_SETUP.md). Журнал багов: [`TESTLOG.md`](./TESTLOG.md).

### Требования

- Node.js 20+
- pnpm 9+
- Docker (рекомендуется — postgres+redis поднимаются автоматически) **или** свой PostgreSQL 16

### На потом (не нужно для старта)

| Команда | Зачем |
|---|---|
| `pnpm setup:full` | setup + проверка типов |
| `pnpm typecheck` | только typecheck |
| `pnpm infra:full` | coturn для WebRTC через NAT |
| `pnpm codegen` | после правок OpenAPI |
| `pnpm smoke:invite` / `smoke:features` | расширенные smoke-тесты |

### Переменные окружения (`.env`)

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | PostgreSQL (`pnpm setup` подставит Docker-URL) |
| `PORT` | API-сервер (8080) |
| `WEB_PORT` | Vite dev-сервер (5000) |
| `WALLET_ENCRYPTION_KEY` | 32-байт hex — генерируется в `pnpm setup` |
| `JWT_SECRET` | JWT — генерируется в `pnpm setup` |
| `ADMIN_SECRET` | Секрет admin-роутов (`X-Admin-Secret`) |
| `API_PROXY_TARGET` | Куда Vite проксирует `/api` (http://localhost:8080) |

`.env` подхватывается через `dotenv-cli` в dev-скриптах.

### Альтернатива: скрипты напрямую

```bash
./scripts/setup-local.sh   # = pnpm setup
./scripts/dev-local.sh     # = pnpm dev
```

**Windows:** `scripts\setup-local.bat` и `scripts\dev-local.bat`

### Запуск вручную (два терминала)

```bash
# Терминал 1: API (порт 8080)
pnpm --filter @workspace/api-server run dev

# Терминал 2: Web (порт 5000)
pnpm --filter @workspace/web run dev
```

### Smoke-тест API

```bash
pnpm smoke
# или: node scripts/smoke.mjs http://localhost:8080
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
