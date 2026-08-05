@echo off
chcp 65001 >nul
cd /d "%~dp0.."

set "DOCKER_DB_URL=postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub"

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
  for /f "delims=" %%K in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set JWT=%%K
  powershell -NoProfile -Command "(Get-Content .env) -replace '^JWT_SECRET=$', 'JWT_SECRET=%JWT%' | Set-Content .env -Encoding UTF8"
  echo Сгенерирован JWT_SECRET
)

where docker >nul 2>&1
if %errorlevel%==0 (
  findstr /c:"%DOCKER_DB_URL%" .env >nul 2>&1
  if %errorlevel%==0 (
    echo.
    echo ==^> PostgreSQL в Docker
    docker compose -f infra/docker-compose.dev.yml up -d postgres
    if errorlevel 1 (
      echo Не удалось поднять Docker Postgres — проверь Docker Desktop
    ) else (
      echo DATABASE_URL совпадает с Docker Compose
    )
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
  echo db push не удался. Запусти Docker: pnpm run docker:db
  echo или настрой DATABASE_URL в .env
  exit /b 1
)

echo.
echo Готово. Запуск: pnpm dev  или  scripts\dev-local.bat
echo Web: http://localhost:5000
