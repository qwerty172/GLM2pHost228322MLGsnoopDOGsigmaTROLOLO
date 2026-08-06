@echo off
chcp 65001 >nul
cd /d "%~dp0.."
node scripts\run-setup.mjs
exit /b %errorlevel%
