# Schach-Akademie Backend

Express.js Server mit Firebase Admin SDK für Multiplayer-Funktionalität.

## APIs

- `POST /api/auth/login` - Spieler anmelden mit Nickname
- `GET /api/lobby/players` - Aktive Spieler abrufen
- `POST /api/challenge/send` - Herausforderung senden
- `GET /api/challenge/list` - Herausforderungen abrufen
- `POST /api/challenge/accept` - Herausforderung annehmen
- `POST /api/challenge/decline` - Herausforderung ablehnen
- `GET /api/game/state` - Spielzustand abrufen
- `POST /api/game/move` - Zug senden
- `POST /api/game/end` - Spiel beenden

## Lokal starten

```bash
npm install
npm start
```

Server läuft unter http://localhost:5000

## Deployment auf Render.com

1. GitHub Push:
   ```bash
   git add .
   git commit -m "Backend fertig"
   git push origin main
   ```

2. Auf Render.com:
   - Neu > Web Service
   - GitHub-Repo verbinden: `tattooloco80-collab/schach-akademie-backend`
   - Branch: `main`
   - Runtime: Node
   - Build: `npm install`
   - Start: `npm start`
   - Deploy

3. Backend-URL in Frontend (api-client.js) aktualisieren:
   ```javascript
   const BACKEND_URL = 'https://schach-akademie-backend.onrender.com'
   ```

## Firebase Admin Credentials

Die Firebase Admin SDK Credentials sind in `server.js` hardcodiert. Für Production sollten diese über Environment-Variablen geladen werden.

## Status

✅ Alle APIs implementiert
✅ Firebase Admin SDK integriert
✅ Ready für Deployment
