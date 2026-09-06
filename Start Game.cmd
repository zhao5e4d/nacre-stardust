@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or newer is required. Install it from https://nodejs.org/
  pause
  exit /b 1
)
if not exist "dist\client\index.html" (
  if not exist "node_modules" call npm install
  call npm run build
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
node scripts/serve.mjs --open
pause
