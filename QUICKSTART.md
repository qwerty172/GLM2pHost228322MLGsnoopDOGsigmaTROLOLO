# Быстрый старт — взял и юзаешь

Три уровня: **сразу играть** → **локальный dev** → **всё остальное потом**.

---

## 1. Сразу играть (0 настройки)

Если сайт уже запущен (Replit или локальный `pnpm dev`):

| Действие | URL |
|----------|-----|
| Демо-игра без регистрации | `/demo` — Rogue Fable III в браузере |
| Каталог | `/games` |
| Стать хостом | `/host` — имя → токен в буфере |

Демо **не требует** PostgreSQL, агента и кошелька.

---

## 2. Локальный dev (одна команда)

**Требования:** Node 20+, pnpm 9+, Docker (для Postgres).

```bash
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git
cd GLM2pHost228322MLGsnoopDOGsigmaTROLOLO
pnpm quickstart
```

`quickstart` делает: Docker Postgres → `.env` + ключи → `db push` → API + Web.

Открой http://localhost:5000/demo

### Команды

| Команда | Что делает |
|---------|------------|
| `pnpm quickstart` | Postgres в Docker + setup + dev |
| `pnpm setup:docker` | Только настройка с Docker Postgres |
| `pnpm setup` | Полная настройка (+ typecheck) |
| `pnpm setup:quick` | Настройка без typecheck |
| `pnpm dev` | API (8080) + Web (5000) |

**Windows:** `scripts\setup-local.bat` → `pnpm dev` или `scripts\dev-local.bat`

### Порты

| Сервис | Переменная | По умолчанию |
|--------|------------|--------------|
| API | `PORT` | 8080 |
| Web (Vite) | `WEB_PORT` | 5000 |

Web читает `WEB_PORT`, не `PORT` — API и фронт не конфликтуют.

---

## 3. Потом, когда нужно

| Задача | Как |
|--------|-----|
| Windows-агент, нативный стрим | `HOSTING.md`, ZIP с `/api/downloads/host-agent.zip` |
| WebRTC через NAT | `infra/docker-compose.dev.yml` (coturn), `TURN_*` в `.env` |
| Redis | тот же docker-compose, `REDIS_URL` |
| Полный тест-план | `TESTPLAN.md` |
| Typecheck перед PR | `pnpm run typecheck` |
| OpenAPI codegen | `pnpm --filter @workspace/api-spec run codegen` |

---

## Проверка

```bash
curl http://localhost:8080/api/healthz   # {"status":"ok"}
curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/demo   # 200
./scripts/smoke-api.sh
```

Подробная установка: [`LOCAL_SETUP.md`](./LOCAL_SETUP.md)
