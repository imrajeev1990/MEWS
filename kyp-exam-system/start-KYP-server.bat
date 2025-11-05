@echo off
cls
echo ======================================
echo   KYP Exam System Server Startup
echo   Mithila Education and Welfare Society
echo ======================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from: https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo Node.js found: 
node --version
echo.

REM Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo Installing dependencies...
    echo.
    npm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install dependencies!
        echo.
        pause
        exit /b 1
    )
    echo.
    echo Dependencies installed successfully!
    echo.
)

REM Get local IP addresses
echo Your server will be available on:
echo - Local: http://localhost:8080
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    for /f "tokens=1" %%b in ("%%a") do (
        echo - Network: http://%%b:8080
    )
)
echo.

REM Start the server
echo Starting KYP Exam System Server...
echo.
echo Press Ctrl+C to stop the server
echo ======================================
echo.

node server.js

echo.
echo Server stopped.
pause