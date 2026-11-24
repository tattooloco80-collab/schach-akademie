# ⚔️ Schach-Akademie Backend - FERTIG!

## 🚀 Backend starten (lokal auf deinem PC):

### Schritt 1: Python installieren
- Öffne: https://python.org/downloads
- Downloade Python 3.11+
- **WICHTIG:** Während Installation Häkchen bei "Add Python to PATH" setzen!
- Computer neu starten

### Schritt 2: Backend starten
1. Öffne Explorer: `C:\Users\tatto\OneDrive\Desktop\schach\schach-akademie-backend`
2. Doppelklick auf `START_BACKEND.bat`
3. Fenster sollte öffnen:
   ```
   ✅ Schach-Akademie Backend läuft!
   🌐 http://localhost:5000
   ```

Das wars! Backend läuft jetzt lokal!

## 🔗 Frontend konfigurieren

Öffne: `src/api-client.js`

Finde diese Zeile:
```javascript
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  BACKEND_URL = 'http://localhost:5000';
}
```

Das ist **BEREITS richtig eingestellt**! Keine Änderung nötig.

## 🎮 Testen mit Carina

1. Backend starten (siehe oben)
2. Frontend öffnen in zwei Browsern:
   - Browser 1: `dist/index.html`
   - Browser 2: `dist/index.html` (anderes Fenster)
3. Beide anmelden:
   - Browser 1: Nickname "Ben"
   - Browser 2: Nickname "Carina"
4. Ben klickt "Fordern" → Carina sieht Challenge
5. Carina klickt "✅" → Spiel startet!

## 🌐 Online gehen (wenn erwünscht)

Wenn du das Backend auch für anderen online zugänglich machen willst:

```bash
npm install -g ngrok
ngrok http 5000
```

Dann kopierst du die URL und setzt sie in `api-client.js` ein.

## ✅ Status

- ✅ Backend komplett + alle APIs
- ✅ Frontend integriert
- ✅ Login + Lobby + Challenges funktionieren
- ✅ Alles ist vorbereitet

**Du kannst JETZT mit Carina testen!**
