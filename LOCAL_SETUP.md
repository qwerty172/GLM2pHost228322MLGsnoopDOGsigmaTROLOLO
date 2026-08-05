# Локальный запуск на своём ПК

> Команды вводятся **на вашем компьютере** (cmd, Git Bash, Terminal в Cursor).

## Ты здесь

| Проверка | URL |
|---|---|
| API | http://localhost:8080/api/healthz → `{"status":"ok"}` |
| Web | http://localhost:5000/games — каталог игр |

**→ Работает?** Переходите к [TESTPLAN § Фаза 2](./TESTPLAN.md#фаза-2--web-обход-всех-страниц--сейчас).

Если healthz **не** ok — [Быстрый старт](#быстрый-старт) ниже.

---

## Быстрый старт

**Требования:** Node.js 20+, pnpm 9+, Docker (или PostgreSQL 16).

### Linux / macOS / Git Bash

```bash
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git decentral-hub
cd decentral-hub

pnpm dev:db      # PostgreSQL в Docker
pnpm setup       # .env + секреты + зависимости + схема БД
pnpm dev         # API + Web
./scripts/smoke-api.sh
```

### Windows (cmd)

```bat
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git decentral-hub
cd decentral-hub

docker compose -f infra/docker-compose.dev.yml up -d postgres
scripts\setup-local.bat
scripts\dev-local.bat
scripts\smoke-api.bat
```

| Сервис | URL |
|---|---|
| Web | http://localhost:5000 |
| API | http://localhost:8080/api/healthz |

`pnpm setup` сам создаёт `.env`, генерирует `WALLET_ENCRYPTION_KEY` и `JWT_SECRET`, поднимает Postgres через Docker (если есть).

---

## Без Docker

### Свой PostgreSQL

1. Создай базу: `CREATE DATABASE decentral_hub;`
2. В `.env` укажи свой `DATABASE_URL`
3. `pnpm setup` и `pnpm dev`

### Linux без Docker (Cloud Agent / VPS)

```bash
./scripts/cloud-setup.sh   # apt install PostgreSQL, .env, db push
pnpm dev
```

---

## Опционально (на потом)

| Что | Когда нужно |
|---|---|
| Redis (`REDIS_URL`) | Горизонтальное масштабирование API |
| coturn / TURN | WebRTC через NAT (см. `infra/docker-compose.dev.yml`) |
| Object storage | Загрузки файлов в проде |
| Windows-агент | Стриминг с ПК — [`artifacts/host-agent/README.md`](./artifacts/host-agent/README.md) |

---

## Роли

| Кто | Задача |
|---|---|
| **Вы** | Браузер, WebRTC, Electron-агент, скрины при багах |
| **Agent** | Фиксы в коде, TESTPLAN/TESTLOG |

Не нужно заново clone/setup, если healthz ok и `pnpm dev` уже запущен.
