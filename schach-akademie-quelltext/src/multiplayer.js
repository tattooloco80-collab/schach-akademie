// Multiplayer-System für Schach-Akademie
// Firebase Realtime Database Integration

import { store, addDebugLog } from './util.js';

// Ben's Firebase Config (schach-akademie Projekt)
const DEFAULT_CONFIG = {
  apiKey: "AIzaSyDGBhPYZ4Srho30_L6-Q12-udgGTGutUQ",
  authDomain: "schach-akademie.firebaseapp.com",
  databaseURL: "https://schach-akademie-default-rtdb.firebaseio.com",
  projectId: "schach-akademie",
  storageBucket: "schach-akademie.firebasestorage.app",
  messagingSenderId: "637211071234",
  appId: "1:637211071234:web:f1b1d8bb485f76eaf9681b",
  measurementId: "G-W4G2YF9CSM"
};

let firebaseConfig = store.get('firebaseConfig', DEFAULT_CONFIG);
let firebase = null;
let db = null;
let auth = null;
let currentUser = null;
let currentGameId = null;

export async function initFirebase(config) {
  addDebugLog('initFirebase: starting...');
  const cfg = config || firebaseConfig || DEFAULT_CONFIG;

  if (!cfg) {
    addDebugLog('Firebase Config nicht vorhanden - Multiplayer deaktiviert');
    return false;
  }

  try {
    addDebugLog('initFirebase: waiting for Firebase libs...');
    // Warte, bis Firebase geladen ist
    for (let i = 0; i < 50; i++) {
      if (window.firebase) {
        addDebugLog('initFirebase: Firebase libs ready!');
        break;
      }
      await new Promise(r => setTimeout(r, 100));
    }

    if (!window.firebase) {
      throw new Error('Firebase libs timeout - not loaded');
    }

    addDebugLog('initFirebase: initializing Firebase...');
    firebase = window.firebase;
    firebase.initializeApp(cfg);
    db = firebase.database();
    auth = firebase.auth();

    addDebugLog('initFirebase: SUCCESS! db initialized');
    store.set('firebaseConfig', cfg);
    return true;
  } catch (e) {
    addDebugLog('Firebase Init Error: ' + e.message);
    return false;
  }
}

async function loadFirebaseLibs() {
  if (window.firebase) return;

  // Firebase Core
  const appScript = document.createElement('script');
  appScript.src = 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
  await new Promise(r => { appScript.onload = r; document.head.appendChild(appScript); });

  // Firebase Database
  const dbScript = document.createElement('script');
  dbScript.src = 'https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js';
  await new Promise(r => { dbScript.onload = r; document.head.appendChild(dbScript); });

  // Firebase Auth
  const authScript = document.createElement('script');
  authScript.src = 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
  await new Promise(r => { authScript.onload = r; document.head.appendChild(authScript); });
}

export async function loginWithNickname(nickname) {
  if (!db) return { error: 'Firebase nicht initialisiert' };

  try {
    // Anonyme Auth
    const result = await auth.signInAnonymously();
    currentUser = {
      uid: result.user.uid,
      nickname: nickname,
      status: 'online',
      elo: 0
    };

    // Spieler in DB registrieren
    await db.ref(`players/${currentUser.uid}`).set({
      nickname: nickname,
      status: 'online',
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      lastActive: firebase.database.ServerValue.TIMESTAMP,
      elo: 0,
      wins: 0,
      losses: 0
    });

    store.set('currentUser', currentUser);
    return { success: true, user: currentUser };
  } catch (e) {
    return { error: e.message };
  }
}

export async function getLobbyPlayers() {
  addDebugLog('getLobbyPlayers: db=' + (db ? 'initialized' : 'NULL'));
  if (!db) {
    addDebugLog('getLobbyPlayers: db is null, returning empty array');
    return [];
  }

  try {
    addDebugLog('getLobbyPlayers: querying players...');
    const snapshot = await db.ref('players').orderByChild('lastActive').limitToLast(50).once('value');
    const players = [];

    snapshot.forEach(child => {
      if (child.val().status === 'online' && child.key !== currentUser?.uid) {
        players.push({
          uid: child.key,
          ...child.val()
        });
      }
    });

    addDebugLog('getLobbyPlayers: got ' + players.length + ' players');
    return players.reverse();
  } catch (e) {
    addDebugLog('Get Players Error: ' + e.message);
    return [];
  }
}

export async function challengePlayer(opponentUid, opponentNickname) {
  addDebugLog('challengePlayer: starting, db=' + (db ? 'ok' : 'NULL') + ', currentUser=' + (currentUser ? currentUser.nickname : 'NULL'));
  if (!db || !currentUser) {
    addDebugLog('challengePlayer: FAIL - not logged in');
    return { error: 'Not logged in' };
  }

  try {
    addDebugLog('challengePlayer: creating challenge for ' + opponentNickname);
    const challengeId = db.ref('challenges').push().key;
    addDebugLog('challengePlayer: challengeId=' + challengeId);

    await db.ref(`challenges/${challengeId}`).set({
      from: currentUser.uid,
      fromNickname: currentUser.nickname,
      to: opponentUid,
      toNickname: opponentNickname,
      status: 'pending',
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      expiresAt: firebase.database.ServerValue.TIMESTAMP // wird auf Server +300s gesetzt
    });

    addDebugLog('challengePlayer: challenge written to Firebase!');
    // Push Notification senden
    await sendPushNotification(opponentUid, `${currentUser.nickname} fordert dich heraus!`, challengeId);

    return { success: true, challengeId };
  } catch (e) {
    addDebugLog('challengePlayer: ERROR - ' + e.message);
    return { error: e.message };
  }
}

export async function acceptChallenge(challengeId) {
  if (!db || !currentUser) return { error: 'Not logged in' };

  try {
    const challengeRef = db.ref(`challenges/${challengeId}`);
    const challenge = await challengeRef.once('value');

    if (!challenge.exists()) return { error: 'Challenge not found' };

    const data = challenge.val();
    if (data.status !== 'pending') return { error: 'Challenge already processed' };

    // Neue Partie erstellen
    const gameId = db.ref('games').push().key;
    const whitePlayer = data.from;
    const blackPlayer = currentUser.uid;

    await db.ref(`games/${gameId}`).set({
      white: whitePlayer,
      whiteNickname: data.fromNickname,
      black: blackPlayer,
      blackNickname: currentUser.nickname,
      status: 'active',
      moves: [],
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      lastMove: firebase.database.ServerValue.TIMESTAMP
    });

    // Challenge als akzeptiert markieren
    await challengeRef.update({ status: 'accepted', gameId });

    // Benachrichtigung an Gegner
    await sendPushNotification(data.from, `${currentUser.nickname} akzeptiert die Herausforderung!`, gameId);

    currentGameId = gameId;
    return { success: true, gameId };
  } catch (e) {
    return { error: e.message };
  }
}

export async function declineChallenge(challengeId) {
  if (!db) return { error: 'Firebase nicht initialisiert' };

  try {
    await db.ref(`challenges/${challengeId}`).update({ status: 'declined' });
    return { success: true };
  } catch (e) {
    return { error: e.message };
  }
}

export async function broadcastMove(gameId, move) {
  if (!db) return { error: 'Firebase nicht initialisiert' };

  try {
    const gameRef = db.ref(`games/${gameId}`);
    const game = await gameRef.once('value');
    const data = game.val();

    const moves = data.moves || [];
    moves.push({
      move,
      by: currentUser.uid,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    });

    await gameRef.update({
      moves,
      lastMove: firebase.database.ServerValue.TIMESTAMP
    });

    return { success: true };
  } catch (e) {
    return { error: e.message };
  }
}

export async function listenToGame(gameId, onMove, onGameEnd) {
  if (!db) return;

  const gameRef = db.ref(`games/${gameId}`);

  gameRef.on('value', (snapshot) => {
    const game = snapshot.val();
    if (!game) return;

    if (game.status === 'ended') {
      onGameEnd(game);
    }

    if (onMove) {
      onMove(game.moves);
    }
  });

  return () => gameRef.off();
}

export async function listenToChallenges(onChallenge) {
  if (!db || !currentUser) return;

  const challengeRef = db.ref('challenges').orderByChild('to').equalTo(currentUser.uid);

  challengeRef.on('child_added', (snapshot) => {
    const challenge = snapshot.val();
    if (challenge.status === 'pending') {
      onChallenge({
        id: snapshot.key,
        ...challenge
      });
    }
  });

  return () => challengeRef.off();
}

async function sendPushNotification(userId, message, actionData) {
  if (!db) return;

  try {
    await db.ref(`notifications/${userId}`).push({
      message,
      actionData,
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      read: false
    });

    // Push Notification via Browser Notification API
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Schach-Akademie', { body: message });
    }
  } catch (e) {
    console.warn('Notification Error:', e);
  }
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;

  if (Notification.permission === 'granted') return true;

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

export async function endGame(gameId, result) {
  if (!db) return { error: 'Firebase nicht initialisiert' };

  try {
    const gameRef = db.ref(`games/${gameId}`);
    const game = await gameRef.once('value');
    const data = game.val();

    // Elo-Punkte aktualisieren
    const whiteElo = await updateElo(data.white, result.winner === 'white' ? 1 : result.winner === 'black' ? 0 : 0.5);
    const blackElo = await updateElo(data.black, result.winner === 'black' ? 1 : result.winner === 'white' ? 0 : 0.5);

    await gameRef.update({
      status: 'ended',
      result: result.type,
      winner: result.winner,
      endedAt: firebase.database.ServerValue.TIMESTAMP,
      whiteEloChange: whiteElo,
      blackEloChange: blackElo
    });

    return { success: true };
  } catch (e) {
    return { error: e.message };
  }
}

async function updateElo(userId, score) {
  if (!db) return 0;

  try {
    const userRef = db.ref(`players/${userId}`);
    const user = await userRef.once('value');
    const userData = user.val();

    const oldElo = userData.elo || 0;
    const K = 32;
    const newElo = Math.round(oldElo + K * (score - 0.5));

    await userRef.update({
      elo: newElo,
      [score === 1 ? 'wins' : score === 0 ? 'losses' : 'draws']: (userData[score === 1 ? 'wins' : score === 0 ? 'losses' : 'draws'] || 0) + 1
    });

    return newElo - oldElo;
  } catch (e) {
    console.error('Update Elo Error:', e);
    return 0;
  }
}

export function getCurrentUser() {
  return currentUser;
}

export function getCurrentGameId() {
  return currentGameId;
}
