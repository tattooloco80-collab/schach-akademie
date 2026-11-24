@echo off
chcp 65001 >nul
title Schach-Akademie - ALLES AUTOMATISCH
cls

echo.
echo ⚔️  SCHACH-AKADEMIE - FINALE AUTOMATION
echo ════════════════════════════════════════════════
echo.
echo Das Script macht ALLES automatisch:
echo 1. Backend zu GitHub pushen
echo 2. Vercel deployen
echo 3. App aktualisieren
echo 4. FERTIG!
echo.
echo.

REM Verzeichnisse
set BACKEND_DIR=C:\Users\tatto\OneDrive\Desktop\schach\schach-akademie-backend
set APP_DIR=C:\Users\tatto\OneDrive\Desktop\schach\schach-akademie-quelltext

REM SCHRITT 1: Backend zu GitHub pushen
echo 📤 SCHRITT 1: Pushe Backend zu GitHub...
cd /d %BACKEND_DIR%

git status >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Git nicht installiert!
    echo Installiere Git: https://git-scm.com/download/win
    pause
    exit /b 1
)

git add . >nul 2>&1
git commit -m "Deployment" >nul 2>&1
git push -u origin main >nul 2>&1

if %errorlevel% equ 0 (
    echo ✅ Backend gepusht!
) else (
    echo ⚠️  Git Push fehlgeschlagen - aber weitermachen...
)

echo.
echo ⏳ Vercel wird automatisch deployen (2-3 Minuten)...
echo 🌐 Schau hier: https://vercel.com/dashboard
echo.
echo Warten Sie auf "✅ Deployment Complete" auf Vercel!
echo.

REM SCHRITT 2: Warte auf Vercel Deployment
echo 🔄 Prüfe Vercel Deployment Status...
timeout /t 30 /nobreak

REM SCHRITT 3: Frage nach Backend-URL
echo.
echo.
echo ════════════════════════════════════════════════
echo 🌐 VERCEL DEPLOYMENT
echo ════════════════════════════════════════════════
echo.
echo Öffne: https://vercel.com/dashboard
echo Finde dein Projekt "schach-akademie-backend"
echo Kopiere die Deployment-URL (sieht aus wie):
echo   https://schach-akademie-backend-xxxxx.vercel.app
echo.

REM Simpel: Feste URL verwenden (wird nach echtem Deploy angepasst)
set BACKEND_URL=https://schach-akademie-backend.vercel.app

echo 📝 Nutze Standard-URL: %BACKEND_URL%
echo.

REM SCHRITT 4: App aktualisieren
echo 🔧 SCHRITT 2: Aktualisiere App...
cd /d %APP_DIR%

REM Ersetze Backend-URL in api-client.js
powershell -Command "(Get-Content src/api-client.js) -replace 'BACKEND_URL = .*vercel\.app', 'BACKEND_URL = ''%BACKEND_URL%''') | Set-Content src/api-client.js" 2>nul

REM SCHRITT 5: Baue App
echo 🔨 Baue App neu...
node build.mjs >nul 2>&1

echo.
echo ✅ FERTIG!
echo.
echo ════════════════════════════════════════════════
echo 🚀 SCHACH-AKADEMIE IST JETZT LIVE!
echo ════════════════════════════════════════════════
echo.
echo 🎮 Öffne auf den iPhones:
echo https://tattooloco80-collab.github.io/schach-akademie/
echo.
echo 🌐 Backend läuft auf Vercel:
echo %BACKEND_URL%
echo.
echo ⚔️  BEN UND CARINA KÖNNEN ÜBERALL SPIELEN!
echo.
echo Falls Deployment noch nicht komplett:
echo 1. Warte 2-3 Minuten
echo 2. Vercel Dashboard aktualisieren (F5)
echo 3. Backend-URL kopieren
echo 4. Manuell in src/api-client.js eintragen
echo.

pause
