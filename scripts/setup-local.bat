@echo off
chcp 65001 >nul
cd /d "%~dp0.."

echo ==^> DecentralHub — локальная настройка (Windows)
echo     (опционально позже: TURN, host-agent, внешние API-ключи)

call scripts\infra-up.bat

if not exist .env (
  copy .env.example .env >nul
  echo Создан .env
) else (
  echo .env уже есть
)

findstr /r /c:"^DATABASE_URL=postgresql://user:password@" .env >nul 2>&1
if %errorlevel%==0 (
  powershell -NoProfile -Command "(Get-Content .env) -replace '^DATABASE_URL=.*', 'DATABASE_URL=postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub' | Set-Content .env -Encoding UTF8"
  echo DATABASE_URL -^> docker-compose
)

findstr /r /c:"^WALLET_ENCRYPTION_KEY=$" .env >nul 2>&1
if %errorlevel%==0 (
  for /f "delims=" %%K in ('node -e "console.log(require(''crypto'').randomBytes(32).toString(''hex''))"') do set KEY=%%K
  powershell -NoProfile -Command "(Get-Content .env) -replace '^WALLET_ENCRYPTION_KEY=$', 'WALLET_ENCRYPTION_KEY=%KEY%' | Set-Content .env -Encoding UTF8"
  echo Сгенерирован WALLET_ENCRYPTION_KEY
)

findstr /r /c:"^JWT_SECRET=$" .env >nul 2>&1
if %errorlevel%==0 (
  for /f "delims=" %%J in ('node -e "console.log(require(''crypto'').randomBytes(32).toString(''hex''))"') do set JWT=%%J
  powershell -NoProfile -Command "(Get-Content .env) -replace '^JWT_SECRET=$', 'JWT_SECRET=%JWT%' | Set-Content .env -Encoding UTF8"
  echo Сгенерирован JWT_SECRET
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
  echo Ошибка db push — проверь PostgreSQL (Docker или локальный) и DATABASE_URL в .env
  exit /b 1
)

echo.
echo Готово. Запуск: pnpm dev
echo Web: http://localhost:5000
echo API: http://localhost:8080/api/healthz
