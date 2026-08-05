@echo off
chcp 65001 >nul
cd /d "%~dp0.."

echo ╔══════════════════════════════════════════╗
echo ║  DecentralHub — быстрый старт (1 команда) ║
echo ╚══════════════════════════════════════════╝
echo.

where docker >nul 2>&1
if %errorlevel%==0 (
  echo ==^> Docker: Postgres + Redis
  docker compose -f infra\docker-compose.dev.yml up -d postgres redis
  if errorlevel 1 docker-compose -f infra\docker-compose.dev.yml up -d postgres redis
  timeout /t 5 /nobreak >nul
) else (
  echo Docker не найден — нужен PostgreSQL вручную
)

call scripts\setup-local.bat
if errorlevel 1 exit /b 1

echo.
echo Запуск API + Web...
call scripts\dev-local.bat
