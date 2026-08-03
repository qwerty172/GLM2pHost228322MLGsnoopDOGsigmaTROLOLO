@echo off
chcp 65001 >nul
cd /d "%~dp0.."

echo ==^> DecentralHub — локальная настройка (Windows)

if not exist .env (
  copy .env.example .env >nul
  echo Создан .env из .env.example
) else (
  echo .env уже есть
)

set USE_DOCKER=0
where docker >nul 2>&1
if %errorlevel%==0 (
  docker info >nul 2>&1
  if %errorlevel%==0 (
    echo.
    echo ==^> Инфраструктура (Docker: PostgreSQL + Redis)
    docker compose -f infra/docker-compose.dev.yml up -d postgres redis
    timeout /t 5 /nobreak >nul
    set USE_DOCKER=1
  )
)

if %USE_DOCKER%==0 (
  echo Docker недоступен — нужен свой PostgreSQL 16 ^(см. DATABASE_URL в .env^)
)

echo.
echo ==^> Секреты и подключения

for /f "delims=" %%K in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set HEX=%%K

findstr /r /c:"^DATABASE_URL=postgresql://user:password@" .env >nul 2>&1
if %errorlevel%==0 if %USE_DOCKER%==1 (
  powershell -NoProfile -Command "(Get-Content .env) -replace '^DATABASE_URL=.*', 'DATABASE_URL=postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub' | Set-Content .env -Encoding UTF8"
  echo   -^> DATABASE_URL ^(Docker^)
)

findstr /r /c:"^WALLET_ENCRYPTION_KEY=$" .env >nul 2>&1
if %errorlevel%==0 (
  powershell -NoProfile -Command "(Get-Content .env) -replace '^WALLET_ENCRYPTION_KEY=$', 'WALLET_ENCRYPTION_KEY=%HEX%' | Set-Content .env -Encoding UTF8"
  echo   -^> WALLET_ENCRYPTION_KEY
)

for /f "delims=" %%K in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set JWT=%%K
findstr /r /c:"^JWT_SECRET=$" .env >nul 2>&1
if %errorlevel%==0 (
  powershell -NoProfile -Command "(Get-Content .env) -replace '^JWT_SECRET=$', 'JWT_SECRET=%JWT%' | Set-Content .env -Encoding UTF8"
  echo   -^> JWT_SECRET
)

findstr /r /c:"^ADMIN_SECRET=change-me-local-dev" .env >nul 2>&1
if %errorlevel%==0 (
  powershell -NoProfile -Command "(Get-Content .env) -replace '^ADMIN_SECRET=change-me-local-dev', 'ADMIN_SECRET=local-dev-secret' | Set-Content .env -Encoding UTF8"
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
  echo Ошибка db push — проверь PostgreSQL ^(Docker или свой^) и DATABASE_URL в .env
  exit /b 1
)

echo.
echo Готово — можно сразу запускать:
echo   pnpm dev      — API :8080 + Web :5000
echo   pnpm smoke    — проверка API
echo.
echo Позже: pnpm typecheck, pnpm db:up, coturn для WebRTC
