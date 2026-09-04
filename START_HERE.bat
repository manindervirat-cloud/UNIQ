@echo off
setlocal
title Study Abroad AI - Setup ^& Launch
cd /d "%~dp0"

echo ============================================================
echo   Study Abroad AI Platform - One-Click Setup ^& Launch
echo ============================================================
echo.
echo   This script will:
echo     1. Check Node.js installation
echo     2. Install backend dependencies (Python)
echo     3. Install frontend dependencies (Node.js)
echo     4. Build the frontend
echo     5. Start both servers
echo.
echo ============================================================
echo.

:: ---------- 1. Check Node.js ----------
where node >nul 2>nul
if errorlevel 1 (
    echo [!] Node.js is not installed.
    echo.
    echo     Please install it first ^(one time only^):
    echo       1. Open  https://nodejs.org
    echo       2. Download the LTS version and install with defaults
    echo       3. Run this file again
    echo.
    start https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do echo [ok] Node.js %%v found

:: ---------- 2. Python backend dependencies ----------
echo.
echo [1/3] Checking backend dependencies...
if exist "venv\Scripts\python.exe" (
    set "PY=venv\Scripts\python.exe"
) else (
    set "PY=python"
)

:: Only run pip install when the backend deps are NOT already importable.
:: Re-running pip on every launch is slow and network-dependent, and a flaky
:: connection can block or fail startup even when deps are already present.
%PY% -c "import uvicorn, fastapi, pydantic, dotenv" >nul 2>nul
if errorlevel 1 (
    echo     Dependencies missing - installing from requirements.txt...
    %PY% -m pip install -r requirements.txt --quiet --disable-pip-version-check
    if errorlevel 1 (
        echo [!] pip install failed - check your internet connection and try again.
        pause
        exit /b 1
    )
) else (
    echo     [ok] Already installed - skipping
)
echo [ok] Backend ready

:: ---------- 3. Frontend dependencies (first run only) ----------
echo.
echo [2/4] Installing frontend dependencies ^(first run takes a few minutes^)...
if not exist "frontend\node_modules" (
    pushd frontend
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo [!] npm install failed - check your internet connection and try again.
        popd
        pause
        exit /b 1
    )
    popd
) else (
    echo [ok] Already installed - skipping
)

:: ---------- 4. Frontend production build (first run only) ----------
::
:: The frontend runs in production mode (next start), not dev mode (next dev),
:: because `next dev` watches this Dropbox-synced folder and loses track of
:: route components when Dropbox touches files - which surfaced in the browser
:: as "missing required error components, refreshing..." in a reload loop.
:: See scripts\start-frontend.bat for the full explanation.
::
:: The build is done HERE, before the browser opens, so the app is actually
:: ready by the time the browser navigates to it.
echo.
echo [3/4] Building the frontend ^(first run takes 30-60 seconds^)...
if not exist "frontend\.next\BUILD_ID" (
    pushd frontend
    call npm run build
    if errorlevel 1 (
        echo.
        echo [!] Frontend build failed - see errors above.
        echo     If Dropbox is syncing this folder, pause syncing and try again.
        popd
        pause
        exit /b 1
    )
    popd
) else (
    echo [ok] Existing build found - skipping
)

:: ---------- 5. Launch both servers ----------
echo.
echo [4/4] Starting the app...
start "Study Abroad - Backend (API)" cmd /k ""%~dp0scripts\start-backend.bat""
timeout /t 3 /nobreak >nul
start "Study Abroad - Frontend (App)" cmd /k ""%~dp0scripts\start-frontend.bat""

echo.
echo ============================================================
echo   Two windows opened: Backend ^(API^) and Frontend ^(app^).
echo   Your browser will open http://localhost:3000 shortly.
echo.
echo   To stop the app: Close both server windows.
echo.
echo   After editing frontend code in frontend\src, delete the
echo   frontend\.next folder and run this file again to rebuild.
echo ============================================================
timeout /t 8 /nobreak >nul
start http://localhost:3000
exit /b 0
