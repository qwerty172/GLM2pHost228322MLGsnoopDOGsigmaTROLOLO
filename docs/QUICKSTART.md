# Быстрый старт DecentralHub

Один путь — сразу играть. Остальное — по желанию.

## За 3 минуты

```bash
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git
cd GLM2pHost228322MLGsnoopDOGsigmaTROLOLO
pnpm quickstart
```

Открой http://localhost:5000 → **«Попробовать демо»** → играй в Rogue Fable III в браузере.  
Регистрация не нужна — 500 LZT на счёте сразу.

## Что делает `pnpm quickstart`

1. Поднимает PostgreSQL + Redis через Docker (если Docker установлен)
2. Создаёт `.env`, генерирует `JWT_SECRET` и `WALLET_ENCRYPTION_KEY`
3. `pnpm install` + миграции БД
4. Запускает API (:8080) и Web (:5000)

## Команды

| Команда | Что делает |
|---------|------------|
| `pnpm quickstart` | Всё с нуля: Docker + setup + dev |
| `pnpm setup` | Только настройка (без запуска) |
| `pnpm dev` | Запуск API + Web (после setup) |
| `pnpm infra:up` | Только PostgreSQL + Redis в Docker |
| `pnpm infra:down` | Остановить Docker-контейнеры |

## Проверка

```bash
curl http://localhost:8080/api/healthz   # {"status":"ok"}
curl http://localhost:8080/api/readyz    # {"status":"ok","db":"ok"}
./scripts/smoke-api.sh
```

## Игрок

- **Демо без установки:** главная → «Попробовать демо»
- **Живые хосты:** `/hosts` — список онлайн-ПК
- **Каталог:** `/games` — все игры

## Хост

- **Без Windows:** `/games/rogue-fable-3` → «Хостить» — браузерный хост
- **С Windows:** `/host` → скачать агент → код привязки выдаётся автоматически

Расширенные настройки (тест-сессия, квоты, привязка exe) — в блоке «Расширенно» на дашборде хоста.

## Без Docker

Установи PostgreSQL 16, создай базу `decentral_hub`, пропиши `DATABASE_URL` в `.env`, затем:

```bash
pnpm setup
pnpm dev
```

## Подробнее

- [README.md](../README.md) — архитектура
- [LOCAL_SETUP.md](../LOCAL_SETUP.md) — детальная настройка
- [TESTPLAN.md](../TESTPLAN.md) — план тестирования
