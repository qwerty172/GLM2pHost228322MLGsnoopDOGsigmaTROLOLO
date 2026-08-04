@echo off
chcp 65001 >nul
cd /d "%~dp0.."

set FAST=0
if /I "%~1"=="--fast" set FAST=1

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
  echo DATABASE_URL -^> docker-compose defaults
)

call :ensure_secret WALLET_ENCRYPTION_KEY
call :ensure_secret JWT_SECRET

echo.
echo ==^> pnpm install
call pnpm install
if errorlevel 1 exit /b 1

echo.
echo ==^> Схема БД (нужен PostgreSQL — pnpm db:up или свой инстанс)
call pnpm --filter @workspace/db run push
if errorlevel 1 (
  echo.
  echo Ошибка db push — запусти PostgreSQL: pnpm db:up
  exit /b 1
)

if "%FAST%"=="0" (
  echo.
  echo ==^> Проверка типов
  call pnpm run typecheck
  if errorlevel 1 exit /b 1
) else (
  echo.
  echo Пропуск typecheck (--fast^)
)

echo.
echo Готово. Запуск: pnpm dev
echo Web: http://localhost:5000
exit /b 0

:ensure_secret
findstr /r /c:"^%1=$" .env >nul 2>&1
if %errorlevel% neq 0 goto :eof
for /f "delims=" %%V in ('node -e "console.log(require(''crypto'').randomBytes(32).toString(''hex''))"') do set SECRET=%%V
powershell -NoProfile -Command "(Get-Content .env) -replace '^%1=$', '%1=%SECRET%' | Set-Content .env -Encoding UTF8"
echo Сгенерирован %1
goto :eof
