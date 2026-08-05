@echo off
chcp 65001 >nul
cd /d "%~dp0.."

where docker >nul 2>&1
if errorlevel 1 (
  echo Docker не найден. Установи Docker Desktop или PostgreSQL вручную.
  exit /b 1
)

echo ==^> Запуск PostgreSQL 16 + Redis
docker compose -f infra\docker-compose.dev.yml up -d postgres redis

echo.
echo PostgreSQL: postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub
echo Redis:      redis://localhost:6379
echo Остановить: pnpm infra:down
