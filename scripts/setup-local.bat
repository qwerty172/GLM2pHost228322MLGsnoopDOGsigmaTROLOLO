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

call :genkey WALLET_ENCRYPTION_KEY
call :genkey JWT_SECRET
goto :after_gen

:genkey
findstr /r /c:"^%~1=$" .env >nul 2>&1
if %errorlevel%==0 (
  for /f "delims=" %%K in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set KEY=%%K
  powershell -NoProfile -Command "(Get-Content .env) -replace '^%~1=$', '%~1=%KEY%' | Set-Content .env -Encoding UTF8"
  echo Сгенерирован %~1
)
goto :eof

:after_gen

echo.
echo ==^> pnpm install
call pnpm install
if errorlevel 1 exit /b 1

echo.
echo Подсказка: Postgres через Docker — pnpm infra:up

echo.
echo ==^> Схема БД (нужен PostgreSQL и DATABASE_URL в .env)
call pnpm --filter @workspace/db run push
if errorlevel 1 (
  echo.
  echo db push не прошёл. Запусти Postgres: pnpm infra:up или настрой DATABASE_URL
  exit /b 1
)

echo.
echo Готово. Запуск: pnpm dev  или  scripts\dev-local.bat
echo Web: http://localhost:5000
