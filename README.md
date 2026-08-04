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

**Две команды — и можно работать:**

```bash
pnpm bootstrap   # .env + секреты + docker postgres/redis + install + db push
pnpm dev         # API :8080 + Web :5000
```

Открой http://localhost:5000 · smoke-тест: `pnpm smoke`

Полный план тестирования — в [`TESTPLAN.md`](./TESTPLAN.md). Журнал багов — [`TESTLOG.md`](./TESTLOG.md).

**Пошаговая инструкция (ручная настройка):** [`LOCAL_SETUP.md`](./LOCAL_SETUP.md)

**Уже работает?** Если http://localhost:8080/api/healthz → `{"status":"ok"}` и http://localhost:5000 открывается — фазы 0–1 пройдены, начинайте **фазу 2** в TESTPLAN (обход страниц в браузере).

### Требования

- Node.js 20+
- pnpm 9+
- Docker (рекомендуется) **или** PostgreSQL 16 вручную
- Git Bash / WSL (для Windows) или Linux/macOS

### Клонирование

```bash
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git decentral-hub
cd decentral-hub
pnpm bootstrap
pnpm dev
```

### На потом (не нужно для старта)

| Команда | Когда нужна |
|---|---|
| `pnpm setup:full` | Проверка типов перед PR |
| `pnpm infra:full` | WebRTC через TURN (coturn) |
| `pnpm infra:down` | Остановить docker-сервисы |
| `pnpm bootstrap --no-docker` | Свой PostgreSQL без Docker |

### Переменные окружения (`.env`)

Создаётся автоматически при `pnpm bootstrap`. Секреты (`JWT_SECRET`, `WALLET_ENCRYPTION_KEY`, `ADMIN_SECRET`) генерируются сами.

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | PostgreSQL (по умолчанию — docker: `decentral_hub:decentral_hub@localhost:5432`) |
| `PORT` | API-сервер (8080) |
| `WEB_PORT` | Web dev-сервер (5000) |
| `WALLET_ENCRYPTION_KEY` | AES-256 для кошелька (автоген) |
| `JWT_SECRET` | JWT auth (автоген) |
| `ADMIN_SECRET` | Admin-роуты (`X-Admin-Secret`) |
| `API_PROXY_TARGET` | Куда Vite проксирует `/api` (http://localhost:8080) |
| `REDIS_URL` | Опционально — без него работает in-memory/PG fallback |
| `TURN_*` | Опционально — для WebRTC через NAT |

`.env` подхватывается автоматически через `dotenv-cli` в dev-скриптах.

### Запуск

```bash
pnpm dev          # API + Web в одном терминале
# или по отдельности:
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/web run dev
```

Открой http://localhost:5000

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
