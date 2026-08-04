@echo off
chcp 65001 >nul
cd /d "%~dp0.."

echo ==^> DecentralHub — локальная настройка (Windows)

if not exist .env (
  copy .env.example .env >nul
  echo Создан .env
) else (
  echo .env уже есть
)

for /f "delims=" %%K in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set GENKEY=%%K

findstr /r /c:"^WALLET_ENCRYPTION_KEY=$" .env >nul 2>&1
if %errorlevel%==0 (
  powershell -NoProfile -Command "(Get-Content .env) -replace '^WALLET_ENCRYPTION_KEY=$', 'WALLET_ENCRYPTION_KEY=%GENKEY%' | Set-Content .env -Encoding UTF8"
  echo Сгенерирован WALLET_ENCRYPTION_KEY
)

findstr /r /c:"^JWT_SECRET=$" .env >nul 2>&1
if %errorlevel%==0 (
  for /f "delims=" %%J in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set JWTKEY=%%J
  powershell -NoProfile -Command "(Get-Content .env) -replace '^JWT_SECRET=$', 'JWT_SECRET=%JWTKEY%' | Set-Content .env -Encoding UTF8"
  echo Сгенерирован JWT_SECRET
)

findstr /c:"postgresql://user:password@" .env >nul 2>&1
if %errorlevel%==0 (
  powershell -NoProfile -Command "(Get-Content .env) -replace '^DATABASE_URL=.*', 'DATABASE_URL=postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub' | Set-Content .env -Encoding UTF8"
  echo DATABASE_URL -^> Docker PostgreSQL
)

echo.
echo ==^> pnpm install
call pnpm install
if errorlevel 1 exit /b 1

echo.
echo ==^> Схема БД (нужен PostgreSQL)
call pnpm --filter @workspace/db run push
if errorlevel 1 (
  echo Ошибка db push — проверь PostgreSQL и DATABASE_URL
  exit /b 1
)

echo.
echo Готово. Запуск: scripts\dev-local.bat
echo Web: http://localhost:5000
