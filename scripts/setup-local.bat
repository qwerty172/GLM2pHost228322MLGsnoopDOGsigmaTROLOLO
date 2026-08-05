@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0.."

echo ==^> DecentralHub — локальная настройка (Windows)

if not exist .env (
  copy .env.example .env >nul
  echo Создан .env из .env.example
) else (
  echo .env уже есть
)

call :gen_secret WALLET_ENCRYPTION_KEY
call :gen_secret JWT_SECRET
goto :after_secrets

:gen_secret
findstr /r /c:"^%1=$" .env >nul 2>&1
if %errorlevel%==0 (
  for /f "delims=" %%K in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set KEY=%%K
  powershell -NoProfile -Command "(Get-Content .env) -replace '^%1=$', '%1=%KEY%' | Set-Content .env -Encoding UTF8"
  echo Сгенерирован %1
)
exit /b 0

:after_secrets
where docker >nul 2>&1
if %errorlevel%==0 (
  echo ==^> Запуск PostgreSQL (docker compose)...
  docker compose -f infra/docker-compose.dev.yml up -d postgres
) else (
  echo Docker не найден — убедись что PostgreSQL запущен и DATABASE_URL в .env верный
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
echo Web:  http://localhost:5000/games
echo API:  http://localhost:8080/api/healthz
