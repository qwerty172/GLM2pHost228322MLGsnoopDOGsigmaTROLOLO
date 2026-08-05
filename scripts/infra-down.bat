@echo off
chcp 65001 >nul
cd /d "%~dp0.."
docker compose -f infra\docker-compose.dev.yml stop postgres redis 2>nul
echo PostgreSQL и Redis остановлены.
