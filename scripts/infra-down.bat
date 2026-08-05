@echo off
chcp 65001 >nul
cd /d "%~dp0.."

docker compose -f infra/docker-compose.dev.yml down
echo PostgreSQL и Redis остановлены.
