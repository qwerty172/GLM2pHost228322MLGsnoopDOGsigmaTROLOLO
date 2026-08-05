@echo off
chcp 65001 >nul
cd /d "%~dp0.."

echo ==^> DecentralHub — локальная настройка (Windows)

where docker >nul 2>&1
if %errorlevel%==0 (
  node scripts/setup-env.mjs --docker
  echo.
  echo ==^> Docker Postgres
  call pnpm db:up
  node scripts/wait-for-postgres.mjs
) else (
  node scripts/setup-env.mjs
  echo Docker не найден — проверьте PostgreSQL и DATABASE_URL в .env
)

echo.
echo ==^> pnpm install
call pnpm install
if errorlevel 1 exit /b 1

echo.
echo ==^> Схема БД
call pnpm --filter @workspace/db run push
if errorlevel 1 (
  echo.
  echo Ошибка db push — проверь что PostgreSQL запущен и DATABASE_URL в .env правильный
  exit /b 1
)

echo.
echo Готово. Запуск: pnpm dev  или  scripts\dev-local.bat
echo Web: http://localhost:5000
