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
pnpm setup    # .env, Docker Postgres+Redis, миграции, typecheck
pnpm dev      # API :8080 + Web :5000
```

Открой http://localhost:5000 — каталог игр, дашборд хоста, всё сразу.

**Что опционально (можно на потом):**
- TURN/coturn (`TURN_SECRET`, `TURN_URLS`) — для WebRTC за NAT
- Object Storage — загрузки файлов
- VirusTotal, Anthropic AI — сканирование и AI-чат
- Windows-агент (`artifacts/host-agent`) — нативный стрим с ПК

Полный план тестирования — [`TESTPLAN.md`](./TESTPLAN.md). Подробности — [`LOCAL_SETUP.md`](./LOCAL_SETUP.md).

### Требования

- Node.js 20+ (CI использует 22)
- pnpm 9+
- Docker (рекомендуется) **или** PostgreSQL 16 вручную

### Клонирование

```bash
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git decentral-hub
cd decentral-hub
pnpm setup
pnpm dev
```

**Windows (cmd):** `scripts\setup-local.bat` → `pnpm dev` или `scripts\dev-local.bat`

### Инфраструктура отдельно

```bash
pnpm infra:up     # только Postgres + Redis в Docker
pnpm infra:down   # остановить
pnpm db:push      # применить схему БД
```

### Переменные окружения (`.env`)

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | PostgreSQL (docker: `decentral_hub:decentral_hub@localhost`) |
| `PORT` | API-сервер (8080) |
| `WEB_PORT` | Web Vite dev-сервер (5000) |
| `WALLET_ENCRYPTION_KEY` | 32-байт hex, обязателен для кошелька |
| `ADMIN_SECRET` | Секрет admin-роутов (`X-Admin-Secret`) |
| `API_PROXY_TARGET` | Куда Vite проксирует `/api` (http://localhost:8080) |
| `BASE_PATH` | Базовый путь web (`/`) |

`.env` подхватывается автоматически через `dotenv-cli` в dev-скриптах. На Replit переменные задаёт платформа.

### Запуск

```bash
pnpm dev
# или вручную в двух терминалах:
# pnpm --filter @workspace/api-server run dev
# pnpm --filter @workspace/web run dev
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
