@echo off

setlocal
cd /d "%~dp0"
set "HOST=127.0.0.1"
set "PORT=4180"
set "ASIC_USER=root"
set "ASIC_PASSWORD=root"

echo.
echo ASIC ToolBox
 echo Local-only mode: http://127.0.0.1:%PORT%
echo Close this window to stop the server.
echo.

if exist "%~dp0runtime\node.exe" (
  set "NODE=%~dp0runtime\node.exe"
) else (
  where node >nul 2>nul
  if errorlevel 1 (
    echo Node.js was not found.
    echo Put a portable Node.js runtime into the runtime folder or install Node.js for your user.
    pause
    exit /b 1
  )
  set "NODE=node"
)

start "" /b powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Milliseconds 700; Start-Process 'http://127.0.0.1:%PORT%'"
"%NODE%" "%~dp0server.js"

echo.
echo Server stopped.
pause
