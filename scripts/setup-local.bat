@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
cd /d "%~dp0.."

set USE_DOCKER=0
if "%~1"=="--docker" set USE_DOCKER=1

echo ==^> DecentralHub — локальная настройка (Windows)

if not exist .env (
  copy .env.example .env >nul
  echo Создан .env
) else (
  echo .env уже есть
)

if "%USE_DOCKER%"=="1" (
  echo ==^> Docker: PostgreSQL + Redis
  docker compose -f infra/docker-compose.dev.yml up -d postgres redis
  if errorlevel 1 (
    echo Docker не запустился — установи Docker Desktop или убери --docker
    exit /b 1
  )
  powershell -NoProfile -Command "(Get-Content .env) -replace '^DATABASE_URL=.*', 'DATABASE_URL=postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub' | Set-Content .env -Encoding UTF8"
  echo DATABASE_URL -^> docker-compose
  timeout /t 5 /nobreak >nul
)

for %%K in (WALLET_ENCRYPTION_KEY JWT_SECRET) do (
  findstr /r /c:"^%%K=$" .env >nul 2>&1
  if !errorlevel!==0 (
    for /f "delims=" %%V in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set SECRET=%%V
    powershell -NoProfile -Command "(Get-Content .env) -replace '^%%K=$', '%%K=%SECRET%' | Set-Content .env -Encoding UTF8"
    echo Сгенерирован %%K
  )
)

echo.
echo ==^> pnpm install
call pnpm install
if errorlevel 1 exit /b 1

echo.
echo ==^> Схема БД
call pnpm --filter @workspace/db run push
if errorlevel 1 (
  echo Ошибка db push — проверь PostgreSQL и DATABASE_URL в .env
  echo Или: scripts\setup-local.bat --docker
  exit /b 1
)

echo.
echo Готово! Запуск: pnpm dev  или  scripts\dev-local.bat
echo Web: http://localhost:5000
