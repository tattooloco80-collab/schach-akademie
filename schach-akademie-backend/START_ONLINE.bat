@echo off
chcp 65001 >nul
title Schach-Akademie - Online starten
cls

echo.
echo ⚔️  Schach-Akademie - Online-Modus
echo ════════════════════════════════════════
echo.

REM Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python nicht installiert!
    echo Laden Sie herunter: https://python.org
    pause
    exit /b 1
)

REM Install Flask
echo 📦 Installiere Abhängigkeiten...
pip install flask flask-cors firebase-admin --quiet

REM Check ngrok
where ngrok >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ⚠️  ngrok nicht installiert!
    echo.
    echo 1. Öffne: https://ngrok.com/download
    echo 2. Downloade ngrok für Windows
    echo 3. Entpacke in: C:\ngrok\
    echo 4. Gib in diesem Fenster ein: ngrok config add-authtoken [dein-token]
    echo 5. Starte dieses Script erneut
    echo.
    pause
    exit /b 1
)

echo.
echo ✅ Starte Backend + ngrok...
echo.

REM Start Flask in background
start "Flask Backend" cmd /c python app.py

REM Wait for Flask to start
timeout /t 2 /nobreak

REM Start ngrok tunnel
echo.
echo 🌐 Erstelle öffentliche URL...
echo.
ngrok http 5000 --log=stdout

pause
