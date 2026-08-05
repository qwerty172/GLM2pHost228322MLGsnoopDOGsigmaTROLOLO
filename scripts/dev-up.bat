@echo off
chcp 65001 >nul
cd /d "%~dp0.."

echo ╔══════════════════════════════════════════╗
echo ║  DecentralHub — быстрый старт            ║
echo ╚══════════════════════════════════════════╝
echo.

echo ==^> Подготовка .env
if not exist .env (
  copy .env.example .env >nul
  echo   Создан .env из .env.example
)

findstr /r /c:"^WALLET_ENCRYPTION_KEY=$" .env >nul 2>&1
if %errorlevel%==0 (
  for /f "delims=" %%K in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set WKEY=%%K
  powershell -NoProfile -Command "(Get-Content .env) -replace '^WALLET_ENCRYPTION_KEY=$', 'WALLET_ENCRYPTION_KEY=%WKEY%' | Set-Content .env -Encoding UTF8"
  echo   Сгенерирован WALLET_ENCRYPTION_KEY
)

findstr /r /c:"^JWT_SECRET=$" .env >nul 2>&1
if %errorlevel%==0 (
  for /f "delims=" %%K in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set JKEY=%%K
  powershell -NoProfile -Command "(Get-Content .env) -replace '^JWT_SECRET=$', 'JWT_SECRET=%JKEY%' | Set-Content .env -Encoding UTF8"
  echo   Сгенерирован JWT_SECRET
)

where docker >nul 2>&1
if %errorlevel%==0 (
  echo.
  echo ==^> Запуск PostgreSQL и Redis ^(Docker^)
  docker compose -f infra/docker-compose.dev.yml up -d postgres redis
  echo   Ожидание PostgreSQL ^(15с^)...
  timeout /t 15 /nobreak >nul
) else (
  echo.
  echo ==^> Docker не найден — используй свой PostgreSQL ^(см. DATABASE_URL в .env^)
)

echo.
echo ==^> Установка зависимостей
call pnpm install
if errorlevel 1 exit /b 1

echo.
echo ==^> Применение схемы БД
call pnpm --filter @workspace/db run push
if errorlevel 1 (
  echo.
  echo Ошибка db push — проверь DATABASE_URL в .env или запусти: pnpm db:up
  exit /b 1
)

echo.
echo ==^> Запуск API + Web
call scripts\dev-local.bat
