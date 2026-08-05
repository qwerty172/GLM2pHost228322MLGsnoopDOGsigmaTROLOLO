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

**Два шага — и можно работать:**

```bash
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git
cd GLM2pHost228322MLGsnoopDOGsigmaTROLOLO
pnpm setup    # .env, Docker Postgres (если есть), зависимости, схема БД
pnpm dev      # API :8080 + Web :5000
```

Открой http://localhost:5000 · API health: http://localhost:8080/api/healthz

**Windows (cmd):** `scripts\setup-local.bat` → `scripts\dev-local.bat` (или `pnpm setup` / `pnpm dev` в Git Bash).

**Уже работает?** Если healthz → `{"status":"ok"}` и :5000 открывается — см. [TESTPLAN.md](./TESTPLAN.md) фаза 2.

### Требования

- Node.js 20+ · pnpm 9+
- **Docker** (рекомендуется) — Postgres поднимется сам; без Docker — свой PostgreSQL 16 и `DATABASE_URL` в `.env`

### Что можно отложить

| Сейчас не нужно | Когда понадобится |
|---|---|
| Redis | `pnpm run docker:extras` — rate-limit / кэш при масштабировании |
| coturn (TURN) | WebRTC через NAT, см. `infra/coturn/` |
| Windows host-agent | Стриминг с ПК, см. раздел ниже |
| `pnpm run typecheck` | Перед PR: `pnpm run setup:full` |
| OpenAPI codegen | Только после правок `lib/api-spec/openapi.yaml` |

Подробнее: [LOCAL_SETUP.md](./LOCAL_SETUP.md) · план тестов: [TESTPLAN.md](./TESTPLAN.md)

### Переменные окружения (`.env`)

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | PostgreSQL (по умолчанию под Docker Compose) |
| `PORT` | API-сервер (8080) |
| `WEB_PORT` | Vite dev-сервер (5000), отдельно от API |
| `WALLET_ENCRYPTION_KEY` | Генерируется при `pnpm setup` |
| `JWT_SECRET` | Генерируется при `pnpm setup` |
| `ADMIN_SECRET` | Admin-роуты (`X-Admin-Secret`) |
| `API_PROXY_TARGET` | Куда Vite проксирует `/api` |

`.env` подхватывается через `dotenv-cli` в dev-скриптах.

### Запуск по отдельности

```bash
# Терминал 1: API
pnpm --filter @workspace/api-server run dev

# Терминал 2: Web
pnpm --filter @workspace/web run dev
```

### Smoke-тест API

```bash
./scripts/smoke-api.sh
```

### Docker (только БД)

```bash
pnpm run docker:db       # PostgreSQL
pnpm run docker:extras   # + Redis + coturn
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
