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

**Три команды — и работает:**

```bash
pnpm bootstrap   # .env, секреты, Docker postgres+redis (если есть), install, db push
pnpm dev         # API :8080 + Web :5000
pnpm smoke       # smoke-тест API (в другом терминале, пока dev запущен)
```

> `pnpm bootstrap` = `pnpm run setup` (у `pnpm setup` встроенная команда pnpm — используй `bootstrap` или `run setup`).

Открой http://localhost:5000 · API health: http://localhost:8080/api/healthz

**На потом (не нужно для первого запуска):**

| Команда | Когда |
|---|---|
| `pnpm setup:full` | Полная проверка типов после setup |
| `pnpm infra` / `pnpm infra:down` | Только Docker postgres + redis |
| `pnpm infra:full` | + coturn (WebRTC/TURN) |
| `pnpm run typecheck` | CI-уровень typecheck |
| `pnpm test` | Unit-тесты api-server |

Старые обёртки `./scripts/setup-local.sh` и `./scripts/dev-local.sh` вызывают ту же логику.

Полный план тестирования — в [`TESTPLAN.md`](./TESTPLAN.md). Журнал багов — [`TESTLOG.md`](./TESTLOG.md).

**Пошаговая инструкция (Windows, свой Postgres):** [`LOCAL_SETUP.md`](./LOCAL_SETUP.md)

**Уже работает?** Если http://localhost:8080/api/healthz → `{"status":"ok"}` и http://localhost:5000 открывается — фазы 0–1 пройдены, начинайте **фазу 2** в TESTPLAN (обход страниц в браузере).

### Требования

- Node.js 20+
- pnpm 9+
- Docker (рекомендуется — `pnpm setup` поднимет postgres + redis) **или** свой PostgreSQL 16
- Git Bash / WSL (для Windows) или Linux/macOS

### Первичная настройка (автоматическая)

```bash
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git
cd GLM2pHost228322MLGsnoopDOGsigmaTROLOLO
pnpm bootstrap
pnpm dev
```

`pnpm bootstrap` создаёт `.env`, генерирует `WALLET_ENCRYPTION_KEY` и `JWT_SECRET`, при наличии Docker — поднимает postgres/redis и применяет схему БД.

**Без Docker:** `pnpm bootstrap --no-docker` (нужен свой PostgreSQL; placeholder DATABASE_URL подставится автоматически).

<details>
<summary>Ручная настройка (Windows cmd / старые скрипты)</summary>

```bat
copy .env.example .env
notepad .env
scripts\setup-local.bat
scripts\dev-local.bat
```

</details>

### Переменные окружения (`.env`)

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | PostgreSQL, база `decentral_hub` |
| `PORT` | API-сервер (8080) |
| `WALLET_ENCRYPTION_KEY` | 32-байт hex, обязателен для кошелька |
| `ADMIN_SECRET` | Секрет admin-роутов (`X-Admin-Secret`) |
| `API_PROXY_TARGET` | Куда Vite проксирует `/api` (http://localhost:8080) |
| `BASE_PATH` | Базовый путь web (`/`) |

`.env` подхватывается автоматически через `dotenv-cli` в dev-скриптах. На Replit переменные задаёт платформа.

### Запуск

```bash
pnpm dev
# или: ./scripts/dev-local.sh
```

Два процесса (API + Web) в одном терминале. Ctrl+C — остановить оба.

**Вручную (два терминала):**

```bash
# Терминал 1: API (порт 8080)
pnpm --filter @workspace/api-server run dev

# Терминал 2: Web (порт 5000, прокси /api -> :8080)
pnpm --filter @workspace/web run dev
```

Открой http://localhost:5000

### Smoke-тест API (фаза 1)

```bash
pnpm smoke
# или: ./scripts/smoke-api.sh
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
