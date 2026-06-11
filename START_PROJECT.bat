@echo off
REM Quick Start - School Management System
REM This script will get you running in 2 minutes

cls
echo.
echo ========================================
echo School Management System - Quick Start
echo ========================================
echo.

REM Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js not installed
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✓ Node.js !NODE_VERSION! found
echo.

REM Create .env if missing
if not exist ".env" (
    echo Creating .env file...
    (
        echo NODE_ENV=development
        echo PORT=3000
        echo JWT_SECRET=dev-secret-local-12345
        echo REFRESH_TOKEN_SECRET=dev-refresh-local-54321
        echo DATABASE_URL=postgresql://postgres:postgres@localhost:5432/school_management
        echo FRONTEND_URL=http://localhost:5173
        echo VITE_API_URL=http://localhost:3000/api
    ) > .env
)

REM Clean old node_modules if issues
echo.
echo Would you like to:
echo 1. Do a clean install (removes node_modules)
echo 2. Quick start (use existing node_modules)
echo.
set /p choice="Enter choice (1 or 2): "

if "%choice%"=="1" (
    echo Cleaning node_modules...
    if exist "backend\node_modules" rmdir /s /q "backend\node_modules"
    if exist "frontend\node_modules" rmdir /s /q "frontend\node_modules"
    echo Done.
    echo.
)

echo Installing dependencies...
echo.

REM Backend
echo Installing backend...
cd backend
if not exist "node_modules" (
    call npm install --prefer-offline
) else (
    echo Backend dependencies ready
)
cd ..

REM Frontend  
echo Installing frontend...
cd frontend
if not exist "node_modules" (
    call npm install --prefer-offline
) else (
    echo Frontend dependencies ready
)
cd ..

echo.
echo ========================================
echo Starting services...
echo ========================================
echo.

REM Start both services
start "Backend - School Management" cmd /k "cd backend && npm run dev"
timeout /t 3 /nobreak

start "Frontend - School Management" cmd /k "cd frontend && npm run dev"
timeout /t 3 /nobreak

echo.
echo ========================================
echo Services Started!
echo ========================================
echo.
echo Frontend:  http://localhost:5173
echo Backend:   http://localhost:3000/api
echo Health:    http://localhost:3000/health
echo.
echo Test Login:
echo   Email: admin@example.com
echo   Password: Admin123!@
echo.
echo Features Ready to See:
echo   ✓ Real-time Dashboard
echo   ✓ Advanced Filtering
echo   ✓ Export (PDF/Excel/CSV)
echo   ✓ Dashboard Builder
echo   ✓ Dark Mode
echo.
echo Press any key to close this window...
pause

