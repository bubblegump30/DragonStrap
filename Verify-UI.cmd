@echo off
setlocal
cd /d "%~dp0"
title DragonStrap UI verification

echo DragonStrap UI verification
echo Project: %CD%
echo.
where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js and npm are required. Install Node.js, then run this file again.
  goto failed
)
if not exist "node_modules\electron\dist\electron.exe" (
  echo [1/2] Installing project dependencies...
  call npm install
  if errorlevel 1 goto failed
) else (
  echo [1/2] Dependencies already installed.
)
echo.
echo [2/2] Checking the DragonStrap layout...
call npm run ui:verify
if errorlevel 1 goto failed
echo.
echo UI verification passed.
pause
exit /b 0

:failed
echo.
echo UI verification could not finish. Keep this window open and share the error above.
pause
exit /b 1
