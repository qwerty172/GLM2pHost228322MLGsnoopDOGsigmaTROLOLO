@echo off
chcp 65001 >nul
cd /d "%~dp0.."

where docker >nul 2>&1
if errorlevel 1 (
  echo Docker не найден — пропускаем. Установи PostgreSQL вручную или Docker Desktop.
  exit /b 0
)

docker info >nul 2>&1
if errorlevel 1 (
  echo Docker не запущен — пропускаем. Запусти Docker Desktop.
  exit /b 0
)

echo ==^> Запуск PostgreSQL и Redis...
docker compose -f infra/docker-compose.dev.yml up -d postgres redis
if errorlevel 1 exit /b 1

echo ==^> Ожидание PostgreSQL...
set /a N=0
:wait_pg
set /a N+=1
if %N% GTR 30 (
  echo PostgreSQL не ответил за 30 с
  exit /b 1
)
docker compose -f infra/docker-compose.dev.yml exec -T postgres pg_isready -U decentral_hub >nul 2>&1
if errorlevel 1 (
  timeout /t 1 /nobreak >nul
  goto wait_pg
)

echo PostgreSQL готов
exit /b 0
