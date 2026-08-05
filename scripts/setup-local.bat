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

if "%SETUP_USE_DOCKER%"=="1" goto apply_docker
findstr /r /c:"^DATABASE_URL=postgresql://user:password@" .env >nul 2>&1
if %errorlevel%==0 goto apply_docker
goto skip_docker

:apply_docker
powershell -NoProfile -Command "(Get-Content .env) -replace '^DATABASE_URL=.*', 'DATABASE_URL=postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub' | Set-Content .env -Encoding UTF8"
echo DATABASE_URL -^> docker-compose (decentral_hub/decentral_hub)
:skip_docker

findstr /r /c:"^WALLET_ENCRYPTION_KEY=$" .env >nul 2>&1
if %errorlevel%==0 (
  for /f "delims=" %%K in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set KEY=%%K
  powershell -NoProfile -Command "(Get-Content .env) -replace '^WALLET_ENCRYPTION_KEY=$', 'WALLET_ENCRYPTION_KEY=%KEY%' | Set-Content .env -Encoding UTF8"
  echo Сгенерирован WALLET_ENCRYPTION_KEY
)

findstr /r /c:"^JWT_SECRET=$" .env >nul 2>&1
if %errorlevel%==0 (
  for /f "delims=" %%J in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set JWT=%%J
  powershell -NoProfile -Command "(Get-Content .env) -replace '^JWT_SECRET=$', 'JWT_SECRET=%JWT%' | Set-Content .env -Encoding UTF8"
  echo Сгенерирован JWT_SECRET
)

echo.
echo ==^> pnpm install
call pnpm install
if errorlevel 1 exit /b 1

echo.
echo ==^> Схема БД (нужен PostgreSQL — pnpm infra:up или свой)
call pnpm --filter @workspace/db run push
if errorlevel 1 (
  echo.
  echo db push не прошёл. Запусти: pnpm infra:up
  exit /b 1
)

if "%SETUP_SKIP_TYPECHECK%"=="0" (
  echo ==^> Проверка типов
  call pnpm run typecheck
) else (
  echo Проверка типов пропущена (pnpm setup:full — с typecheck)
)

echo.
echo Готово. Запуск: pnpm go
echo Web: http://localhost:5000
