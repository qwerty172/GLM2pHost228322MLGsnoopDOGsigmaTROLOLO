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

call :ensure_key WALLET_ENCRYPTION_KEY
call :ensure_key JWT_SECRET

where docker >nul 2>&1
if %errorlevel%==0 (
  docker info >nul 2>&1
  if %errorlevel%==0 (
    echo ==^> Docker найден — поднимаем PostgreSQL + Redis
    docker compose -f infra/docker-compose.dev.yml up -d postgres redis

    findstr /r /c:"^DATABASE_URL=postgresql://user:password@" .env >nul 2>&1
    if %errorlevel%==0 (
      powershell -NoProfile -Command "(Get-Content .env) -replace '^DATABASE_URL=.*', 'DATABASE_URL=postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub' | Set-Content .env -Encoding UTF8"
      echo DATABASE_URL настроен под docker-compose
    )

    findstr /r /c:"^# REDIS_URL=" .env >nul 2>&1
    if %errorlevel%==0 (
      powershell -NoProfile -Command "(Get-Content .env) -replace '^# REDIS_URL=.*', 'REDIS_URL=redis://localhost:6379' | Set-Content .env -Encoding UTF8"
      echo REDIS_URL включён
    )
  )
) else (
  echo.
  echo Docker не найден — нужен локальный PostgreSQL 16.
  echo   Вариант A: установи Docker Desktop и перезапусти setup
  echo   Вариант B: отредактируй DATABASE_URL в .env
  echo.
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
  echo Ошибка db push — проверь что PostgreSQL запущен и DATABASE_URL в .env правильный
  exit /b 1
)

echo.
echo Готово! Запуск: pnpm dev
echo Web: http://localhost:5000
goto :eof

:ensure_key
findstr /r /c:"^%1=$" .env >nul 2>&1
if %errorlevel%==0 (
  for /f "delims=" %%K in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set KEY=%%K
  powershell -NoProfile -Command "(Get-Content .env) -replace '^%1=$', '%1=%KEY%' | Set-Content .env -Encoding UTF8"
  echo Сгенерирован %1
)
goto :eof
