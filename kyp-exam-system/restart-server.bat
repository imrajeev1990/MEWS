@echo off
echo.
echo ============================================
echo   Restarting KYP Exam System Server
echo ============================================
echo.

REM Find and kill the process on port 8080
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080"') do (
    echo Stopping old server process (PID: %%a)...
    taskkill /F /PID %%a >nul 2>&1
)

timeout /t 2 >nul

REM Start the server
echo.
echo Starting server...
echo.
start "KYP Server" cmd /k "node server.js"

timeout /t 3 >nul

echo.
echo ============================================
echo   Server restarted successfully!
echo   Server is running on http://localhost:8080
echo ============================================
echo.
echo Press any key to close this window...
pause >nul
