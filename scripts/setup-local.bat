@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
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

call :fill_secret WALLET_ENCRYPTION_KEY
call :fill_secret JWT_SECRET
goto after_secrets

:fill_secret
findstr /r /c:"^%~1=$" .env >nul 2>&1
if errorlevel 1 goto :eof
for /f "delims=" %%V in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set VAL=%%V
powershell -NoProfile -Command "(Get-Content .env) -replace '^%~1=$', '%~1=!VAL!' | Set-Content .env -Encoding UTF8"
echo Сгенерирован %~1
goto :eof

:after_secrets
echo.
echo ==^> pnpm install
call pnpm install
if errorlevel 1 exit /b 1

echo.
echo ==^> Ждём PostgreSQL на localhost:5432…
set /a WAIT=0
:wait_pg
powershell -NoProfile -Command "try { $c = New-Object System.Net.Sockets.TcpClient('localhost', 5432); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel%==0 goto pg_ready
set /a WAIT+=1
if %WAIT% GEQ 45 goto pg_timeout
timeout /t 1 /nobreak >nul
goto wait_pg

:pg_timeout
echo PostgreSQL не ответил за 45с — пробуем db push всё равно
goto db_push

:pg_ready
echo PostgreSQL доступен

:db_push
echo.
echo ==^> Схема БД
call pnpm --filter @workspace/db run push
if errorlevel 1 (
  echo.
  echo Ошибка db push — проверь PostgreSQL и DATABASE_URL в .env
  echo Подсказка: pnpm db:up  — поднять Postgres в Docker
  exit /b 1
)

if "%FAST%"=="0" (
  echo.
  echo ==^> Проверка типов
  call pnpm run typecheck
  if errorlevel 1 exit /b 1
)

echo.
echo Готово. Запуск: pnpm dev
echo Web:  http://localhost:5000
echo API:  http://localhost:8080/api/healthz
