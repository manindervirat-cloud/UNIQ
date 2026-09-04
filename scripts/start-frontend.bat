@echo off
title Study Abroad - Frontend (app)
cd /d "%~dp0\..\frontend"
echo Frontend starting on http://localhost:3000  (leave this window open)
echo.

:: PRODUCTION MODE (next start) - NOT dev mode (next dev).
::
:: This project lives in a Dropbox-synced folder. `next dev` watches the
:: folder and hot-reloads on every Dropbox mtime touch. When Dropbox
:: swaps/touches files mid-session, the dev server momentarily loses track
:: of a route's components, the render fails, and Next.js falls back to the
:: error page - but this is a pure App Router app with no pages/_error or
:: pages/500, so the fallback finds nothing and the browser shows
::   "missing required error components, refreshing..."
:: ...stuck in a reload loop because Dropbox keeps churning the watcher.
:: (See node_modules\next\dist\server\base-server.js - the dev-only fallback
:: literally notes it fires "when a project directory has been moved/deleted".)
::
:: `next start` serves a pre-built app with NO file watcher, so Dropbox
:: sync cannot disrupt it. This mirrors removing --reload from the backend.
::
:: Trade-off: no hot-reload. After editing frontend code in src\, rebuild:
::   delete the frontend\.next folder and relaunch, or run `npm run build`
::   in this folder, then restart this window.
if not exist ".next\BUILD_ID" (
    echo Build not found - building once ^(~30-60s^)...
    call npm run build
    if errorlevel 1 (
        echo.
        echo [!] Frontend build failed - see errors above.
        echo     If Dropbox is syncing this folder, pause it and try again.
        pause
        exit /b 1
    )
) else (
    echo [ok] Existing build found - skipping build
)
echo.
echo [ok] Starting production server...
call npm run start
pause
