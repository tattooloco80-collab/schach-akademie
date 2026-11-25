// Multiplayer direkt über die Firebase Realtime Database (REST) – kein eigener Server nötig.
const DB = 'https://schach-akademie-default-rtdb.firebaseio.com';
const ONLINE_MS = 90000;
const CHALLENGE_MS = 10 * 60000;

let currentUser = null;
let getMpUser = null;

export const setGetMpUser = (fn) => { getMpUser = fn; };

const ensureUser = () => currentUser || (getMpUser ? getMpUser() : null);

async function db(method, path, body) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(`${DB}/${path}.json`, { method, body: body === undefined ? undefined : JSON.stringify(body), signal: ctl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally { clearTimeout(t); }
}

const uidOf = (nick) => 'u_' + [...nick.trim().toLowerCase()].map((c) => (/[a-z0-9]/.test(c) ? c : c.codePointAt(0).toString(16) + '_')).join('');

export async function apiLogin(nickname) {
  try {
    const nick = nickname.trim();
    const uid = uidOf(nick);
    const old = await db('GET', `players/${uid}`);
    const elo = old && old.elo ? old.elo : 1200;
    await db('PUT', `players/${uid}`, { nickname: nick, elo, lastSeen: Date.now() });
    currentUser = { uid, nickname: nick, elo };
    return { success: true, user: currentUser };
  } catch (e) {
    return { error: 'Keine Verbindung zum Server' };
  }
}

export async function apiLogout() {
  const me = ensureUser();
  if (!me) return;
  try { await db('PUT', `players/${me.uid}/lastSeen`, 0); } catch (e) {}
  currentUser = null;
}

export async function apiRename(newNick) {
  const old = ensureUser();
  if (!old) return { error: 'Nicht angemeldet' };
  currentUser = old;
  const r = await apiLogin(newNick);
  if (r.error) { currentUser = old; return r; }
  if (r.user.uid !== old.uid) {
    r.user.elo = old.elo;
    try { await db('PUT', `players/${r.user.uid}/elo`, old.elo); await db('DELETE', `players/${old.uid}`); } catch (e) {}
  }
  return r;
}

export async function apiLobbyState() {
  const me = ensureUser();
  if (!me) return { error: 'Nicht angemeldet' };
  if (!currentUser) currentUser = me;
  const now = Date.now();
  try {
    const [players, challenges] = await Promise.all([
      db('GET', 'players'),
      db('GET', 'challenges'),
      db('PUT', `players/${me.uid}/lastSeen`, now),
    ]);
    const list = Object.entries(players || {})
      .filter(([uid, p]) => uid !== me.uid && p && now - (p.lastSeen || 0) < ONLINE_MS)
      .map(([uid, p]) => ({ uid, nickname: p.nickname, elo: p.elo || 1200 }));
    let incoming = [], started = null;
    for (const [id, c] of Object.entries(challenges || {})) {
      if (!c) continue;
      const age = now - (c.createdAt || 0);
      if (c.to === me.uid && c.status === 'pending' && age < CHALLENGE_MS) incoming.push({ id, ...c });
      if (c.from === me.uid && c.status === 'accepted' && c.gameId && !c.seen && age < 6 * CHALLENGE_MS && !started) started = { id, gameId: c.gameId, opponent: c.toNickname };
      if (age > 3600000 && c.from === me.uid) db('DELETE', `challenges/${id}`).catch(() => {});
    }
    return { players: list, challenges: incoming, started };
  } catch (e) {
    return { error: 'Keine Verbindung' };
  }
}

export async function apiMarkSeen(challengeId) {
  try { await db('PUT', `challenges/${challengeId}/seen`, true); } catch (e) {}
}

export async function apiSendChallenge(opponentUid, opponentNickname) {
  const me = ensureUser();
  if (!me) return { error: 'Nicht angemeldet' };
  currentUser = me;
  try {
    const r = await db('POST', 'challenges', {
      from: currentUser.uid, fromNickname: currentUser.nickname,
      to: opponentUid, toNickname: opponentNickname,
      status: 'pending', createdAt: Date.now(),
    });
    return { success: true, challengeId: r.name };
  } catch (e) {
    return { error: 'Senden fehlgeschlagen' };
  }
}

export async function apiAcceptChallenge(challengeId) {
  const me = ensureUser();
  if (!me) return { error: 'Nicht angemeldet' };
  if (!currentUser) currentUser = me;
  try {
    const c = await db('GET', `challenges/${challengeId}`);
    if (!c || c.status !== 'pending') return { error: 'Herausforderung nicht mehr verfügbar' };
    const oppElo = await db('GET', `players/${c.from}/elo`);
    const g = await db('POST', 'games', {
      white: c.from, whiteName: c.fromNickname, whiteElo: oppElo || 1200,
      black: me.uid, blackName: me.nickname, blackElo: me.elo,
      createdAt: Date.now(),
    });
    await db('PUT', `challenges/${challengeId}/gameId`, g.name);
    await db('PUT', `challenges/${challengeId}/status`, 'accepted');
    return { success: true, gameId: g.name, opponent: c.fromNickname, oppElo: oppElo || 1200 };
  } catch (e) {
    return { error: 'Annehmen fehlgeschlagen' };
  }
}

export async function apiDeclineChallenge(challengeId) {
  try { await db('PUT', `challenges/${challengeId}/status`, 'declined'); return { success: true }; } catch (e) { return { error: 'Fehler' }; }
}

export async function apiGetGameState(gameId) {
  try {
    const g = await db('GET', `games/${gameId}`);
    if (!g) return { error: 'Partie nicht gefunden' };
    g.moves = Array.isArray(g.moves) ? g.moves : Object.values(g.moves || {});
    return { game: g };
  } catch (e) {
    return { error: 'Keine Verbindung' };
  }
}

export async function apiSendMove(gameId, index, uci) {
  for (let i = 0; i < 3; i++) {
    try { await db('PUT', `games/${gameId}/moves/${index}`, uci); return { success: true }; } catch (e) { await new Promise((r) => setTimeout(r, 400)); }
  }
  return { error: 'Zug nicht übertragen' };
}

export async function apiEndGame(gameId, result) {
  try {
    const cur = await db('GET', `games/${gameId}/result`);
    if (!cur) await db('PUT', `games/${gameId}/result`, result);
    return { success: true };
  } catch (e) { return { error: 'Fehler' }; }
}

export async function apiUpdateElo(oppElo, score) {
  const me = ensureUser();
  if (!me) return null;
  if (!currentUser) currentUser = me;
  try {
    const mine = (await db('GET', `players/${me.uid}/elo`)) || me.elo || 1200;
    const exp = 1 / (1 + Math.pow(10, ((oppElo || 1200) - mine) / 400));
    const nw = Math.max(100, Math.round(mine + 32 * (score - exp)));
    await db('PUT', `players/${me.uid}/elo`, nw);
    if (currentUser) currentUser.elo = nw;
    return nw;
  } catch (e) { return null; }
}

export const getCurrentUser = () => currentUser;
export const setCurrentUser = (u) => { currentUser = u; };
