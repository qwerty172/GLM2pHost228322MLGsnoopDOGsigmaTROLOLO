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

**Две команды — и работает:**

```bash
pnpm bootstrap   # .env + секреты + docker postgres/redis + install + db push
pnpm dev         # API :8080 + Web :5000
```

Открой http://localhost:5000 · API health: http://localhost:8080/api/healthz

Проверка: `pnpm smoke`

**На потом** (не нужно для первого запуска):

| Команда | Зачем |
|---|---|
| `pnpm setup:full` | bootstrap + проверка типов |
| `pnpm typecheck` | только typecheck |
| `pnpm infra` | docker postgres + redis |
| `pnpm infra:full` | + coturn (WebRTC/TURN) |
| `pnpm bootstrap --no-docker` | свой PostgreSQL вместо docker |

Полный план тестирования — [`TESTPLAN.md`](./TESTPLAN.md). Пошаговая инструкция — [`LOCAL_SETUP.md`](./LOCAL_SETUP.md).

### Требования

- Node.js 20+, pnpm 9+
- Docker (рекомендуется) — `pnpm bootstrap` поднимет PostgreSQL и Redis сам
- Без Docker: установи PostgreSQL 16 и укажи `DATABASE_URL` в `.env`

### Клонирование

```bash
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git
cd GLM2pHost228322MLGsnoopDOGsigmaTROLOLO
pnpm bootstrap
pnpm dev
```

### Переменные окружения (`.env`)

Создаётся автоматически при `pnpm bootstrap`. Генерируются `JWT_SECRET` и `WALLET_ENCRYPTION_KEY`, если пустые.

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | PostgreSQL (по умолчанию — docker credentials) |
| `PORT` | API-сервер (8080) |
| `WEB_PORT` | Web dev-сервер (5000) |
| `WALLET_ENCRYPTION_KEY` | 32-байт hex, для кошелька |
| `JWT_SECRET` | HS256 для auth |
| `API_PROXY_TARGET` | Куда Vite проксирует `/api` |

### Запуск вручную (альтернатива)

```bash
# Терминал 1: API (порт 8080)
pnpm --filter @workspace/api-server run dev

# Терминал 2: Web (порт 5000)
pnpm --filter @workspace/web run dev
```

### Smoke-тест API

```bash
pnpm smoke
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
