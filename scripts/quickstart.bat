@echo off
chcp 65001 >nul
cd /d "%~dp0.."

echo ╔══════════════════════════════════════════════════╗
echo ║  DecentralHub — быстрый старт (локальный dev)    ║
echo ╚══════════════════════════════════════════════════╝
echo.

where docker >nul 2>&1
if not errorlevel 1 (
  echo ==^> [1/3] Docker: PostgreSQL + Redis
  call scripts\infra-up.bat
) else (
  echo ==^> [1/3] Docker не найден — нужен свой PostgreSQL
)

echo.
echo ==^> [2/3] Настройка проекта
set SETUP_USE_DOCKER=1
call scripts\setup-local.bat
if errorlevel 1 exit /b 1

echo.
echo ==^> [3/3] Запуск API + Web
call scripts\dev-local.bat
