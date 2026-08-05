@echo off
chcp 65001 >nul
cd /d "%~dp0.."

if not exist .env (
  echo Нет .env — сначала запусти: pnpm setup
  exit /b 1
)

echo ==^> Запуск API (порт 8080) и Web (порт 5000) в отдельных окнах...
start "DecentralHub API" cmd /k "cd /d %CD% && pnpm --filter @workspace/api-server run dev"
echo Ждём API...
for /L %%i in (1,1,60) do (
  curl -sf http://127.0.0.1:8080/api/healthz >nul 2>&1 && goto api_ready
  timeout /t 1 /nobreak >nul
)
echo API не ответил за 60 с — проверь DATABASE_URL и окно API
exit /b 1
:api_ready
start "DecentralHub Web" cmd /k "cd /d %CD% && pnpm --filter @workspace/web run dev"

echo.
echo API:  http://localhost:8080/api/healthz
echo Web:  http://localhost:5000
echo Демо: http://localhost:5000/games/rogue-fable-3
echo.
echo Два окна cmd открыты — закрой их чтобы остановить серверы.
