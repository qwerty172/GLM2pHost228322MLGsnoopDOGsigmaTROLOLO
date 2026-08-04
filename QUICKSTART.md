# Быстрый старт — 3 команды

Взял репозиторий → запустил → играешь. Агент, TURN, квоты — потом.

## 1. Настройка (один раз)

**С Docker** (рекомендуется — не нужен локальный PostgreSQL):

```bash
pnpm setup:docker
```

**Без Docker** (PostgreSQL уже установлен):

```bash
cp .env.example .env   # если ещё нет
# отредактируй DATABASE_URL при необходимости
pnpm setup
```

Скрипт сам сгенерирует `WALLET_ENCRYPTION_KEY` и `JWT_SECRET`, применит схему БД.

## 2. Запуск

```bash
pnpm dev
```

| Сервис | URL |
|--------|-----|
| Web | http://localhost:5000 |
| API | http://localhost:8080/api/healthz |

## 3. Попробовать сразу

### Игрок (без регистрации)

1. Открой http://localhost:5000
2. Нажми **«Попробовать демо»** → Rogue Fable III
3. Или перейди на `/games/rogue-fable-3`

### Хост (без Windows-агента)

1. Открой http://localhost:5000/host
2. Введи имя → **Зарегистрировать**
3. На дашборде нажми **«Попробовать в браузере»**
4. Откроется тест-сессия — играй сразу

Агент, привязка игр, квоты — в блоке **«Расширенно»** на дашборде, когда понадобятся.

---

## Полезные команды

```bash
pnpm dev              # API + Web
pnpm setup:check      # setup + полный typecheck
pnpm docker:up        # только PostgreSQL + Redis
pnpm docker:down      # остановить контейнеры
pnpm run typecheck    # проверка типов
./scripts/smoke-api.sh  # smoke-тест API
```

## Если что-то не работает

| Симптом | Решение |
|---------|---------|
| `db push` падает | `pnpm docker:up` или проверь `DATABASE_URL` |
| Web не на :5000 | Убедись, что в `.env` есть `WEB_PORT=5000` |
| JWT / кошелёк 503 | Перезапусти `pnpm setup` — секреты сгенерируются |
| healthz не ok | API ещё стартует — подожди 10–20 с |

Подробнее: [LOCAL_SETUP.md](./LOCAL_SETUP.md) · [TESTPLAN.md](./TESTPLAN.md)
