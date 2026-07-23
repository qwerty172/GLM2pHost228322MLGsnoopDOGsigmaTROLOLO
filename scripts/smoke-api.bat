@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set "BASE=%~1"
if "%BASE%"=="" set "BASE=http://localhost:8080"

echo Smoke-test: %BASE%

call :check GET /api/healthz 200 || exit /b 1
call :check GET /api/games 200 || exit /b 1
call :check GET /api/games/rogue-fable-3 200 || exit /b 1
call :check GET /api/hosts 200 || exit /b 1
call :check GET /api/quotas 200 || exit /b 1
call :check GET /api/loans/requests 200 || exit /b 1
call :check_post /api/players/register 201 "{\"guest\":true}" || exit /b 1

echo Done.
exit /b 0

:check
set "METHOD=%~1"
set "PATH=%~2"
set "EXPECTED=%~3"
for /f %%C in ('curl -s -o nul -w "%%{http_code}" "%BASE%%PATH%"') do set "CODE=%%C"
if "!CODE!"=="!EXPECTED!" (
  echo OK  !METHOD! !PATH! -^> !CODE!
  exit /b 0
)
echo FAIL !METHOD! !PATH! -^> !CODE! ^(expected !EXPECTED!^)
exit /b 1

:check_post
set "PATH=%~1"
set "EXPECTED=%~2"
set "BODY=%~3"
for /f %%C in ('curl -s -o nul -w "%%{http_code}" -X POST "%BASE%%PATH%" -H "content-type: application/json" -d "!BODY!"') do set "CODE=%%C"
if "!CODE!"=="!EXPECTED!" (
  echo OK  POST !PATH! -^> !CODE!
  exit /b 0
)
echo FAIL POST !PATH! -^> !CODE! ^(expected !EXPECTED!^)
exit /b 1
