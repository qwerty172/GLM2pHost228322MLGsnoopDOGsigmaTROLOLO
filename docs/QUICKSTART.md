# Быстрый старт DecentralHub

Одна команда — и можно открывать http://localhost:5000.

## Требования

- **Node.js** 20+
- **pnpm** 9+ (устанавливается автоматически при `corepack enable`)
- **Docker** (опционально, но рекомендуется) — PostgreSQL + Redis из коробки

## За 30 секунд

```bash
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git
cd GLM2pHost228322MLGsnoopDOGsigmaTROLOLO
pnpm quickstart
```

`pnpm quickstart` делает всё сам:

1. Поднимает PostgreSQL + Redis (`docker compose`)
2. Создаёт `.env`, генерирует секреты (`JWT_SECRET`, `WALLET_ENCRYPTION_KEY`)
3. Ставит зависимости и применяет схему БД
4. Запускает API (:8080) и Web (:5000)

Открой **http://localhost:5000** — каталог игр и хостов.

## Пошагово (если нужен контроль)

```bash
pnpm infra:up    # только Docker: postgres + redis
pnpm setup       # .env + install + db push
pnpm dev         # API + Web
```

Остановить инфраструктуру: `pnpm infra:down`

## Проверка

| URL | Ожидание |
|-----|----------|
| http://localhost:8080/api/healthz | `{"status":"ok"}` |
| http://localhost:8080/api/readyz | `{"status":"ok","db":"connected"}` |
| http://localhost:5000 | Главная страница |

```bash
./scripts/smoke-api.sh   # smoke API
pnpm smoke:invite        # полный invite-flow
```

## Игрок

1. Открой http://localhost:5000/hosts
2. Нажми **Играть** у любого онлайн-хоста
3. Гостевой кошелёк создаётся автоматически — **500 LZT** на первую игру

Регистрация не нужна. Потом можно оформить полный аккаунт из меню.

## Хост

1. http://localhost:5000/host — дашборд
2. Скачай агент → `start.bat` на Windows
3. Следуй карточке **Быстрый старт** (5 шагов)

Нет Windows? Попробуй **браузерные игры** в каталоге — стрим из вкладки без агента.

## Дальше

- [LOCAL_SETUP.md](../LOCAL_SETUP.md) — детальная настройка
- [TESTPLAN.md](../TESTPLAN.md) — полный план тестирования
- [HOSTING.md](../HOSTING.md) — агент, browser-host, захват окна
