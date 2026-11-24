import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';

const app = express();
app.use(cors());
app.use(express.json());

// Firebase Admin SDK Init
admin.initializeApp({
  credential: admin.credential.cert({
    type: "service_account",
    project_id: "schach-akademie",
    private_key_id: "7b7c8d9e0a1b2c3d4e5f6a7b8c9d0e1f",
    private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKj\nMzEfYyjiWA4/4ggMVuJl7dPn4TNT6MF2F3c1d9hL+FFLcHr8q0wCJLcJ1QQ9Bdrg\nX9x2dR0RGxaFvNGq/DXMIP3EfjzCODAHw0nMpqwcq+W2X/Fc3nqZ7qHp3dLR8R3R\nxE7Gr0RzP8sRfVCqV5RIL1Yw2HMjqH2vTLGzSsaW3LcHJZj8f9Mj8HLHXC6e3NMh\nzPLKLKn9WZx8vV6R7vZ2KqK9L5TQp0r0q0R8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6\nQ8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K\n5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6AgMBAAECggEBALCKipKUhKqj\njzuBr5Lk3HkWyGT7q+P5KlwPIXkfNISxPGvkRwhLtcnIx0K5Y0VxIlZ7eFVlVvCR\no6I2J+K3e7T9B0Lk5K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6\nQ8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K\n5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6\nQ8K5H6Q8K5H6Q8K5H6Q8K5H6QECQQDj1VZ7G9b3mW8P7q8P7q8P7q8P7q8P7q8P\n7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8\nQ8K5H6Q8K5H6Q8K5H6Q8K5H6Q8ECQQDQq8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P\n7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8\nQECQQCj1VZ7G9b3mW8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P\n7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P\n-----END PRIVATE KEY-----\n",
    client_email: "firebase-adminsdk-h2pxn@schach-akademie.iam.gserviceaccount.com",
    client_id: "117894621234567890",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token"
  }),
  databaseURL: "https://schach-akademie-default-rtdb.firebaseio.com"
});

const db = admin.database();

// ========== HEALTH CHECK ==========
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ========== LOGIN / REGISTER ==========
app.post('/api/auth/login', async (req, res) => {
  try {
    const { nickname } = req.body;
    if (!nickname || nickname.trim().length === 0) {
      return res.status(400).json({ error: 'Nickname required' });
    }

    // Erstelle anonym einen User
    const user = await admin.auth().signInAnonymously();
    const uid = user.user.uid;

    // Registriere Spieler in der Datenbank
    await db.ref(`players/${uid}`).set({
      nickname: nickname.trim(),
      status: 'online',
      createdAt: admin.database.ServerValue.TIMESTAMP,
      lastActive: admin.database.ServerValue.TIMESTAMP,
      elo: 1200,
      wins: 0,
      losses: 0,
      draws: 0
    });

    // Erstelle Custom Token für Client-Authentifizierung
    const customToken = await admin.auth().createCustomToken(uid);

    res.json({
      success: true,
      uid,
      nickname: nickname.trim(),
      customToken,
      elo: 1200
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== GET LOBBY PLAYERS ==========
app.get('/api/lobby/players', async (req, res) => {
  try {
    const { uid } = req.query;
    if (!uid) return res.status(400).json({ error: 'UID required' });

    const snapshot = await db.ref('players').orderByChild('lastActive').limitToLast(50).once('value');
    const players = [];

    snapshot.forEach(child => {
      if (child.val().status === 'online' && child.key !== uid) {
        players.push({
          uid: child.key,
          nickname: child.val().nickname,
          elo: child.val().elo || 1200,
          status: 'online'
        });
      }
    });

    res.json({ players: players.reverse() });
  } catch (error) {
    console.error('Get Players Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== SEND CHALLENGE ==========
app.post('/api/challenge/send', async (req, res) => {
  try {
    const { from, fromNickname, to, toNickname } = req.body;
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to required' });
    }

    // Prüfe, ob Gegner online ist
    const opponent = await db.ref(`players/${to}`).once('value');
    if (!opponent.exists()) {
      return res.status(404).json({ error: 'Opponent not found' });
    }

    // Erstelle Challenge
    const challengeRef = db.ref('challenges').push();
    await challengeRef.set({
      from,
      fromNickname,
      to,
      toNickname,
      status: 'pending',
      createdAt: admin.database.ServerValue.TIMESTAMP,
      expiresAt: admin.database.ServerValue.TIMESTAMP
    });

    res.json({ success: true, challengeId: challengeRef.key });
  } catch (error) {
    console.error('Send Challenge Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== GET CHALLENGES FOR PLAYER ==========
app.get('/api/challenge/list', async (req, res) => {
  try {
    const { uid } = req.query;
    if (!uid) return res.status(400).json({ error: 'UID required' });

    const snapshot = await db.ref('challenges').orderByChild('to').equalTo(uid).once('value');
    const challenges = [];

    snapshot.forEach(child => {
      const challenge = child.val();
      if (challenge.status === 'pending') {
        challenges.push({
          id: child.key,
          ...challenge
        });
      }
    });

    res.json({ challenges });
  } catch (error) {
    console.error('Get Challenges Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== ACCEPT CHALLENGE ==========
app.post('/api/challenge/accept', async (req, res) => {
  try {
    const { challengeId, uid } = req.body;
    if (!challengeId || !uid) {
      return res.status(400).json({ error: 'challengeId and uid required' });
    }

    // Lese Challenge
    const challengeRef = db.ref(`challenges/${challengeId}`);
    const challenge = await challengeRef.once('value');

    if (!challenge.exists()) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    const data = challenge.val();
    if (data.status !== 'pending') {
      return res.status(400).json({ error: 'Challenge already processed' });
    }

    // Erstelle Spiel
    const gameRef = db.ref('games').push();
    const gameId = gameRef.key;

    await gameRef.set({
      white: data.from,
      whiteNickname: data.fromNickname,
      black: uid,
      blackNickname: data.toNickname,
      status: 'active',
      moves: [],
      createdAt: admin.database.ServerValue.TIMESTAMP,
      lastMove: admin.database.ServerValue.TIMESTAMP
    });

    // Markiere Challenge als akzeptiert
    await challengeRef.update({
      status: 'accepted',
      gameId,
      acceptedAt: admin.database.ServerValue.TIMESTAMP
    });

    res.json({ success: true, gameId });
  } catch (error) {
    console.error('Accept Challenge Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== DECLINE CHALLENGE ==========
app.post('/api/challenge/decline', async (req, res) => {
  try {
    const { challengeId } = req.body;
    if (!challengeId) {
      return res.status(400).json({ error: 'challengeId required' });
    }

    await db.ref(`challenges/${challengeId}`).update({
      status: 'declined'
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Decline Challenge Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== BROADCAST MOVE ==========
app.post('/api/game/move', async (req, res) => {
  try {
    const { gameId, uid, move } = req.body;
    if (!gameId || !uid || !move) {
      return res.status(400).json({ error: 'gameId, uid, move required' });
    }

    const gameRef = db.ref(`games/${gameId}`);
    const game = await gameRef.once('value');

    if (!game.exists()) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const moves = game.val().moves || [];
    moves.push({
      move,
      by: uid,
      timestamp: admin.database.ServerValue.TIMESTAMP
    });

    await gameRef.update({
      moves,
      lastMove: admin.database.ServerValue.TIMESTAMP
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Move Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== GET GAME STATE ==========
app.get('/api/game/state', async (req, res) => {
  try {
    const { gameId } = req.query;
    if (!gameId) return res.status(400).json({ error: 'gameId required' });

    const game = await db.ref(`games/${gameId}`).once('value');
    if (!game.exists()) {
      return res.status(404).json({ error: 'Game not found' });
    }

    res.json({ game: game.val() });
  } catch (error) {
    console.error('Get Game State Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== END GAME ==========
app.post('/api/game/end', async (req, res) => {
  try {
    const { gameId, result } = req.body;
    if (!gameId || !result) {
      return res.status(400).json({ error: 'gameId and result required' });
    }

    const gameRef = db.ref(`games/${gameId}`);
    const game = await gameRef.once('value');

    if (!game.exists()) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const data = game.val();

    // Berechne Elo-Änderung
    const whiteElo = data.white ? await updateEloResult(data.white, result.winner === 'white' ? 1 : result.winner === 'black' ? 0 : 0.5) : 0;
    const blackElo = data.black ? await updateEloResult(data.black, result.winner === 'black' ? 1 : result.winner === 'white' ? 0 : 0.5) : 0;

    await gameRef.update({
      status: 'ended',
      result: result.type,
      winner: result.winner,
      endedAt: admin.database.ServerValue.TIMESTAMP,
      whiteEloChange: whiteElo,
      blackEloChange: blackElo
    });

    res.json({ success: true });
  } catch (error) {
    console.error('End Game Error:', error);
    res.status(500).json({ error: error.message });
  }
});

async function updateEloResult(userId, score) {
  try {
    const userRef = db.ref(`players/${userId}`);
    const user = await userRef.once('value');
    const userData = user.val();

    const oldElo = userData.elo || 1200;
    const K = 32;
    const newElo = Math.round(oldElo + K * (score - 0.5));

    const updateObj = { elo: newElo };
    if (score === 1) updateObj.wins = (userData.wins || 0) + 1;
    else if (score === 0) updateObj.losses = (userData.losses || 0) + 1;
    else updateObj.draws = (userData.draws || 0) + 1;

    await userRef.update(updateObj);
    return newElo - oldElo;
  } catch (e) {
    console.error('Update Elo Error:', e);
    return 0;
  }
}

// ========== UPDATE PLAYER STATUS ==========
app.post('/api/player/status', async (req, res) => {
  try {
    const { uid, status } = req.body;
    if (!uid || !status) {
      return res.status(400).json({ error: 'uid and status required' });
    }

    await db.ref(`players/${uid}`).update({
      status,
      lastActive: admin.database.ServerValue.TIMESTAMP
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Update Status Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Schach-Akademie Backend läuft auf Port ${PORT}`);
  console.log(`🏠 http://localhost:${PORT}`);
  console.log(`💚 Health: http://localhost:${PORT}/health`);
});
