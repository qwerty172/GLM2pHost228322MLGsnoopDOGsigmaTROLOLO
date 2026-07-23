# Локальный запуск на своём ПК

> Эти команды вводятся **на твоём компьютере**, не в облачном Cursor Agent.
> Agent уже имеет копию репозитория в облаке, но тестировать P2P/WebRTC нужно у себя.

## Куда вводить команды (Windows)

1. Установи [Git for Windows](https://git-scm.com/download/win) (если ещё нет)
2. Открой **Git Bash** (Пуск → Git Bash) **или** **Windows Terminal** / **cmd**
3. Вставляй команды туда и жми Enter

Альтернатива: открой папку проекта в **Cursor / VS Code** → меню **Terminal → New Terminal** → вводи там.

## Требования

- [Node.js 20+](https://nodejs.org/)
- [pnpm](https://pnpm.io/installation): `npm install -g pnpm`
- [PostgreSQL 16](https://www.postgresql.org/download/windows/)

После установки PostgreSQL создай базу:

```sql
CREATE DATABASE decentral_hub;
```

Или в cmd: `createdb decentral_hub` (если `createdb` в PATH).

## Быстрый старт (Windows)

```bat
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git
cd GLM2pHost228322MLGsnoopDOGsigmaTROLOLO
git checkout cursor/local-test-prep-9755

copy .env.example .env
notepad .env
```

В `.env` измени строку `DATABASE_URL`, например:

```
DATABASE_URL=postgresql://postgres:ТВОЙ_ПАРОЛЬ@localhost:5432/decentral_hub
```

Дальше — два `.bat` файла (двойной клик или из cmd):

```bat
scripts\setup-local.bat    :: один раз: install + db push
scripts\dev-local.bat      :: запуск API + Web
```

Открой в браузере: **http://localhost:5000**

## Быстрый старт (Git Bash / Linux / macOS)

```bash
git clone https://github.com/qwerty172/GLM2pHost228322MLGsnoopDOGsigmaTROLOLO.git
cd GLM2pHost228322MLGsnoopDOGsigmaTROLOLO
git checkout cursor/local-test-prep-9755

cp .env.example .env
# отредактируй DATABASE_URL

chmod +x scripts/*.sh
./scripts/setup-local.sh
./scripts/dev-local.sh
```

## Что дальше

Следуй [TESTPLAN.md](./TESTPLAN.md), баги пиши в [TESTLOG.md](./TESTLOG.md).

## Почему agent сам не может

Cloud Agent работает на удалённом сервере без твоего PostgreSQL, без браузера с WebRTC и без Windows для Electron-агента. Подготовить код и инструкции — может. Запустить у тебя на ПК — только ты.
