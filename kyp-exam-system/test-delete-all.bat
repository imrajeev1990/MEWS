@echo off
echo.
echo ========================================
echo   Testing Delete All Questions
echo ========================================
echo.

echo Step 1: Stopping current server...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080"') do (
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 2 >nul

echo.
echo Step 2: Starting server with logging...
echo.
start "KYP Server - Testing" cmd /k "node server.js"

timeout /t 3 >nul

echo.
echo Step 3: Server started!
echo.
echo Testing Instructions:
echo --------------------
echo 1. Go to http://localhost:8080/admin.html
echo 2. Login to admin panel
echo 3. Select "KYP November Test" exam
echo 4. Click "Delete All Questions" button
echo 5. Check the server terminal for logs:
echo    - Look for [DELETE ALL] messages
echo    - Verify "Successfully deleted" message
echo    - Check "remainingCount: 0"
echo 6. Refresh the page (F5)
echo 7. Questions should be gone!
echo.
echo ========================================
echo   Watch the server terminal for logs
echo ========================================
echo.
pause
