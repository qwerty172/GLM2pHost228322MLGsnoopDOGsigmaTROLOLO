# Быстрый старт DecentralHub

Одна страница — всё, что нужно, чтобы **сразу** запустить платформу локально. Остальное (хостинг, marathon, coturn) — когда понадобится.

## За 30 секунд

```bash
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git
cd GLM2pHost228322MLGsnoopDOGsigmaTROLOLO
pnpm quickstart
```

`pnpm quickstart` делает всё сам:

1. Поднимает PostgreSQL + Redis в Docker (если Docker доступен)
2. Создаёт `.env`, генерирует `JWT_SECRET` и `WALLET_ENCRYPTION_KEY`
3. Устанавливает зависимости и применяет схему БД
4. Запускает API (`:8080`) и Web (`:5000`)

Открой **http://localhost:5000** — можно играть.

## Команды

| Команда | Что делает |
|---------|------------|
| `pnpm quickstart` | Всё с нуля: docker + setup + dev |
| `pnpm setup` | Только настройка (без запуска серверов) |
| `pnpm dev` | API + Web (нужен готовый `.env` и БД) |
| `pnpm infra:up` | Docker: postgres + redis |
| `pnpm infra:down` | Остановить postgres + redis |

## Проверка здоровья

| URL | Ожидание |
|-----|----------|
| http://localhost:8080/api/healthz | `{"status":"ok"}` — API жив |
| http://localhost:8080/api/readyz | `{"status":"ok","database":"connected"}` — API + БД |
| http://localhost:5000 | Лендинг открывается |

## Первый опыт игрока

1. На главной нажми **«Попробовать демо»** → каталог Rogue Fable III
2. Гостевой кошелёк создаётся автоматически — **500 LZT** на балансе
3. Выбери хоста → **Играть**

Регистрация, кошелёк, обмен — когда захочешь, не сейчас.

## Первый опыт хоста

1. **Стать хостом** → дашборд с чеклистом «Быстрый старт»
2. Скачай агент → `start.bat` на Windows-ПК
3. Код привязки выдаётся **автоматически** — вставь в агент
4. Добавь игру → «Выйти в онлайн» в агенте

Нет Windows? В дашборде → **Расширенно** → «Проверить самому» (браузерный стрим).

## Без Docker

Нужен локальный PostgreSQL 16:

```bash
createdb decentral_hub
cp .env.example .env
# отредактируй DATABASE_URL
pnpm setup
pnpm dev
```

## Что отложить на потом

- **coturn / TURN** — для WebRTC через NAT в проде (`infra/docker-compose.dev.yml` → coturn)
- **host-agent** — только Windows, `pnpm --filter @workspace/host-agent run dev`
- **Полный тест-план** — [`TESTPLAN.md`](../TESTPLAN.md)
- **Деплой** — [`HOSTING.md`](../HOSTING.md)
