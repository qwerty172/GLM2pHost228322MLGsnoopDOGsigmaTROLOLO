# Быстрый старт — 3 команды

Минимальный путь: **взял → запустил → играешь в браузере**. Без Windows-агента, без Redis/TURN.

## 1. Postgres

**Docker (проще всего):**

```bash
docker compose -f infra/docker-compose.dev.yml up -d postgres
```

**Или** свой PostgreSQL 16 с базой `decentral_hub`.

## 2. Настройка

```bash
cp .env.example .env   # если ещё нет
pnpm setup             # install + секреты + схема БД
```

В `.env` по умолчанию уже стоит `DATABASE_URL` для Docker Postgres. Если свой Postgres — поменяй только эту строку.

## 3. Запуск

```bash
pnpm dev
```

Открой http://localhost:5000

## Демо за 30 секунд

1. http://localhost:5000/games
2. **Rogue Fable III** → **«Хостить в браузере»**
3. Скопируй ссылку для игрока → открой во второй вкладке

Гостевой кошелёк создаётся автоматически.

## Проверка API

```bash
pnpm smoke
```

## Что можно отложить

| Фича | Когда нужна |
|------|-------------|
| Windows-агент (`host-agent`) | Стрим с реального ПК |
| Redis | Масштабирование API |
| TURN/coturn | WebRTC через жёсткий NAT |
| JWT / Sentry / VirusTotal | Продакшен |

Подробнее: [LOCAL_SETUP.md](./LOCAL_SETUP.md) · [TESTPLAN.md](./TESTPLAN.md)
