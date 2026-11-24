# ⚔️ SCHACH-AKADEMIE - JETZT LIVE MACHEN!
# PowerShell Script - funktioniert mit Vercel/npm

Write-Host ""
Write-Host "⚔️  SCHACH-AKADEMIE - JETZT LIVE!" -ForegroundColor Cyan -BackgroundColor Black
Write-Host "════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Das Script macht 5 Schritte automatisch:"
Write-Host "1. Vercel CLI installieren (falls nötig)"
Write-Host "2. Vercel Login (Browser)"
Write-Host "3. Backend pushen"
Write-Host "4. App bauen"
Write-Host "5. FERTIG & LIVE!"
Write-Host ""
Write-Host "════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$BACKEND_DIR = "C:\Users\tatto\OneDrive\Desktop\schach\schach-akademie-backend"
$APP_DIR = "C:\Users\tatto\OneDrive\Desktop\schach\schach-akademie-quelltext"

# ========== SCHRITT 1: Vercel CLI prüfen/installieren ==========
Write-Host ""
Write-Host "🔧 SCHRITT 1: Prüfe Vercel CLI..." -ForegroundColor Yellow
Write-Host ""

$vercelExists = & npm list -g vercel 2>$null
if ($vercelExists) {
    Write-Host "✅ Vercel CLI bereits installiert!" -ForegroundColor Green
} else {
    Write-Host "📦 Installiere Vercel CLI..." -ForegroundColor Yellow
    & npm install -g vercel
    Write-Host "✅ Vercel CLI installiert!" -ForegroundColor Green
}

Write-Host ""

# ========== SCHRITT 2: Vercel Login ==========
Write-Host "🔐 SCHRITT 2: Vercel Login (Browser öffnet sich)" -ForegroundColor Yellow
Write-Host ""
Write-Host "⏳ Warte 2 Sekunden..." -ForegroundColor Gray

Start-Sleep -Seconds 2

Set-Location $BACKEND_DIR
Write-Host "Starte Vercel Login..." -ForegroundColor Gray
& vercel login

Write-Host ""
Write-Host "✅ Vercel Login fertig!" -ForegroundColor Green
Write-Host ""

# ========== SCHRITT 3: Backend pushen ==========
Write-Host "📤 SCHRITT 3: Pushe Backend zu GitHub..." -ForegroundColor Yellow
Write-Host ""

Write-Host "Git add..." -ForegroundColor Gray
& git add .

Write-Host "Git commit..." -ForegroundColor Gray
& git commit -m "Deploy $(Get-Date -Format 'yyyy-MM-dd HH:mm')"

Write-Host "Git push..." -ForegroundColor Gray
& git push -u origin main

Write-Host ""
Write-Host "✅ Backend gepusht!" -ForegroundColor Green
Write-Host ""

# ========== SCHRITT 4: Vercel Deploy ==========
Write-Host "🚀 SCHRITT 4: Deploy auf Vercel (das dauert 2-3 Minuten)" -ForegroundColor Yellow
Write-Host ""
Write-Host "⏳ Starte Deployment..." -ForegroundColor Gray

& vercel --prod

Write-Host ""
Write-Host "✅ Vercel Deploy fertig!" -ForegroundColor Green
Write-Host ""

# ========== SCHRITT 5: App bauen ==========
Write-Host "🔧 SCHRITT 5: Baue App neu..." -ForegroundColor Yellow
Write-Host ""

Set-Location $APP_DIR
Write-Host "Build läuft..." -ForegroundColor Gray
& node build.mjs

Write-Host ""
Write-Host "✅ App gebaut!" -ForegroundColor Green
Write-Host ""

# ========== SCHRITT 6: GitHub Pages Push ==========
Write-Host "📤 SCHRITT 6: Pushe App zu GitHub Pages..." -ForegroundColor Yellow
Write-Host ""

Write-Host "Git add..." -ForegroundColor Gray
& git add dist/index.html

Write-Host "Git commit..." -ForegroundColor Gray
& git commit -m "Frontend Update $(Get-Date -Format 'yyyy-MM-dd HH:mm')"

Write-Host "Git push..." -ForegroundColor Gray
& git push origin main

Write-Host ""
Write-Host "✅ App gepusht!" -ForegroundColor Green
Write-Host ""

# ========== FERTIG! ==========
Write-Host ""
Write-Host "════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "✅ ✅ ✅ FERTIG! ALLES IST JETZT LIVE! ✅ ✅ ✅" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "🎮 Öffne auf deinem iPhone:" -ForegroundColor Cyan
Write-Host ""
Write-Host "   https://tattooloco80-collab.github.io/schach-akademie/" -ForegroundColor White -BackgroundColor Blue
Write-Host ""
Write-Host "⚔️  BEN UND CARINA KÖNNEN ÜBERALL SPIELEN!" -ForegroundColor Magenta
Write-Host ""
Write-Host "🌐 Backend läuft auf Vercel" -ForegroundColor Gray
Write-Host ""

Write-Host "Drücke eine beliebige Taste zum Beenden..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
