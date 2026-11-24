@echo off
chcp 65001 >nul
title Schach-Akademie - MEGA EINFACH
cls

echo.
echo ⚔️  SCHACH-AKADEMIE - JETZT LIVE!
echo ════════════════════════════════════════════════
echo.
echo Das Script macht 4 einfache Schritte:
echo.
echo 1. GitHub Login (Browser)
echo 2. Vercel Deploy
echo 3. App bauen
echo 4. FERTIG!
echo.
echo ════════════════════════════════════════════════
echo.

setlocal enabledelayedexpansion

set BACKEND_DIR=C:\Users\tatto\OneDrive\Desktop\schach\schach-akademie-backend
set APP_DIR=C:\Users\tatto\OneDrive\Desktop\schach\schach-akademie-quelltext

REM ========== SCHRITT 1: Vercel Login ==========
echo.
echo 🔐 SCHRITT 1: Vercel Login (Browser öffnet sich)
echo.
echo Warte... Browser öffnet sich in 2 Sekunden...
timeout /t 2

cd /d %BACKEND_DIR%
echo Starte Vercel Login...
call vercel login

echo.
echo ✅ Vercel Login fertig!
echo.

REM ========== SCHRITT 2: Git Push Backend ==========
echo.
echo 📤 SCHRITT 2: Pushe Backend zu GitHub...
echo.

git add .
git commit -m "Deploy %date%"
git push -u origin main

echo.
echo ✅ Backend gepusht!
echo.

REM ========== SCHRITT 3: Vercel Deploy ==========
echo.
echo 🚀 SCHRITT 3: Deploy auf Vercel (das dauert 2-3 Minuten)
echo.
echo Starte Deployment...

call vercel --prod

echo.
echo ✅ Vercel Deploy fertig!
echo.

REM ========== SCHRITT 4: App bauen ==========
echo.
echo 🔧 SCHRITT 4: Baue App neu...
echo.

cd /d %APP_DIR%
call node build.mjs

echo.
echo ✅ App gebaut!
echo.

REM ========== SCHRITT 5: GitHub Pages Push ==========
echo.
echo 📤 SCHRITT 5: Pushe App zu GitHub Pages...
echo.

git add dist/index.html
git commit -m "Frontend Update %date%"
git push origin main

echo.
echo ✅ App gepusht!
echo.

REM ========== FERTIG! ==========
echo.
echo ════════════════════════════════════════════════
echo ✅ ✅ ✅ FERTIG! ALLES IST JETZT LIVE! ✅ ✅ ✅
echo ════════════════════════════════════════════════
echo.
echo 🎮 Öffne auf deinem iPhone:
echo.
echo     https://tattooloco80-collab.github.io/schach-akademie/
echo.
echo ⚔️  BEN UND CARINA KÖNNEN ÜBERALL SPIELEN!
echo.
echo 🌐 Backend läuft auf Vercel
echo.

pause
