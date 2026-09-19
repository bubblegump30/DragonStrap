@echo off
setlocal
cd /d "%~dp0.."

if not exist "node_modules\electron\dist\electron.exe" (
  echo DragonStrap dependencies are not installed.
  echo.
  echo Run: npm install
  pause
  exit /b 1
)

start "" wscript.exe "%~dp0Start-DragonStrap.vbs"
exit /b 0
