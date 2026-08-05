@echo off
chcp 65001 >nul
cd /d "%~dp0.."

echo ==^> DecentralHub — bootstrap (взял и юзаешь)

where docker >nul 2>&1
if errorlevel 1 (
  echo Docker не найден. Установи Docker Desktop или используй scripts\setup-local.bat с локальным PostgreSQL.
  exit /b 1
)

echo ==^> PostgreSQL + Redis (Docker)
docker compose -f infra/docker-compose.dev.yml up -d postgres redis
if errorlevel 1 exit /b 1

echo ==^> Ожидание PostgreSQL...
set /a WAIT=0
:wait_pg
docker compose -f infra/docker-compose.dev.yml exec -T postgres pg_isready -U decentral_hub -d decentral_hub >nul 2>&1
if %errorlevel%==0 goto pg_ready
set /a WAIT+=1
if %WAIT% geq 45 (
  echo PostgreSQL не ответил — проверь: docker compose -f infra/docker-compose.dev.yml logs postgres
  exit /b 1
)
timeout /t 1 /nobreak >nul
goto wait_pg
:pg_ready

if not exist .env (
  copy .env.example .env >nul
  echo Создан .env
)

powershell -NoProfile -Command ^
  "$envFile = '.env';" ^
  "$db = 'postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub';" ^
  "$lines = Get-Content $envFile;" ^
  "$keys = @{DATABASE_URL=$db; REDIS_URL='redis://localhost:6379'};" ^
  "foreach ($k in $keys.Keys) {" ^
  "  if ($lines -match \"^$k=\") { $lines = $lines -replace \"^$k=.*\", \"$k=$($keys[$k])\" } else { $lines += \"$k=$($keys[$k])\" }" ^
  "};" ^
  "if ($lines -match '^WALLET_ENCRYPTION_KEY=$') {" ^
  "  $key = node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\";" ^
  "  $lines = $lines -replace '^WALLET_ENCRYPTION_KEY=$', \"WALLET_ENCRYPTION_KEY=$key\";" ^
  "};" ^
  "if (-not ($lines -match '^JWT_SECRET=.')) {" ^
  "  $jwt = node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\";" ^
  "  if ($lines -match '^JWT_SECRET=') { $lines = $lines -replace '^JWT_SECRET=.*', \"JWT_SECRET=$jwt\" } else { $lines += \"JWT_SECRET=$jwt\" }" ^
  "};" ^
  "$lines | Set-Content $envFile -Encoding UTF8"

echo.
echo ==^> pnpm install
call pnpm install
if errorlevel 1 exit /b 1

echo.
echo ==^> Схема БД
call pnpm --filter @workspace/db run push
if errorlevel 1 exit /b 1

echo.
echo Готово.
echo   Запуск: scripts\dev-local.bat
echo   Web:    http://localhost:5000
echo   Демо:   «Попробовать демо» на главной или Rogue Fable III -^> Хостить
echo.
