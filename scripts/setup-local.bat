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

findstr /r /c:"^DATABASE_URL=postgresql://user:password@" .env >nul 2>&1
if %errorlevel%==0 (
  powershell -NoProfile -Command "(Get-Content .env) -replace '^DATABASE_URL=.*', 'DATABASE_URL=postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub' | Set-Content .env -Encoding UTF8"
  echo DATABASE_URL -^> docker-compose
)

for %%K in (WALLET_ENCRYPTION_KEY JWT_SECRET) do (
  findstr /r /c:"^%%K=$" .env >nul 2>&1
  if !errorlevel!==0 (
    for /f "delims=" %%V in ('node -e "console.log(require(''crypto'').randomBytes(32).toString(''hex''))"') do set SECRET=%%V
    powershell -NoProfile -Command "(Get-Content .env) -replace '^%%K=$', '%%K=!SECRET!' | Set-Content .env -Encoding UTF8"
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
  echo.
  echo Ошибка db push — подними БД: pnpm infra:up
  exit /b 1
)

if not "%SKIP_TYPECHECK%"=="1" (
  echo.
  echo ==^> Проверка типов
  call pnpm run typecheck
)

echo.
echo Готово. Запуск: pnpm dev
echo Web: http://localhost:5000
