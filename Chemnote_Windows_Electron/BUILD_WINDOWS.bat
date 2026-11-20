@echo off
setlocal
cd /d "%~dp0"
echo === ChemNote Windows Build ===
where node >nul 2>nul
if errorlevel 1 (
  echo [LOI] May tinh chua cai Node.js LTS!
  echo Vui long tai Node.js tai: https://nodejs.org/
  pause
  exit /b 1
)
call npm install
if errorlevel 1 (
  echo [LOI] npm install that bai!
  pause
  exit /b 1
)
call npm run dist:win
if errorlevel 1 (
  echo [LOI] Build .exe that bai!
  pause
  exit /b 1
)
echo.
echo [THANH CONG] Da xuat file .exe trong thu muc: %~dp0dist\
explorer "%~dp0dist"
pause
