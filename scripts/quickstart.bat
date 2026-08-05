@echo off
chcp 65001 >nul
cd /d "%~dp0.."

where docker >nul 2>&1
if %errorlevel%==0 (
  echo ==^> PostgreSQL + Redis через Docker
  docker compose -f infra/docker-compose.dev.yml up -d postgres redis
  timeout /t 5 /nobreak >nul
) else (
  echo Docker не найден — нужен свой PostgreSQL в .env
)

set SKIP_TYPECHECK=1
call scripts\setup-local.bat
if errorlevel 1 exit /b 1
call scripts\dev-local.bat
