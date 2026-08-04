@echo off
chcp 65001 >nul
cd /d "%~dp0.."

if not exist .env (
  echo Нет .env — сначала запусти: scripts\setup-local.bat
  exit /b 1
)

echo ==^> Запуск API (порт 8080) и Web (порт 5000) в отдельных окнах...
start "DecentralHub API" cmd /k "cd /d %CD% && pnpm --filter @workspace/api-server run dev"
timeout /t 3 /nobreak >nul
start "DecentralHub Web" cmd /k "cd /d %CD% && pnpm --filter @workspace/web run dev"

echo.
echo API:  http://localhost:8080/api/healthz
echo Web:  http://localhost:5000
echo Демо: http://localhost:5000/try
echo.
echo Два окна cmd открыты — закрой их чтобы остановить серверы.
