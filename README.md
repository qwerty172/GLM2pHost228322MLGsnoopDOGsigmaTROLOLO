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

**Одна команда** (Docker + настройка + запуск):

```bash
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git
cd GLM2pHost228322MLGsnoopDOGsigmaTROLOLO
pnpm quickstart
```

Открой http://localhost:5000 — API на http://localhost:8080/api/healthz

| Команда | Что делает |
|---|---|
| `pnpm quickstart` | Docker (если есть) → `.env` → install → db push → API + Web |
| `pnpm setup` | Только настройка (без запуска серверов) |
| `pnpm dev` | Запуск API + Web (после setup) |
| `pnpm docker:up` | PostgreSQL + Redis в Docker |
| `pnpm typecheck` | Полная проверка типов (опционально) |

Без Docker: скопируй `.env.example` → `.env`, укажи `DATABASE_URL`, затем `pnpm setup && pnpm dev`.

Полный план тестирования — в [`TESTPLAN.md`](./TESTPLAN.md). Пошаговая инструкция — [`LOCAL_SETUP.md`](./LOCAL_SETUP.md).

**Уже работает?** Если http://localhost:8080/api/healthz → `{"status":"ok"}` и http://localhost:5000 открывается — начинайте **фазу 2** в TESTPLAN.

### Требования

- Node.js 20+
- pnpm 9+ (рекомендуется 10)
- Docker (опционально, но проще всего) **или** PostgreSQL 16

### Переменные окружения

Готовый шаблон для Docker: `.env.docker`. Для ручной установки: `.env.example`.

`setup` автоматически генерирует `WALLET_ENCRYPTION_KEY` и `JWT_SECRET`, если они пустые.

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | PostgreSQL |
| `PORT` | API-сервер (8080) |
| `WEB_PORT` | Vite dev-сервер (5000) |
| `WALLET_ENCRYPTION_KEY` | Кошелёк (автоген) |
| `JWT_SECRET` | JWT-авторизация (автоген) |
| `API_PROXY_TARGET` | Прокси Vite → API |

### Запуск вручную (два терминала)

```bash
pnpm --filter @workspace/api-server run dev   # :8080
pnpm --filter @workspace/web run dev          # :5000
```

### Smoke-тест API

```bash
./scripts/smoke-api.sh
```

### Windows

```bat
scripts\setup-local.bat
scripts\dev-local.bat
```

Или Git Bash: `pnpm quickstart`

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
