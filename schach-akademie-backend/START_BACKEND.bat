@echo off
chcp 65001 >nul
echo.
echo ⚔️  Schach-Akademie Backend - Starten
echo ════════════════════════════════════════
echo.

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python ist nicht installiert!
    echo.
    echo 1. Laden Sie Python herunter: https://python.org
    echo 2. Während der Installation: Häkchen "Add Python to PATH" setzen!
    echo 3. Computer neu starten
    echo 4. Dieses Script erneut ausführen
    pause
    exit /b 1
)

echo 📦 Installiere Abhängigkeiten...
pip install -r requirements.txt --quiet

echo.
echo ✅ Backend startet...
echo.
python app.py

pause
