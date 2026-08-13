@echo off
chcp 65001 >nul
title 🚀 Inventory Server - No Sleep Mode
color 0A

echo ================================================================
echo 🚀 تشغيل السيرفر بدون Sleep Mode
echo ================================================================
echo.

REM التحقق من وجود Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js غير مثبت!
    echo    يرجى تثبيت Node.js أولاً من: https://nodejs.org
    pause
    exit /b 1
)

echo ✅ Node.js موجود
echo.

REM تشغيل PowerShell لمنع Sleep Mode في الخلفية
echo 🔋 تفعيل Prevent Sleep Mode...
start "Prevent Sleep" /min powershell -ExecutionPolicy Bypass -File "%~dp0PREVENT_SLEEP.ps1"
timeout /t 2 /nobreak >nul
echo ✅ Prevent Sleep نشط
echo.

REM تشغيل السيرفر
echo 🚀 تشغيل السيرفر...
echo.
node server.js

REM إذا توقف السيرفر، إظهار رسالة
echo.
echo ⚠️ السيرفر توقف!
pause
