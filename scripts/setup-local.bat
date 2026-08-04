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

call :gen_key WALLET_ENCRYPTION_KEY
call :gen_key JWT_SECRET
goto :after_gen

:gen_key
findstr /r /c:"^%~1=$" .env >nul 2>&1
if %errorlevel%==0 (
  for /f "delims=" %%K in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set KEY=%%K
  powershell -NoProfile -Command "(Get-Content .env) -replace '^%~1=$', '%~1=%KEY%' | Set-Content .env -Encoding UTF8"
  echo Сгенерирован %~1
)
exit /b 0

:after_gen

where docker >nul 2>&1
if %errorlevel%==0 (
  echo.
  echo ==^> Docker — поднимаем PostgreSQL
  docker compose -f infra\docker-compose.dev.yml up -d postgres
  timeout /t 2 /nobreak >nul
) else (
  echo Docker не найден — убедись что PostgreSQL запущен
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
  echo db push не прошёл. Попробуй: pnpm up  или проверь DATABASE_URL в .env
  exit /b 1
)

echo.
echo Готово. Запуск: pnpm dev  или  scripts\dev-local.bat
echo Web: http://localhost:5000
