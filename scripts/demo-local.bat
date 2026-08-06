@echo off
REM Windows wrapper for demo-local.sh (Git Bash)
setlocal
cd /d "%~dp0\.."
bash scripts/demo-local.sh %*
