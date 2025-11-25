@echo off
echo.
echo ========================================================
echo   KYP November Test - Complete Fix Script
echo ========================================================
echo.

echo Step 1: Verifying exam configuration...
node check-kyp-exam.js

echo.
echo Step 2: Restarting server with updated code...
echo.

REM Kill old server
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080"') do (
    echo Stopping old server (PID: %%a)...
    taskkill /F /PID %%a >nul 2>&1
)

timeout /t 2 >nul

REM Start new server
echo Starting server...
start "KYP Server - DELETE ALL FIXED" cmd /k "node server.js"

timeout /t 3 >nul

echo.
echo ========================================================
echo   Server Started Successfully!
echo ========================================================
echo.
echo Next Steps:
echo -----------
echo 1. Open browser: http://localhost:8080/admin.html
echo 2. Press Ctrl + Shift + R (Hard Refresh)
echo 3. Login to admin panel
echo 4. Select "KYP November Test"
echo 5. Click "Delete All Questions"
echo 6. Watch the server terminal for [DELETE ALL] logs
echo.
echo Server Terminal will show:
echo   [DELETE ALL] Request received...
echo   [DELETE ALL] Found X questions to delete...
echo   [DELETE ALL] Successfully deleted...
echo   [DELETE ALL] Verification: 0 questions remaining
echo.
echo ========================================================
echo.
pause
