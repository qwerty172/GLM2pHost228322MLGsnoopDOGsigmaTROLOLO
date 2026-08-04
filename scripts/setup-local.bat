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

call :fill_secret WALLET_ENCRYPTION_KEY
call :fill_secret JWT_SECRET
goto :after_secrets

:fill_secret
findstr /r /c:"^%~1=$" .env >nul 2>&1
if %errorlevel%==0 (
  for /f "delims=" %%K in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set KEY=%%K
  powershell -NoProfile -Command "(Get-Content .env) -replace '^%~1=$', '%~1=%KEY%' | Set-Content .env -Encoding UTF8"
  echo Сгенерирован %~1
)
exit /b 0

:after_secrets
echo.
echo ==^> pnpm install
call pnpm install
if errorlevel 1 exit /b 1

echo.
echo ==^> Схема БД (нужен PostgreSQL и DATABASE_URL в .env)
echo    Подсказка: pnpm db:up — поднять Postgres через Docker
call pnpm --filter @workspace/db run push
if errorlevel 1 (
  echo.
  echo Ошибка db push — проверь что PostgreSQL запущен и DATABASE_URL в .env правильный
  exit /b 1
)

echo.
echo Готово. Запуск: pnpm dev  или  scripts\dev-local.bat
echo Web: http://localhost:5000
echo API: http://localhost:8080/api/healthz
