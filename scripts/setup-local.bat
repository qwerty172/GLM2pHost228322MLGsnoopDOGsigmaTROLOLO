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

where docker >nul 2>&1
if %errorlevel%==0 (
  echo ==^> Docker: postgres + redis
  docker compose -f infra/docker-compose.dev.yml up -d postgres redis
  findstr /r /c:"^DATABASE_URL=postgresql://user:password@" .env >nul 2>&1
  if %errorlevel%==0 (
    powershell -NoProfile -Command "(Get-Content .env) -replace '^DATABASE_URL=.*', 'DATABASE_URL=postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub' | Set-Content .env -Encoding UTF8"
    echo DATABASE_URL -^> Docker Compose
  )
) else (
  echo Docker не найден — настрой DATABASE_URL в .env вручную
)

call :ensure_secret WALLET_ENCRYPTION_KEY
call :ensure_secret JWT_SECRET

echo.
echo ==^> pnpm install
call pnpm install
if errorlevel 1 exit /b 1

echo.
echo ==^> Схема БД
call pnpm --filter @workspace/db run push
if errorlevel 1 (
  echo.
  echo Ошибка db push — проверь PostgreSQL и DATABASE_URL в .env
  exit /b 1
)

echo.
echo Готово. Запуск: scripts\dev-local.bat  или  pnpm dev
echo Web: http://localhost:5000
exit /b 0

:ensure_secret
findstr /r /c:"^%~1=$" .env >nul 2>&1
if %errorlevel%==0 (
  for /f "delims=" %%K in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set KEY=%%K
  powershell -NoProfile -Command "(Get-Content .env) -replace '^%~1=$', '%~1=%KEY%' | Set-Content .env -Encoding UTF8"
  echo Сгенерирован %~1
)
exit /b 0
