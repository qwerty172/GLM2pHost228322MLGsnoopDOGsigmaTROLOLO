@echo off
chcp 65001 >nul
cd /d "%~dp0.."

echo ==^> DecentralHub — локальная настройка (Windows)
echo.

where docker >nul 2>&1
if %errorlevel%==0 (
  echo Docker найден — поднимаем postgres + redis
  bash scripts/docker-infra.sh up
  if errorlevel 1 (
    echo Не удалось запустить docker — настрой DATABASE_URL в .env вручную
    node scripts\ensure-env.mjs
  ) else (
    node scripts\wait-for-port.mjs 127.0.0.1 5432 90000
    node scripts\ensure-env.mjs --docker
  )
) else (
  echo Docker не найден — настрой DATABASE_URL в .env вручную
  node scripts\ensure-env.mjs
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
  echo Ошибка db push — проверь PostgreSQL и DATABASE_URL в .env
  exit /b 1
)

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo   Готово! Запуск:
echo.
echo     pnpm dev
echo.
echo   Web:  http://localhost:5000
echo   API:  http://localhost:8080/api/healthz
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
