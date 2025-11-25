@echo off
cls
echo.
echo ========================================================
echo   COMPLETE FIX - Delete All + Server Logs
echo ========================================================
echo.

echo [1/5] Checking current setup...
node check-kyp-exam.js
echo.

echo [2/5] Stopping old server...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080"') do (
    echo    - Killing PID: %%a
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 2 >nul

echo [3/5] Starting new server with logging...
start "KYP Server - WITH LOGS" cmd /k "echo Server is starting... & echo. & node server.js"
timeout /t 4 >nul

echo [4/5] Server started!
echo.
echo ========================================================
echo   NEW FEATURES ADDED:
echo ========================================================
echo.
echo   1. SERVER LOGS VIEWER
echo      - Click "View Server Logs" button in admin panel
echo      - See all DELETE operations
echo      - Real-time logging
echo      - Auto-refresh option
echo.
echo   2. ENHANCED DELETE ALL
echo      - Better error messages
echo      - Automatic backup creation
echo      - Verification after delete
echo      - Detailed logs
echo.
echo ========================================================
echo   TESTING INSTRUCTIONS:
echo ========================================================
echo.
echo   Step 1: Open browser
echo      http://localhost:8080/admin.html
echo.
echo   Step 2: HARD REFRESH (Important!)
echo      Press: Ctrl + Shift + R
echo      Or: Ctrl + F5
echo.
echo   Step 3: Login to admin
echo      Username: admin
echo      Password: admin123
echo.
echo   Step 4: Open Server Logs
echo      Click "View Server Logs" button
echo      Enable "Auto-refresh"
echo.
echo   Step 5: Test Delete All
echo      Select "KYP November Test"
echo      Click "Delete All Questions"
echo      Watch logs in real-time!
echo.
echo ========================================================
echo   WHAT YOU'LL SEE IN LOGS:
echo ========================================================
echo.
echo   [DELETE ALL] Request received for subject: kyp-november-test
echo   [DELETE ALL] Found X questions to delete
echo   [DELETE ALL] Backup created at ...
echo   [DELETE ALL] Writing updated questions to file...
echo   [DELETE ALL] Successfully deleted X questions
echo   [DELETE ALL] Verification: 0 questions remaining
echo.
echo ========================================================
echo.
echo Server is running in a separate window.
echo Keep that window open to see live logs!
echo.
echo Press any key to open browser...
pause >nul

start http://localhost:8080/admin.html

echo.
echo Browser opened! Follow the testing instructions above.
echo.
pause
