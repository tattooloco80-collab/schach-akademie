@echo off
chcp 65001 >nul
title Schach-Akademie - Bauen & Live

cd /d C:\Users\tatto\OneDrive\Desktop\schach\schach-akademie-quelltext

echo.
echo 🔧 Baue App neu...
echo.
call node build.mjs

echo.
echo 📤 Pushe zu GitHub Pages...
echo.
call git add dist/index.html
call git commit -m "Fix Backend URL zu Vercel - schneller jetzt!"
call git push origin main

echo.
echo ✅ FERTIG! App ist aktualisiert!
echo.
echo 🎮 Öffne auf iPhone:
echo https://tattooloco80-collab.github.io/schach-akademie/
echo.

pause
