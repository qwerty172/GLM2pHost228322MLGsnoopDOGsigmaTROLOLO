@echo off
chcp 65001 >nul
cd /d "%~dp0.."

echo ==^> DecentralHub — локальная настройка (Windows)

if not exist .env (
  copy .env.example .env >nul
  echo Создан .env — открой его и настрой DATABASE_URL
) else (
  echo .env уже есть
)

findstr /r /c:"^WALLET_ENCRYPTION_KEY=$" .env >nul 2>&1
if %errorlevel%==0 (
  for /f "delims=" %%K in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set KEY=%%K
  powershell -NoProfile -Command "(Get-Content .env) -replace '^WALLET_ENCRYPTION_KEY=$', 'WALLET_ENCRYPTION_KEY=%KEY%' | Set-Content .env -Encoding UTF8"
  echo Сгенерирован WALLET_ENCRYPTION_KEY
)

echo.
echo ==^> pnpm install
call pnpm install
if errorlevel 1 exit /b 1

echo.
echo ==^> Схема БД (нужен PostgreSQL и DATABASE_URL в .env)
call pnpm --filter @workspace/db run push
if errorlevel 1 (
  echo.
  echo Ошибка db push — проверь что PostgreSQL запущен и DATABASE_URL в .env правильный
  exit /b 1
)

echo Готово. Запуск: pnpm dev  (или scripts\dev-local.bat)
