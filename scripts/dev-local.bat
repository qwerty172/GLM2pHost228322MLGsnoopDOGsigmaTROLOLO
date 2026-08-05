@echo off
chcp 65001 >nul
cd /d "%~dp0.."

if not exist .env (
  echo Нет .env — сначала запусти: pnpm setup
  exit /b 1
)

echo ==^> Запуск через pnpm dev...
call pnpm dev

