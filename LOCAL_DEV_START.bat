@echo off
REM School Management System - Local Development Startup Script (Windows)
REM This script sets up and starts all services for local development

setlocal enabledelayedexpansion

echo.
echo ===============================================
echo 🚀 School Management System - Local Dev Setup
echo ===============================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ❌ Node.js is not installed
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✓ Node.js %NODE_VERSION% detected
echo.

REM Create .env file if it doesn't exist
if not exist ".env" (
    echo 📝 Creating .env file...
    (
        echo # Local Development Environment
        echo NODE_ENV=development
        echo PORT=3000
        echo JWT_SECRET=dev-secret-change-in-production-123456789
        echo REFRESH_TOKEN_SECRET=dev-refresh-secret-987654321
        echo DATABASE_URL=postgresql://postgres:postgres@localhost:5432/school_management
        echo FRONTEND_URL=http://localhost:5173
        echo LOG_LEVEL=debug
        echo VITE_API_URL=http://localhost:3000/api
    ) > .env
    echo ✓ .env file created
) else (
    echo ✓ .env file already exists
)

REM Install backend dependencies
echo.
echo 📦 Installing backend dependencies...
cd backend
if not exist "node_modules" (
    call npm install
    echo ✓ Backend dependencies installed
) else (
    echo ✓ Backend dependencies already installed
)
cd ..

REM Install frontend dependencies
echo.
echo 📦 Installing frontend dependencies...
cd frontend
if not exist "node_modules" (
    call npm install
    echo ✓ Frontend dependencies installed
) else (
    echo ✓ Frontend dependencies already installed
)
cd ..

REM Install mobile dependencies
echo.
echo 📦 Installing mobile dependencies...
cd mobile
if not exist "node_modules" (
    call npm install
    echo ✓ Mobile dependencies installed
) else (
    echo ✓ Mobile dependencies already installed
)
cd ..

echo.
echo ===============================================
echo ✓ Setup complete!
echo ===============================================
echo.
echo Starting services...
echo.

REM Start backend in new window
echo ▶️ Starting backend on port 3000...
start "School Management - Backend" cmd /k "cd backend && npm run dev"
timeout /t 3 /nobreak

REM Start frontend in new window
echo ▶️ Starting frontend on port 5173...
start "School Management - Frontend" cmd /k "cd frontend && npm run dev"
timeout /t 3 /nobreak

echo.
echo ===============================================
echo 🎉 All services running!
echo ===============================================
echo.
echo Access points:
echo   Frontend:    http://localhost:5173
echo   Backend API: http://localhost:3000/api
echo   Health:      http://localhost:3000/health
echo.
echo Test Credentials:
echo   Admin:   admin@example.com / Admin123!@
echo   Teacher: teacher@example.com / Teacher123!@
echo   Student: student@example.com / Student123!@
echo.
echo Phase 12 Features:
echo   ✓ Real-time Dashboard ^(WebSocket^)
echo   ✓ Advanced Filtering
echo   ✓ Export ^(PDF, Excel, CSV^)
echo   ✓ Dashboard Builder
echo   ✓ Dark Mode
echo   ✓ Mobile App
echo.
echo Open the above URLs in your browser!
echo Close the terminal windows to stop services.
echo.

pause
