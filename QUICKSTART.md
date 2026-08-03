# Быстрый старт — 5 минут

Клонировать → одна команда → браузер. Windows-агент и TURN — **на потом**.

## 1. Клонирование

```bash
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git
cd GLM2pHost228322MLGsnoopDOGsigmaTROLOLO
```

**Windows (cmd):** то же, затем `scripts\setup-local.bat` и `scripts\dev-local.bat`.

## 2. Настройка (один раз)

```bash
pnpm setup
```

Скрипт сам:
- поднимает Postgres + Redis через Docker (если `docker` доступен)
- создаёт `.env` с секретами (`WALLET_ENCRYPTION_KEY`, `JWT_SECRET`)
- ставит зависимости и применяет схему БД

Без Docker: установи PostgreSQL 16, пропиши `DATABASE_URL` в `.env`, затем `SKIP_DOCKER=1 pnpm setup`.

Пропустить долгую проверку типов: `SKIP_TYPECHECK=1 pnpm setup`.

## 3. Запуск

```bash
pnpm dev
```

| URL | Что |
|-----|-----|
| http://localhost:5000 | Web UI |
| http://localhost:8080/api/healthz | Проверка API |

## 4. Демо без Windows-агента

Открой **Rogue Fable III** — браузерный хост, Electron не нужен:

http://localhost:5000/games/rogue-fable-3

Два вкладки: одна как хост (`/host`), вторая как игрок по invite-ссылке.

## 5. Smoke-тест API

```bash
./scripts/smoke-api.sh
```

## На потом (не нужны для первого запуска)

| Задача | Когда |
|--------|-------|
| Windows-агент (Electron) | Стрим с ПК хоста |
| `infra:up` + coturn | WebRTC через NAT / прод |
| `TURN_*` в `.env` | TURN-сервер |
| Object Storage | Загрузки файлов |
| `pnpm run typecheck` | Перед коммитом |
| [`TESTPLAN.md`](./TESTPLAN.md) | Полный QA |

## Полезные команды

```bash
pnpm infra:up      # только Postgres + Redis
pnpm infra:down    # остановить контейнеры
pnpm smoke:invite  # smoke invite-flow (нужен запущенный API)
```

Подробнее: [`README.md`](./README.md), [`LOCAL_SETUP.md`](./LOCAL_SETUP.md).
