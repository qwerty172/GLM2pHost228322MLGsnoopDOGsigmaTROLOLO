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

findstr /r /c:"^WALLET_ENCRYPTION_KEY=$" .env >nul 2>&1
if %errorlevel%==0 (
  for /f "delims=" %%K in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set KEY=%%K
  powershell -NoProfile -Command "(Get-Content .env) -replace '^WALLET_ENCRYPTION_KEY=$', 'WALLET_ENCRYPTION_KEY=%KEY%' | Set-Content .env -Encoding UTF8"
  echo Сгенерирован WALLET_ENCRYPTION_KEY
)

findstr /r /c:"^JWT_SECRET=$" .env >nul 2>&1
if %errorlevel%==0 (
  for /f "delims=" %%K in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set KEY=%%K
  powershell -NoProfile -Command "(Get-Content .env) -replace '^JWT_SECRET=$', 'JWT_SECRET=%KEY%' | Set-Content .env -Encoding UTF8"
  echo Сгенерирован JWT_SECRET
)

echo.
echo ==^> pnpm install
call pnpm install
if errorlevel 1 exit /b 1

echo.
echo ==^> Схема БД (нужен PostgreSQL — pnpm dev:db или свой Postgres)
call pnpm --filter @workspace/db run push
if errorlevel 1 (
  echo.
  echo Ошибка db push — запусти: pnpm dev:db
  echo или проверь DATABASE_URL в .env
  exit /b 1
)

echo.
echo Готово. Запуск: pnpm dev
echo Web: http://localhost:5000
echo Демо: http://localhost:5000/games/rogue-fable-3
