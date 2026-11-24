@echo off
chcp 65001 >nul
title Schach-Akademie API Test
cls

echo.
echo 🧪 Schach-Akademie API Test
echo ════════════════════════════════════════
echo.
echo Prüfe, ob Backend läuft...
echo.

curl -s http://localhost:5000/health >nul 2>&1

if %errorlevel% equ 0 (
    echo ✅ Backend läuft!
    echo.
    echo Health-Status:
    curl -s http://localhost:5000/health
    echo.
    echo.
    echo 🎮 Backend ist bereit für Multiplayer!
) else (
    echo ❌ Backend läuft nicht!
    echo.
    echo Bitte starte zuerst: START_BACKEND.bat
    echo.
)

pause
