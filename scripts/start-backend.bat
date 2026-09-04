@echo off
title Study Abroad - Backend (API)
cd /d "%~dp0\.."
if exist "venv\Scripts\python.exe" (
    set "PY=venv\Scripts\python.exe"
) else (
    set "PY=python"
)
echo Backend API starting on http://127.0.0.1:8000  (leave this window open)
echo.
echo NOTE: auto-reload (--reload) is intentionally OFF. This project lives in a
echo Dropbox-synced folder, and --reload was restarting the server every time
echo Dropbox touched a file (.next, node_modules, conflict copies, etc.), causing
echo brief "Connection problem" outages in the app. Restart this window manually
echo after editing backend code in src\.
echo.
%PY% -m uvicorn src.backend.main:app --port 8000
pause
