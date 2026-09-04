@echo off
setlocal
title Study Abroad AI - Dev Servers
cd /d "%~dp0.."

:: Launches both servers ONLY - it does not install dependencies or build.
:: Use this for day-to-day restarts once setup is done.
:: For a first run (or after deleting frontend\.next), use START_HERE.bat in
:: the repository root instead: it installs deps, builds the frontend, then
:: launches both servers in the right order.
::
:: Note: the frontend runs in production mode (next start). See
:: start-frontend.bat for why dev mode is avoided in this Dropbox folder.

echo ============================================================
echo   Study Abroad AI - Dev Servers
echo ============================================================
echo.
echo   Launching backend (http://127.0.0.1:8000)
echo   and frontend (http://localhost:3000)...
echo.
echo   Close the two server windows to stop.
echo ============================================================
echo.

start "Study Abroad - Backend (API)" cmd /k ""%~dp0start-backend.bat""
timeout /t 3 /nobreak >nul
start "Study Abroad - Frontend (app)" cmd /k ""%~dp0start-frontend.bat""

exit /b 0
