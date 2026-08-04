# Быстрый старт DecentralHub

Один путь от нуля до работающего локального стенда.

## За 2 команды

```bash
pnpm quickstart
```

Поднимает Docker Postgres+Redis (если Docker доступен), создаёт `.env`, применяет схему БД и запускает API + Web.

Открой http://localhost:5000

## Пошагово (если нужен контроль)

```bash
pnpm infra:up    # Postgres + Redis в Docker
pnpm setup       # .env, pnpm install, db push, typecheck
pnpm dev         # API :8080 + Web :5000
```

Остановить инфраструктуру: `pnpm infra:down`

## Проверка

```bash
curl http://localhost:8080/api/healthz   # процесс жив
curl http://localhost:8080/api/readyz    # БД доступна (503 = ещё не готов)
./scripts/smoke-api.sh
```

## Попробовать без настройки хоста

1. Открой http://localhost:5000
2. Нажми **«Попробовать демо»** → Rogue Fable III (браузерная игра, агент не нужен)
3. Или **«Хостить»** на карточке игры — стрим из своей вкладки

Гостевой кошелёк создаётся автоматически с **500 LZT** на первую сессию.

## Стать хостом (Windows)

1. `/host` → скачай агент → `start.bat`
2. Вставь **код привязки** (6 цифр) из дашборда
3. Добавь игру → «Выйти в онлайн»

Расширенные настройки (тест-сессия, квоты, привязка exe) — в блоке **«Расширенно»** на дашборде.

## Переменные окружения

Скопируй `.env.example` → `.env`. При `pnpm setup` автоматически генерируются:

- `WALLET_ENCRYPTION_KEY`
- `JWT_SECRET`

`DATABASE_URL` по умолчанию совпадает с `infra/docker-compose.dev.yml`:

```
postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub
```

## Дальше

- Полный план тестирования: [`TESTPLAN.md`](../TESTPLAN.md)
- Детальная настройка: [`LOCAL_SETUP.md`](../LOCAL_SETUP.md)
- Windows-агент: [`artifacts/host-agent/README.md`](../artifacts/host-agent/README.md)
