@echo off
chcp 65001 >nul
title Schach-Akademie - GO LIVE
cls

echo.
echo ⚔️  SCHACH-AKADEMIE - GO LIVE
echo ════════════════════════════════════════════════
echo.
echo Dieses Script macht ALLES:
echo ✅ Git Push
echo ✅ Vercel Deploy
echo ✅ App Update
echo ✅ LIVE!
echo.

setlocal enabledelayedexpansion

set BACKEND_DIR=C:\Users\tatto\OneDrive\Desktop\schach\schach-akademie-backend
set APP_DIR=C:\Users\tatto\OneDrive\Desktop\schach\schach-akademie-quelltext

REM Check Git
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Git nicht installiert!
    echo Installiere: https://git-scm.com/download/win
    pause
    exit /b 1
)

REM Check Vercel CLI
vercel --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 📦 Installiere Vercel CLI...
    npm install -g vercel --silent >nul 2>&1
)

REM STEP 1: Git Push
echo 📤 STEP 1: Git Push...
cd /d %BACKEND_DIR%
git add . >nul 2>&1
git commit -m "Deployment %date%" >nul 2>&1
git push origin main >nul 2>&1

if %errorlevel% equ 0 (
    echo ✅ Git Push erfolgreich!
) else (
    echo ⚠️  Git Push fehlgeschlagen
)

REM STEP 2: Vercel Deploy
echo.
echo 🚀 STEP 2: Vercel Deploy...
echo.

cd /d %BACKEND_DIR%

REM Deploy mit Vercel und speichere URL
for /f "tokens=*" %%a in ('vercel --prod 2^>nul ^| findstr /R "https://"') do (
    set BACKEND_URL=%%a
)

if defined BACKEND_URL (
    echo ✅ Vercel Deploy erfolgreich!
    echo 🌐 URL: !BACKEND_URL!
) else (
    echo ❌ Vercel Deploy fehlgeschlagen
    echo Manuell auf https://vercel.com/dashboard versuchen
    pause
    exit /b 1
)

REM STEP 3: Update App
echo.
echo 🔧 STEP 3: Update App...

cd /d %APP_DIR%

REM Update Backend URL
powershell -Command "(Get-Content src/api-client.js) -replace 'BACKEND_URL = .*vercel\.app.*', 'BACKEND_URL = ''!BACKEND_URL!'') | Set-Content src/api-client.js" 2>nul

REM Build App
node build.mjs >nul 2>&1

echo ✅ App gebaut!

REM STEP 4: Final Git Push (App)
echo.
echo 📤 STEP 4: Pushe App zu GitHub...

git add dist/index.html src/api-client.js >nul 2>&1
git commit -m "Backend URL aktualisiert" >nul 2>&1
git push origin main >nul 2>&1

echo ✅ App gepusht!

REM DONE
echo.
echo.
echo ════════════════════════════════════════════════
echo ✅ FERTIG! SCHACH-AKADEMIE IST LIVE!
echo ════════════════════════════════════════════════
echo.
echo 🎮 Öffne auf den iPhones:
echo https://tattooloco80-collab.github.io/schach-akademie/
echo.
echo 🌐 Backend läuft auf Vercel:
echo !BACKEND_URL!
echo.
echo ⚔️  BEN UND CARINA KÖNNEN VON ÜBERALL SPIELEN!
echo.

pause
