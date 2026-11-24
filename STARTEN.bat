@echo off
chcp 65001 >nul
title Schach-Akademie - ALLES AUTOMATISCH
cls

echo.
echo ⚔️  SCHACH-AKADEMIE - ALLES STARTET AUTOMATISCH
echo ════════════════════════════════════════════════
echo.

setlocal enabledelayedexpansion

REM Pfade
set BACKEND_DIR=C:\Users\tatto\OneDrive\Desktop\schach\schach-akademie-backend
set APP_DIR=C:\Users\tatto\OneDrive\Desktop\schach\schach-akademie-quelltext

REM Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python nicht installiert!
    echo Laden Sie herunter: https://python.org
    pause
    exit /b 1
)

REM Install localtunnel
echo 📦 Installiere Tools...
pip install flask flask-cors firebase-admin --quiet >nul 2>&1
npm install -g localtunnel --silent >nul 2>&1

echo ✅ Alles bereit!
echo.
echo 🚀 STARTE BACKEND...
echo.

cd /d %BACKEND_DIR%

REM Start Backend in eigenem Fenster
start "Schach-Backend" cmd /k python app.py

REM Wait for backend
timeout /t 3 /nobreak

REM Create tunnel with localtunnel
echo.
echo 🌐 ERSTELLE ÖFFENTLICHE URL...
echo.

for /f "tokens=*" %%a in ('npx localtunnel --port 5000 --subdomain schach-akademie 2^>nul') do set TUNNEL_URL=%%a

if defined TUNNEL_URL (
    echo ✅ BACKEND LIVE!
    echo.
    echo 🌐 URL: !TUNNEL_URL!
    echo.

    REM Update app config
    echo 📝 Aktualisiere App...

    cd /d %APP_DIR%

    REM Update api-client.js with new URL
    powershell -Command "(Get-Content src/api-client.js) -replace 'BACKEND_URL = .*onrender.com', 'BACKEND_URL = ''!TUNNEL_URL!''') | Set-Content src/api-client.js"

    REM Build app
    echo 🔨 Baue App...
    node build.mjs >nul 2>&1

    echo.
    echo ✅ ALLES FERTIG!
    echo.
    echo 🎮 ÖFFNE JETZT AUF DEINEN iPhones:
    echo https://tattooloco80-collab.github.io/schach-akademie/
    echo.
    echo 🌐 Backend läuft auf: !TUNNEL_URL!
    echo.
    echo ⚔️  BEN UND CARINA KÖNNEN JETZT SPIELEN!
    echo.
) else (
    echo ❌ Tunnel konnte nicht erstellt werden
    echo Starte Backend manuell: python app.py
)

pause
