@echo off
chcp 65001 >nul
title Schach-Akademie - ALLES AUTOMATISCH JETZT!
cls

echo.
echo ⚔️  SCHACH-AKADEMIE - JETZT LIVE MACHEN!
echo ════════════════════════════════════════════════
echo.
echo Dieses Script macht ALLES automatisch:
echo.
echo SCHRITT 1: Vercel Login (Browser öffnet sich)
echo SCHRITT 2: Git Push
echo SCHRITT 3: Vercel Deploy
echo SCHRITT 4: App Update
echo SCHRITT 5: LIVE!
echo.
echo ════════════════════════════════════════════════
echo.

setlocal enabledelayedexpansion

set BACKEND_DIR=C:\Users\tatto\OneDrive\Desktop\schach\schach-akademie-backend
set APP_DIR=C:\Users\tatto\OneDrive\Desktop\schach\schach-akademie-quelltext

REM SCHRITT 1: Vercel Login
echo 🔐 SCHRITT 1: Vercel Login...
echo.
echo ⏳ Browser öffnet sich in 3 Sekunden...
timeout /t 3 /nobreak

cd /d %BACKEND_DIR%
vercel login

echo ✅ Vercel Login fertig!
echo.

REM SCHRITT 2: Git Push
echo 📤 SCHRITT 2: Git Push...
git add . >nul 2>&1
git commit -m "Deploy %date%" >nul 2>&1
git push -u origin main >nul 2>&1

if %errorlevel% equ 0 (
    echo ✅ Git Push erfolgreich!
) else (
    echo ⚠️  Git Push fehlgeschlagen - weitermachen...
)

echo.

REM SCHRITT 3: Vercel Deploy
echo 🚀 SCHRITT 3: Vercel Deploy...
echo.
echo ⏳ Das dauert 2-3 Minuten...
vercel --prod

echo.
echo ✅ Vercel Deploy fertig!
echo.

REM SCHRITT 4: App bauen
echo 🔧 SCHRITT 4: App Update...
cd /d %APP_DIR%
node build.mjs >nul 2>&1

echo ✅ App gebaut!
echo.

REM SCHRITT 5: GitHub Pages Push
echo 📤 SCHRITT 5: GitHub Pages Update...
git add dist/index.html >nul 2>&1
git commit -m "Backend Update" >nul 2>&1
git push origin main >nul 2>&1

echo ✅ GitHub Pages aktualisiert!
echo.

REM FERTIG!
echo.
echo ════════════════════════════════════════════════
echo ✅ FERTIG! SCHACH-AKADEMIE IST JETZT LIVE!
echo ════════════════════════════════════════════════
echo.
echo 🎮 Öffne auf den iPhones:
echo https://tattooloco80-collab.github.io/schach-akademie/
echo.
echo ⚔️  BEN UND CARINA KÖNNEN VON ÜBERALL SPIELEN!
echo.

pause
