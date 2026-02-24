@echo off
title YGIF Server Launcher
echo ========================================
echo   YGIF - YouTube Global Insight Finder
echo ========================================
echo.

echo [1/2] Starting Python Backend (port 8000)...
start "YGIF Backend" cmd /k "cd /d %~dp0backend && python main.py"

echo [2/2] Starting Next.js Frontend (port 3000)...
start "YGIF Frontend" cmd /k "cd /d %~dp0 && npm run dev"

echo.
echo ========================================
echo   Servers are starting...
echo   - Backend:  http://localhost:8000
echo   - Frontend: http://localhost:3000
echo ========================================
echo.
echo Press any key to open the browser...
pause > nul
start http://localhost:3000
