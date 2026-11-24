@echo off
chcp 65001 >nul
title Railway Deploy - Backend zu Production

cd /d "C:\Users\tatto\OneDrive\Desktop\schach\schach-akademie-backend"

echo.
echo 🚀 RAILWAY DEPLOYMENT
echo ════════════════════════════════════════════════
echo.
echo Dieser Prozess:
echo 1. Öffnet Browser für Login (wenn nötig)
echo 2. Initialisiert Railway Projekt
echo 3. Deployt Backend
echo 4. Gibt dir die URL
echo.
echo ════════════════════════════════════════════════
echo.

echo 🔐 Starte Railway Login...
echo.
call railway login

echo.
echo ✅ Login fertig!
echo.

echo 🔧 Initialisiere Railway Projekt...
echo.
call railway init --name schach-akademie-backend

echo.
echo 🚀 Deploye Backend zu Railway...
echo.
call railway up --detach

echo.
echo ✅ Deployment gestartet!
echo.
echo 🌐 Öffne: https://railway.app/dashboard
echo    Dort findest du die Live-URL deines Backends
echo.
echo Die URL sieht so aus:
echo   https://schach-akademie-backend-xxx.railway.app
echo.
echo Kopiere die URL und sag mir Bescheid!
echo.

pause
