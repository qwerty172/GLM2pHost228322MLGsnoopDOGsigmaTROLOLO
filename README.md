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

Три команды — и можно работать:

```bash
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git
cd GLM2pHost228322MLGsnoopDOGsigmaTROLOLO

pnpm db:up      # PostgreSQL в Docker (или свой Postgres — см. .env.example)
pnpm setup      # .env, зависимости, схема БД
pnpm dev        # API :8080 + Web :5000
```

**Уже работает?** http://localhost:8080/api/healthz → `{"status":"ok"}` и http://localhost:5000 открывается — можно тестировать.

Полный план тестирования — [`TESTPLAN.md`](./TESTPLAN.md). Пошаговая инструкция — [`LOCAL_SETUP.md`](./LOCAL_SETUP.md).

### Требования

- Node.js 20+ (рекомендуется 22, см. `.nvmrc`)
- pnpm 9+
- Docker (для `pnpm db:up`) **или** свой PostgreSQL 16

### Команды разработчика

| Команда | Что делает |
|---|---|
| `pnpm db:up` | PostgreSQL в Docker |
| `pnpm db:up:all` | PostgreSQL + Redis в Docker |
| `pnpm setup` | Первичная настройка (с typecheck) |
| `pnpm setup:fast` | То же, но без typecheck — быстрее |
| `pnpm dev` | API + Web одной командой |
| `pnpm smoke` | Smoke-тест API |
| `make help` | Список make-алиасов |

### Windows

```bat
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git
cd GLM2pHost228322MLGsnoopDOGsigmaTROLOLO
pnpm db:up
scripts\setup-local.bat
scripts\dev-local.bat
```

### Переменные окружения (`.env`)

**Обязательно** (setup сгенерирует секреты автоматически):

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | PostgreSQL (`decentral_hub:decentral_hub@localhost` при Docker) |
| `WALLET_ENCRYPTION_KEY` | Шифрование кошелька (auto) |
| `JWT_SECRET` | JWT-авторизация (auto) |

**Опционально** (можно настроить позже): Redis, TURN/WebRTC, VirusTotal, object storage, AI-ключи.

| Переменная | Назначение |
|---|---|
| `PORT` | API-сервер (8080) |
| `WEB_PORT` | Web dev-сервер (5000) |
| `ADMIN_SECRET` | Секрет admin-роутов |
| `API_PROXY_TARGET` | Куда Vite проксирует `/api` |

`.env` подхватывается через `dotenv-cli` в dev-скриптах.

### Запуск вручную (два терминала)

```bash
# Терминал 1: API (порт 8080)
pnpm --filter @workspace/api-server run dev

# Терминал 2: Web (порт 5000)
WEB_PORT=5000 pnpm --filter @workspace/web run dev
```

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
