# Локальный запуск на своём ПК

> Команды вводятся **на вашем компьютере** (cmd, Git Bash, Terminal в Cursor).

Полный план тестирования: [TESTPLAN.md](./TESTPLAN.md). Журнал багов: [TESTLOG.md](./TESTLOG.md).

---

## Быстрый старт

```bash
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git
cd GLM2pHost228322MLGsnoopDOGsigmaTROLOLO

pnpm setup          # .env, секреты, зависимости, схема БД
pnpm dev            # API :8080 + Web :5000
```

**Windows (cmd):**

```bat
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git
cd GLM2pHost228322MLGsnoopDOGsigmaTROLOLO
scripts\setup-local.bat
pnpm dev
```

### Без локального PostgreSQL — Docker

```bash
pnpm setup:docker   # postgres + redis в Docker, DATABASE_URL настроится сам
pnpm dev
```

| Сервис | URL |
|---|---|
| Web | http://localhost:5000/games |
| API health | http://localhost:8080/api/healthz |
| Smoke-тест | `pnpm smoke` |

---

## Ты здесь

Если healthz → `{"status":"ok"}` и http://localhost:5000 открывается:

**→ Фазы 0–1 пройдены. Переходите к [TESTPLAN § Фаза 2](./TESTPLAN.md#фаза-2--web-обход-всех-страниц--сейчас).**

---

## Требования

- [Node.js 20+](https://nodejs.org/)
- [pnpm](https://pnpm.io/installation): `npm install -g pnpm`
- PostgreSQL 16 **или** [Docker Desktop](https://www.docker.com/products/docker-desktop/)

Если PostgreSQL установлен вручную — создай базу:

```sql
CREATE DATABASE decentral_hub;
```

И укажи `DATABASE_URL` в `.env` (или отредактируй после `pnpm setup`).

---

## Переменные окружения

`pnpm setup` создаёт `.env` из `.env.example` и автоматически генерирует:

- `WALLET_ENCRYPTION_KEY` — шифрование кошелька
- `JWT_SECRET` — JWT-авторизация

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | PostgreSQL |
| `PORT` | API (8080) |
| `WEB_PORT` | Web/Vite (5000) |
| `API_PROXY_TARGET` | Прокси `/api` → API |

---

## Роли

| Кто | Задача |
|---|---|
| **Вы** | Браузер, 2 окна WebRTC, Electron-агент, скрины/console при багах |
| **Agent** | Фиксы в коде, TESTPLAN/TESTLOG, smoke при необходимости |

Не нужно заново setup, если healthz ok и `pnpm dev` уже запущен.
