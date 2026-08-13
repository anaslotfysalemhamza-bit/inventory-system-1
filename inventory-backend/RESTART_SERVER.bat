@echo off
chcp 65001 > nul
echo ========================================
echo  ⚡ إعادة تشغيل السيرفر
echo ========================================

echo.
echo 🔴 إيقاف السيرفر القديم...
taskkill /F /IM node.exe /T 2>nul

timeout /t 2 /nobreak > nul

echo.
echo 🟢 تشغيل السيرفر الجديد (مع التحسينات)...
echo.

node server.js

pause
