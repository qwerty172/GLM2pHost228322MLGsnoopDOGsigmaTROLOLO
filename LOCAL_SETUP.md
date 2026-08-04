# Локальный запуск на своём ПК

> Команды вводятся **на вашем компьютере** (cmd, Git Bash, Terminal в Cursor).
> Cursor Agent чинит код; вы проверяете в браузере.

Полный план тестирования: [TESTPLAN.md](./TESTPLAN.md). Журнал багов: [TESTLOG.md](./TESTLOG.md).

---

## Ты здесь

Если у вас уже работает:

| Проверка | URL |
|---|---|
| API | http://localhost:8080/api/healthz → `{"status":"ok"}` |
| БД | http://localhost:8080/api/readyz → `{"status":"ready"}` |
| Web | http://localhost:5000 |

**→ Фазы 0–1 пройдены. Переходите к [TESTPLAN § Фаза 2](./TESTPLAN.md#фаза-2--web-обход-всех-страниц--сейчас).**

Быстрый чек перед обходом страниц:

1. F12 → **Network** на :5000 — нет красных `/api`?
2. Откройте http://localhost:5000/games — видна **Rogue Fable III**?
3. Пройдите таблицу URL из TESTPLAN §2.2; баги — в TESTLOG

Если healthz **не** ok — сначала [Быстрый старт](#быстрый-старт) ниже.

---

## Быстрый старт

### Вариант A — одна команда (рекомендуется)

```bash
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git
cd GLM2pHost228322MLGsnoopDOGsigmaTROLOLO
pnpm quickstart
```

`pnpm quickstart` поднимает Postgres в Docker (если есть), создаёт `.env`, ставит зависимости, применяет схему БД и запускает API + Web.

### Вариант B — по шагам

```bash
pnpm infra:up     # Postgres + Redis (Docker)
pnpm setup        # .env, install, db push
pnpm dev          # API :8080 + Web :5000
./scripts/smoke-api.sh
```

### Вариант C — Windows (cmd)

```bat
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git
cd GLM2pHost228322MLGsnoopDOGsigmaTROLOLO

scripts\setup-local.bat
scripts\dev-local.bat
scripts\smoke-api.bat
```

Если Docker не установлен — поставьте [PostgreSQL 16](https://www.postgresql.org/download/windows/), создайте базу `decentral_hub` и укажите `DATABASE_URL` в `.env`.

| Сервис | URL |
|---|---|
| Web | http://localhost:5000 |
| API health | http://localhost:8080/api/healthz |
| API ready | http://localhost:8080/api/readyz |

---

## Требования

- [Node.js 20+](https://nodejs.org/) (рекомендуется 22 — `.nvmrc`)
- [pnpm](https://pnpm.io/installation): `npm install -g pnpm`
- **Docker** (проще всего) **или** [PostgreSQL 16](https://www.postgresql.org/download/windows/)

---

## Что можно отложить

| Компонент | Когда нужен |
|---|---|
| Redis | Горизонтальное масштабирование API — локально не обязателен |
| coturn / TURN | Реальный WebRTC через NAT — для локальной разработки UI не нужен |
| host-agent | Стриминг с Windows-ПК — только для фазы WebRTC |
| VirusTotal, S3 | Загрузки модов — деградируют без ключей |
| JWT / auth | Генерируется при `pnpm setup`; гостевой режим работает и без |

---

## Роли

| Кто | Задача |
|---|---|
| **Вы** | Браузер, 2 окна WebRTC, Electron-агент, скрины/console при багах |
| **Agent** | Фиксы в коде, TESTPLAN/TESTLOG, smoke при необходимости |

Не нужно заново clone/setup, если healthz ok и `pnpm dev` уже запущен.
