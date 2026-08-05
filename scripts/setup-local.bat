@echo off
chcp 65001 >nul
cd /d "%~dp0.."
node scripts/setup.mjs
if errorlevel 1 exit /b 1
