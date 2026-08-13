@echo off
chcp 65001 > nul
echo ====================================
echo   إيقاف سيرفر المخازن
echo ====================================
echo.

echo [1/3] إيقاف Node.js على Port 5000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000 ^| findstr LISTENING') do (
    echo وجدنا Process ID: %%a
    taskkill /F /PID %%a
    echo ✅ تم إيقاف Process %%a
)

echo.
echo [2/3] إيقاف أي Node.js processes للسيرفر...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq *server.js*" 2>nul
if %errorlevel% equ 0 (
    echo ✅ تم إيقاف Node processes
) else (
    echo ⚠️ لم يتم العثور على node.exe processes
)

echo.
echo [3/3] إيقاف Windows Task Scheduler (إن وجد)...
schtasks /End /TN "InventoryBackendKeepAlive" 2>nul
if %errorlevel% equ 0 (
    echo ✅ تم إيقاف Task: InventoryBackendKeepAlive
) else (
    echo ⚠️ Task غير موجود أو متوقف بالفعل
)

echo.
echo ====================================
echo   ✅ تم إيقاف السيرفر بنجاح!
echo ====================================
echo.
pause
