import { Chess } from 'chess.js';
import { LESSONS, TRACKS, LEVELS } from './lessons.js';
import PUZ from './puzzles.json';
import { Board3D, webglSupported } from './board3d.js';
import { chooseMove, LEVELS as BOT } from './engine.js';
import { Board2D } from './board2d.js';
import { BoardView } from './boardview.js';
import KNIGHT from './knight.svg';
import { store, deSan, GLYPH, moveSpoken, tick, listenOnce, parseVoiceMove, getSample, getDictation, addDebugLog, getDebugLogs } from './util.js';
import { apiLogin, apiLogout, apiRename, apiLobbyState, apiMarkSeen, apiSendChallenge, apiAcceptChallenge, apiDeclineChallenge, apiGetGameState, apiSendMove, apiEndGame, apiUpdateElo, getCurrentUser } from './api-client.js';

/* global __WORKER_SRC__ */
const app = document.getElementById('app');
const $ = (s, r = app) => r.querySelector(s);
const $$ = (s, r = app) => [...r.querySelectorAll(s)];
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const settings = Object.assign({ anim: 'all', speed: 1, sound: true, dots: true, flip2p: false, coach: true }, store.get('settings', {}));
const progress = Object.assign({ done: {}, puz: { m1: 0, m2: 0, win: 0 } }, store.get('progress', {}));
const saveSettings = () => store.set('settings', settings);
const saveProgress = () => store.set('progress', progress);
progress.elo = progress.elo || { r: null, n: 0, w: 0, d: 0, l: 0 };
const lessonBase = () => Math.min(1300, Math.round(500 + Object.keys(progress.done).length * 6 + ((progress.puz.m1 || 0) + (progress.puz.m2 || 0) + (progress.puz.win || 0)) * 2));
const myElo = () => progress.elo.r == null ? lessonBase() : Math.round(progress.elo.n >= 5 ? progress.elo.r : (progress.elo.r * progress.elo.n + lessonBase() * (5 - progress.elo.n)) / 5);
const eloNote = () => progress.elo.n === 0 ? 'Schätzung aus Lektionen und Aufgaben. Spiele Partien für eine genauere Zahl.' : progress.elo.n < 5 ? `Aus ${progress.elo.n} Partie(n) und deinen Lektionen.` : `Aus ${progress.elo.n} Partien (${progress.elo.w} Siege, ${progress.elo.d} Remis, ${progress.elo.l} Niederlagen).`;
function rate(oppElo, score) {
  const e = progress.elo, r0 = e.r == null ? lessonBase() : e.r, K = e.n < 10 ? 40 : 24;
  const exp = 1 / (1 + Math.pow(10, (oppElo - r0) / 400));
  e.r = Math.max(300, Math.round(r0 + K * (score - exp))); e.n++; if (score === 1) e.w++; else if (score === 0) e.l++; else e.d++; saveProgress(); return e.r;
}

/* ───── Engine (Worker mit Rückfall auf den Hauptthread) ───── */
const engine = (() => {
  let w = null, id = 0, failed = false; const pend = {};
  const fallback = (opts, res) => setTimeout(() => res(chooseMove(opts)), 30);
  try {
    w = new Worker(URL.createObjectURL(new Blob([__WORKER_SRC__], { type: 'text/javascript' })));
    w.onmessage = (e) => { const p = pend[e.data.id]; if (p) { clearTimeout(p.t); delete pend[e.data.id]; p.res(e.data); } };
    w.onerror = () => { failed = true; for (const k in pend) { const p = pend[k]; clearTimeout(p.t); delete pend[k]; fallback(p.opts, p.res); } };
  } catch (e) { failed = true; }
  return {
    go(opts) {
      return new Promise((res) => {
        if (!w || failed) return fallback(opts, res);
        const i = ++id; const t = setTimeout(() => { delete pend[i]; failed = true; fallback(opts, res); }, (opts.timeMs || 4000) + 8000);
        pend[i] = { res, opts, t }; w.postMessage({ ...opts, id: i });
      });
    },
  };
})();

/* ───── 3D-Animation ───── */
const b3 = webglSupported() ? new Board3D() : null;
const has3d = () => !!(b3 && b3.ok);
const mkBoard = (host, o) => (has3d() ? new BoardView(b3, host, o) : new Board2D(host, o));
async function animate(wrap, chess, mv) {
  if (!has3d() || !b3.container || !wrap.contains(b3.container)) return;
  try { await b3.animateHand(mv, { speed: settings.speed * 1.5 }); await sleep(100); } catch (e) { console.warn(e); }
}

/* ───── Hilfen ───── */
let cleanup = null, onResize = null;
function show(el, opts = {}) {
  if (cleanup) cleanup(); cleanup = opts.cleanup || null; onResize = opts.resize || null;
  app.replaceChildren(el); window.scrollTo(0, 0); if (onResize) onResize();
}
window.addEventListener('resize', () => { if (onResize) onResize(); if (b3 && b3.ok) b3.resize(); });
function fitBoard(extra, ratio = 0.7) {
  const W = innerWidth, H = innerHeight, wide = W / H > 1.25;
  const avail = wide ? Math.min(H - 120, W * 0.56) : Math.min(W - 12, Math.max(H - extra, H * ratio * 0.6));
  app.style.setProperty('--bs', Math.max(240, Math.min(avail, 780)) + 'px'); app.classList.toggle('wide', wide);
}
function toast(msg, ms = 2600) {
  const t = h(`<div class="toast">${esc(msg)}</div>`); document.body.appendChild(t); setTimeout(() => t.classList.add('out'), ms); setTimeout(() => t.remove(), ms + 400);
}
function modal(html, buttons = []) {
  return new Promise((res) => {
    const m = h(`<div class="modal"><div class="mbox">${html}<div class="mbtns"></div></div></div>`);
    const bx = $('.mbtns', m);
    buttons.forEach(([label, val, cls]) => { const b = h(`<button class="btn ${cls || ''}">${esc(label)}</button>`); b.onclick = () => { m.remove(); res(val); }; bx.appendChild(b); });
    document.body.appendChild(m);
  });
}
const kingSq = (chess) => { for (const row of chess.board()) for (const p of row) if (p && p.type === 'k' && p.color === chess.turn()) return p.square; return null; };
const lastOf = (chess) => { const hst = chess.history({ verbose: true }); return hst.length ? hst[hst.length - 1] : null; };
function sameMove(a, b) { return a.from === b.from && a.to === b.to && (a.promotion || '') === (b.promotion || ''); }
function gameResult(c) {
  if (c.isCheckmate()) return { over: true, text: (c.turn() === 'w' ? 'Schwarz' : 'Weiß') + ' gewinnt durch Schachmatt!', winner: c.turn() === 'w' ? 'b' : 'w' };
  if (c.isStalemate()) return { over: true, text: 'Patt – Remis.' };
  if (c.isThreefoldRepetition()) return { over: true, text: 'Remis durch dreimalige Stellungswiederholung.' };
  if (c.isInsufficientMaterial()) return { over: true, text: 'Remis: zu wenig Material für ein Matt.' };
  if (c.isDraw()) return { over: true, text: 'Remis nach der 50-Züge-Regel.' };
  return { over: false };
}
function capturedBar(chess, color) {
  const init = { p: 8, n: 2, b: 2, r: 2, q: 1 }, cnt = { p: 0, n: 0, b: 0, r: 0, q: 0 }, val = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  let mine = 0, theirs = 0;
  for (const row of chess.board()) for (const p of row) if (p && p.type !== 'k') { if (p.color === color) { cnt[p.type]++; mine += val[p.type]; } else theirs += val[p.type]; }
  let s = ''; for (const t of ['q', 'r', 'b', 'n', 'p']) s += (GLYPH[t] + '︎').repeat(Math.max(0, init[t] - cnt[t]));
  const diff = theirs - mine; // Material, das 'color' mehr hat
  return { s, diff: -diff };
}
function askPromo(wrap, color) {
  return new Promise((res) => {
    const m = h(`<div class="promo"><div class="pbox">${['q', 'r', 'b', 'n'].map((t) => `<button data-t="${t}" class="pc ${color}">${GLYPH[t]}︎</button>`).join('')}</div></div>`);
    m.onclick = (e) => { const b = e.target.closest('button'); if (b) { m.remove(); res(b.dataset.t); } };
    wrap.appendChild(m);
  });
}
const levelName = (l) => `${BOT[l].name} (≈${BOT[l].elo})`;
const mkBoardHtml = () => '<div class="bwrap"><div class="bd"></div></div>';

/* ───── Tutor-Chat (Claude), mit Vorlesen und Diktat ───── */
const tutorHist = [];
async function openTutor(getCtx, intro = 'Frag mich etwas zur Stellung oder zur Lektion.', autoQ = '') {
  const sheet = h(`<div class="sheet"><div class="shin"><div class="shh"><b>💬 Tutor</b><button class="x">✕</button></div>
    <div class="chat"></div>
    <div class="chips"><button>Erkläre die Idee</button><button>Was droht hier?</button><button>Was wäre ein guter Plan?</button></div>
    <div class="inrow"><input type="text" placeholder="Frage stellen …" enterkeyhint="send"><button class="mic" title="Diktat">🎤</button><button class="send btn pri">Senden</button></div>
    <div class="hint">Tipp: Auf dem iPhone kannst du das Mikrofon der Tastatur zum Diktieren nutzen.</div></div></div>`);
  const chat = $('.chat', sheet), inp = $('input', sheet);
  const add = (cls, txt) => { const d = h(`<div class="msg ${cls}"></div>`); d.textContent = txt; chat.appendChild(d); chat.scrollTop = chat.scrollHeight; return d; };
  add('bot', intro); tutorHist.slice(-6).forEach((m) => add(m.r, m.t));
  $('.x', sheet).onclick = () => { sheet.remove(); };
  const dict = await getDictation(); const mic = $('.mic', sheet); if (!dict) mic.style.display = 'none';
  else {
    dict.onFinal(({ text }) => { inp.value = (inp.value + ' ' + text).trim(); }); dict.onState(({ state }) => mic.classList.toggle('on', state === 'listening'));
    mic.onclick = () => { if (mic.classList.contains('on')) dict.stop(); else dict.start().catch(() => toast('Diktat nicht verfügbar')); };
  }
  async function send(q) {
    q = (q || inp.value).trim(); if (!q) return; inp.value = ''; add('me', q); tutorHist.push({ r: 'me', t: q });
    const sample = await getSample(); const out = add('bot', '…');
    if (!sample) { out.textContent = 'Der Tutor ist in dieser Ansicht nicht verfügbar. Er läuft in der veröffentlichten Seite innerhalb der Claude-App.'; return; }
    const hist = tutorHist.slice(-7, -1).map((m) => (m.r === 'me' ? 'Schüler: ' : 'Trainer: ') + m.t).join('\n');
    const prompt = `Du bist ein freundlicher, geduldiger Schachtrainer in einer Schach-App und antwortest immer auf Deutsch. Antworte kurz (höchstens fünf Sätze), ohne Markdown und ohne Aufzählungszeichen, so dass man es gut vorlesen kann. Schreibe Figuren aus (Bauer, Springer, Läufer, Turm, Dame, König) und Felder wie "e 4". Sei ehrlich, wenn du dir bei einem konkreten Zug nicht sicher bist.\n\nKontext der App: ${getCtx()}\n\nBisheriges Gespräch:\n${hist || '(keins)'}\n\nFrage des Schülers: ${q}`;
    try {
      const r = await sample(prompt, { cache: false, modelTier: 'quick', onText: ({ text }) => { out.textContent = text; chat.scrollTop = chat.scrollHeight; } });
      out.textContent = r.text; tutorHist.push({ r: 'bot', t: r.text });
    } catch (e) { out.textContent = e && e.code === 'not_granted' ? 'Der Tutor wurde nicht freigegeben.' : e && e.code === 'rate_limited' ? 'Gerade zu viele Fragen. Versuch es gleich noch einmal.' : 'Der Tutor konnte nicht antworten.'; }
  }
  $('.send', sheet).onclick = () => send(); inp.onkeydown = (e) => { if (e.key === 'Enter') send(); };
  $$('.chips button', sheet).forEach((b) => { b.onclick = () => send(b.textContent); });
  document.body.appendChild(sheet); if (autoQ) send(autoQ); else setTimeout(() => inp.focus(), 60);
}

/* ───── Multiplayer ───── */
let firebaseReady = false;
let currentMultiplayerUser = null;

function generateNickname() {
  const names = ['Ben', 'Carina', 'Spieler', 'Schach', 'König'];
  const name = names[Math.floor(Math.random() * names.length)];
  const num = Math.floor(Math.random() * 999);
  return `${name}${num}`;
}

const mpUser = () => store.get('multiplayerUser', null);

async function setupMultiplayer() {
  const saved = mpUser();
  if (saved && saved.nickname) {
    toast('⏳ Verbinde …', 1500);
    const r = await apiLogin(saved.nickname);
    if (r.error) { toast('⚠️ ' + r.error + ' – bitte Internet prüfen'); store.del('multiplayerUser'); return multiplayerLogin(); }
    store.set('multiplayerUser', r.user);
    return multiplayerLobby();
  }
  multiplayerLogin();
}

function multiplayerLogin() {
  const el = h(`<div class="screen setup"><header><button class="back">←</button><h2>🎮 Multiplayer</h2><span></span></header><div class="pad">
    <p style="margin:20px 0;">Dein Nickname (frei wählbar):</p>
    <div style="display:flex;gap:8px;margin:16px 0;">
      <input type="text" id="nick-input" placeholder="z.B. Ben, Anna..." maxlength="30" style="flex:1;padding:8px;border:1px solid #666;border-radius:4px;">
      <button class="btn" data-a="refresh" style="width:60px;">🔄</button>
    </div>
    <p style="font-size:0.9em;color:#999;margin:8px 0;">🔄 erzeugt einen zufälligen Namen</p>
    <button class="btn pri wide" data-a="login">Anmelden & spielen</button>
    <button class="btn wide" data-a="back">Zurück</button>
  </div></div>`);

  el.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const a = b.dataset.a;
    if (b.classList.contains('back') || a === 'back') return home();
    if (a === 'refresh') {
      const inp = $('#nick-input', el);
      inp.value = generateNickname();
      inp.focus();
      return;
    }
    if (a === 'login') {
      const nick = $('#nick-input', el).value.trim();
      if (!nick) return toast('Gib einen Namen ein');
      toast('⏳ Verbinde …', 1500);
      const result = await apiLogin(nick);
      if (result.error) return toast('⚠️ ' + result.error);
      store.set('multiplayerUser', result.user);
      toast('✅ Angemeldet als ' + result.user.nickname + '!');
      multiplayerLobby();
    }
  };
  show(el);
}

function multiplayerLobby() {
  const user = getCurrentUser();
  if (!user) return home();

  let timer = null, alive = true, entering = false, polling = false, sig = '';

  const el = h(`<div class="screen setup"><header><button class="back">←</button><h2>🎮 Multiplayer</h2><button class="btn mini" data-a="profile">👤</button></header><div class="pad">
    <div class="opt"><b>Du: ${esc(user.nickname)}</b><p>Elo: ${user.elo}</p></div>
    <div class="opt"><b class="pcount">Online</b></div>
    <div class="plist" style="max-height:300px;overflow-y:auto;border:1px solid #444;border-radius:4px;padding:8px;"><i>⏳ Lade Spieler …</i></div>
    <div class="opt cbox" style="display:none;margin-top:16px;"><b>Herausforderungen</b><div class="clist"></div></div>
    <p class="net" style="font-size:.85em;color:#999;margin-top:12px;"></p>
    <button class="btn wide" data-a="back" style="margin-top:16px;">← Zurück</button>
  </div></div>`);

  function draw(st) {
    const net = $('.net', el);
    if (st.error) { net.textContent = '⚠️ ' + st.error + ' – versuche es weiter …'; return; }
    net.textContent = '';
    const s = JSON.stringify([st.players, st.challenges]);
    if (s === sig) return;
    sig = s;
    $('.pcount', el).textContent = `Online (${st.players.length})`;
    $('.plist', el).innerHTML = st.players.length ? st.players.map((p) => `
      <div style="padding:8px;border-bottom:1px solid #333;display:flex;justify-content:space-between;align-items:center;">
        <span>${esc(p.nickname)} (${p.elo} Elo)</span>
        <button class="btn" data-pid="${esc(p.uid)}" data-pname="${esc(p.nickname)}" data-a="challenge">Fordern</button>
      </div>`).join('') : '<i>Noch niemand online. Sobald ein Mitspieler die Multiplayer-Lobby öffnet, erscheint er hier.</i>';
    const cbox = $('.cbox', el);
    cbox.style.display = st.challenges.length ? '' : 'none';
    $('.clist', cbox).innerHTML = st.challenges.map((c) => `
      <div style="padding:8px;border-bottom:1px solid #333;">
        <span>${esc(c.fromNickname)} fordert dich heraus!</span>
        <button class="btn" data-cid="${esc(c.id)}" data-a="accept" style="margin-left:10px;">✅</button>
        <button class="btn" data-cid="${esc(c.id)}" data-a="decline">❌</button>
      </div>`).join('');
  }

  async function refresh() {
    if (!alive || entering || polling) return;
    polling = true;
    const st = await apiLobbyState();
    polling = false;
    if (!alive || entering) return;
    if (st.started) {
      entering = true;
      await apiMarkSeen(st.started.id);
      return gameScreen({ mode: 'multiplayer', gameId: st.started.gameId, human: 'w', opponent: st.started.opponent });
    }
    draw(st);
  }

  el.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const a = b.dataset.a;
    if (b.classList.contains('back') || a === 'back') return home();
    if (a === 'profile') return showProfile();
    if (a === 'challenge') {
      b.disabled = true;
      const r = await apiSendChallenge(b.dataset.pid, b.dataset.pname);
      b.disabled = false;
      toast(r.error ? '❌ ' + r.error : '✅ Herausforderung an ' + b.dataset.pname + ' gesendet – warte auf Antwort', 3500);
    } else if (a === 'accept') {
      if (entering) return;
      entering = true;
      const r = await apiAcceptChallenge(b.dataset.cid);
      if (r.error) { entering = false; sig = ''; toast('❌ ' + r.error); return; }
      gameScreen({ mode: 'multiplayer', gameId: r.gameId, human: 'b', opponent: r.opponent });
    } else if (a === 'decline') {
      await apiDeclineChallenge(b.dataset.cid);
      sig = '';
      refresh();
    }
  };

  show(el, { cleanup: () => { alive = false; clearInterval(timer); } });
  refresh();
  timer = setInterval(refresh, 2000);
}

/* ───── Startseite ───── */
function home() {
  const total = LESSONS.length, done = LESSONS.filter((l) => progress.done[l.id]).length;
  const saved = store.get('game', null), last = store.get('last', null);
  const el = h(`<div class="screen home"><div class="hero"><div class="logo">${KNIGHT}</div><h1>Schach-Akademie</h1><p>Spielen und lernen – vom ersten Zug bis zum Profi</p></div>
    <div class="cards">
      ${saved ? `<button class="card big" data-a="resume"><span>⏵</span><b>Partie fortsetzen</b><i>${saved.mode === 'two' ? '2 Spieler' : 'gegen ' + BOT[saved.level].name}</i></button>` : ''}
      <button class="card" data-a="play"><span>♟</span><b>Spielen</b><i>8 Stärkestufen</i></button>
      <button class="card" data-a="learn"><span>📚</span><b>Lernen</b><i>${done} / ${total} Lektionen</i></button>
      <button class="card" data-a="train"><span>🧩</span><b>Training</b><i>Matt & Taktik</i></button>
      ${last ? `<button class="card" data-a="ana"><span>📊</span><b>Analyse</b><i>Letzte Partie</i></button>` : ''}
      <button class="card" data-a="elo"><span>📈</span><b>Spielstärke</b><i>≈ ${myElo()} Elo</i></button>
      <button class="card" data-a="multi"><span>🎮</span><b>Multiplayer</b><i>Mit Freunden spielen</i></button>
      <button class="card" data-a="set"><span>⚙</span><b>Einstellungen</b><i>3D, Hilfen</i></button>
      <button class="card" data-a="reload" style="font-size:12px;opacity:0.6;"><span>🔄</span><b>Neu laden</b><i>Wenn etwas nicht stimmt</i></button>
    </div></div>`);
  el.onclick = (e) => { const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a; if (a === 'play') playSetup(); else if (a === 'learn') learnHome(); else if (a === 'train') trainHome(); else if (a === 'set') settingsScreen(); else if (a === 'multi') setupMultiplayer(); else if (a === 'reload') window.location.reload(); else if (a === 'elo') { const m = myElo(), lv = BOT.reduce((bi, x, i) => Math.abs(x.elo - m) < Math.abs(BOT[bi].elo - m) ? i : bi, 0); modal(`<h3>Deine Spielstärke: ≈ ${m} Elo</h3><p>${eloNote()}</p><p>Passende Computerstufe: <b>${BOT[lv].name}</b>.</p><p><small>Gewertet werden Partien gegen den Computer ohne Zurück und Tipp. Die Zahl ist eine Schätzung, kein offizielles Rating.</small></p>`, [['OK', 0, 'pri']]); } else if (a === 'resume') gameScreen(saved); else if (a === 'ana') analysisScreen(last); };
  show(el);
}

/* ───── Spiel-Setup ───── */
function playSetup(prefill = {}) {
  let mode = prefill.mode || 'bot', level = prefill.level ?? 3, color = prefill.color || 'w', tc = '0';
  const el = h(`<div class="screen setup"><header><button class="back">←</button><h2>Neue Partie</h2><span></span></header><div class="pad">
    <div class="seg" data-k="mode"><button data-v="bot">Gegen Computer</button><button data-v="two">2 Spieler</button></div>
    <div class="opt lv"><label>Stärke: <b class="lvn"></b></label><input type="range" min="0" max="7" step="1"><div class="lvd"></div></div>
    <div class="opt col"><label>Deine Farbe</label><div class="seg" data-k="color"><button data-v="w">♔ Weiß</button><button data-v="r">Zufall</button><button data-v="b">♚ Schwarz</button></div></div>
    <div class="opt"><label>Bedenkzeit</label><div class="seg wrap" data-k="tc"><button data-v="0">Keine</button><button data-v="5+0">5 min</button><button data-v="10+0">10 min</button><button data-v="10+5">10 + 5</button><button data-v="15+10">15 + 10</button><button data-v="30+0">30 min</button></div></div>
    <button class="btn pri wide go">Partie starten</button></div></div>`);
  const sync = () => {
    $$('[data-k=mode] button', el).forEach((b) => b.classList.toggle('on', b.dataset.v === mode));
    $$('[data-k=color] button', el).forEach((b) => b.classList.toggle('on', b.dataset.v === color));
    $$('[data-k=tc] button', el).forEach((b) => b.classList.toggle('on', b.dataset.v === tc));
    $('.lv', el).style.display = $('.col', el).style.display = mode === 'bot' ? '' : 'none';
    $('.lvn', el).textContent = levelName(level);
    $('.lvd', el).textContent = ['Zieht zufällig.', 'Macht viele Fehler. Ideal für den Einstieg.', 'Sieht einfache Drohungen.', 'Spielt wie ein Hobby-Spieler.', 'Rechnet drei Züge voraus.', 'Rechnet vier Züge voraus, macht seltene Fehler.', 'Starker Vereinsspieler, nimmt sich Bedenkzeit.', 'Stärkste Stufe: tiefe Berechnung, kaum Fehler.'][level];
  };
  $('input', el).value = level; $('input', el).oninput = (e) => { level = +e.target.value; sync(); };
  el.onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.classList.contains('back')) return home();
    if (b.parentElement.dataset.k === 'mode') { mode = b.dataset.v; sync(); } else if (b.parentElement.dataset.k === 'color') { color = b.dataset.v; sync(); } else if (b.parentElement.dataset.k === 'tc') { tc = b.dataset.v; sync(); }
    else if (b.classList.contains('go')) { const human = color === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : color; store.del('game'); gameScreen({ mode, level, human, fen: prefill.fen, moves: [], tc: tc === '0' ? null : { min: +tc.split('+')[0], inc: +tc.split('+')[1] } }); }
  };
  sync(); show(el);
}

/* ───── Profil-Bildschirm ───── */
function showProfile() {
  const u = getCurrentUser() || mpUser();
  if (!u) return setupMultiplayer();
  const el = h(`<div class="screen setup"><header><button class="back">←</button><h2>👤 Mein Profil</h2><span></span></header><div class="pad">
    <div class="opt" style="text-align:center;padding:20px;">
      <p style="font-size:0.9em;color:#999;margin-bottom:8px;">Dein aktueller Nickname:</p>
      <p style="font-size:1.5em;font-weight:bold;margin:16px 0;">${esc(u.nickname)}</p>
      <p style="color:#999;">Elo: ${u.elo}</p>
    </div>
    <button class="btn pri wide" data-a="change" style="margin-bottom:12px;">✏️ Ändern</button>
    <button class="btn wide" data-a="logout" style="background:#8B0000;color:#fff;">🚪 Abmelden</button>
    <button class="btn wide" data-a="back" style="margin-top:16px;opacity:0.6;">Zurück</button>
  </div></div>`);

  el.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const a = b.dataset.a;
    if (b.classList.contains('back') || a === 'back') return getCurrentUser() ? multiplayerLobby() : home();
    if (a === 'change') return changeNickname();
    if (a === 'logout') {
      const v = await modal('<h3>Abmelden?</h3><p>Du musst dich danach neu anmelden.</p>', [['Abbrechen', 0], ['Abmelden', 1, 'pri']]);
      if (!v) return;
      await apiLogout();
      store.del('multiplayerUser');
      toast('✅ Abgemeldet');
      home();
    }
  };
  show(el);
}

function showDebugLogs() {
  const logs = getDebugLogs();
  const logsHTML = logs.map(log => `<div style="font-size:0.8em;padding:4px;border-bottom:1px solid #333;font-family:monospace;">${esc(log)}</div>`).join('');

  const el = h(`<div class="screen setup"><header><button class="back">←</button><h2>🐛 Debug-Logs</h2><span></span></header><div class="pad">
    <div style="border:1px solid #666;border-radius:4px;overflow-y:auto;max-height:400px;background:#1a1a1a;padding:8px;margin-bottom:16px;">
      ${logs.length === 0 ? '<i>Keine Logs</i>' : logsHTML}
    </div>
    <button class="btn wide" data-a="clear">🗑️ Löschen</button>
    <button class="btn wide" data-a="back" style="margin-top:8px;opacity:0.6;">Zurück</button>
  </div></div>`);

  el.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.a === 'clear') {
      window.location.reload();
      return;
    }
    if (b.dataset.a === 'back') return playSetup();
  };

  show(el);
}

function changeNickname() {
  const oldNick = (getCurrentUser() || mpUser() || {}).nickname || '';
  const el = h(`<div class="screen setup"><header><button class="back">←</button><h2>✏️ Nickname ändern</h2><span></span></header><div class="pad">
    <p style="margin:20px 0;">Neuer Nickname:</p>
    <input type="text" id="new-nick" placeholder="z.B. Ben, Anna..." value="${esc(oldNick)}" maxlength="30" style="width:100%;padding:8px;border:1px solid #666;border-radius:4px;margin:12px 0;box-sizing:border-box;">
    <button class="btn pri wide" data-a="save" style="margin-bottom:8px;">✅ Speichern</button>
    <button class="btn wide" data-a="cancel">Abbrechen</button>
  </div></div>`);

  el.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const a = b.dataset.a;
    if (a === 'cancel' || b.classList.contains('back')) return showProfile();
    if (a === 'save') {
      const newNick = $('#new-nick', el).value.trim();
      if (!newNick) return toast('Gib einen Namen ein');
      const r = await apiRename(newNick);
      if (r.error) return toast('⚠️ ' + r.error);
      store.set('multiplayerUser', r.user);
      toast('✅ Nickname geändert!');
      showProfile();
    }
  };

  show(el);
  setTimeout(() => $('#new-nick', el).focus(), 100);
}

/* ───── Lehrer-Kommentare ───── */
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const PN = { p: 'Bauer', n: 'Springer', b: 'Läufer', r: 'Turm', q: 'Dame', k: 'König' };
function coachText(mv, loss, isBest, bestSan, ply) {
  const ctx = [];
  if (mv.flags.includes('k') || mv.flags.includes('q')) ctx.push('Rochade – dein König ist jetzt sicherer.');
  else if (mv.promotion) ctx.push('Umwandlung! Aus dem Bauern wird ' + (mv.promotion === 'q' ? 'eine Dame' : 'eine neue Figur') + '.');
  else if (mv.captured) ctx.push('Du schlägst ' + (mv.captured === 'q' ? 'die Dame' : mv.captured === 'p' ? 'einen Bauern' : 'einen ' + PN[mv.captured]) + '.');
  if (mv.san.includes('+')) ctx.push('Das gibt Schach.');
  let q;
  if (isBest) q = pick(['Sehr stark, das ist der beste Zug.', 'Perfekt, genau das würde auch die Engine spielen.', 'Ausgezeichnet gesehen.']);
  else if (loss <= 50) q = pick(['Guter Zug.', 'Solide gespielt.', 'Das passt gut.']);
  else if (loss <= 100) q = 'Etwas ungenau. Besser wäre ' + deSan(bestSan) + ' gewesen.';
  else if (loss <= 250) q = 'Vorsicht, das war ein Fehler. Stärker war ' + deSan(bestSan) + '.';
  else q = 'Autsch, ein Patzer. Hier brauchtest du ' + deSan(bestSan) + '.';
  if (ply <= 10 && loss <= 50 && !ctx.length) q += pick([' Denk in der Eröffnung an Mitte, Entwicklung und Rochade.', ' Entwickle weiter deine Figuren.']);
  return { text: [...ctx, q].join(' '), kind: isBest ? 'best' : loss <= 50 ? 'good' : loss <= 100 ? 'inacc' : loss <= 250 ? 'mist' : 'blun' };
}

/* ───── Spielbildschirm ───── */
const fmtClock = (ms) => { const t = Math.ceil(Math.max(0, ms) / 1000); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
function gameScreen(cfg) {
  const startFen = cfg.fen || START; const chess = new Chess(startFen);
  for (const u of cfg.moves || []) chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
  const two = cfg.mode === 'two', mp = cfg.mode === 'multiplayer', tc = cfg.tc || null, clock = tc ? (cfg.clock || { w: tc.min * 60000, b: tc.min * 60000 }) : null;
  let helped = false, rated = false, human = cfg.human || 'w', orient = two ? 'w' : human, busy = false, over = false, hint = [], alive = true, paused = false, lastT = Date.now(), timer = null, mpTimer = null, mpBusy = false, oppElo = 1200;
  const el = h(`<div class="screen game"><header><button class="back">←</button><h2>${mp ? 'Online: ' + esc(cfg.opponent) : two ? 'Zwei Spieler' : 'Gegen ' + esc(BOT[cfg.level].name)}</h2><button class="tutor">💬</button></header>
    <div class="gcol"><div class="pbar top"><b></b><span class="cap"></span><span class="clk"></span></div>${mkBoardHtml()}<div class="pbar bot"><b></b><span class="cap"></span><span class="clk"></span></div>
    <div class="side"><div class="status"></div><div class="coach" style="display:none"></div><div class="mlist"></div>
    <div class="ctrls"><button data-a="undo">↶<small>Zurück</small></button><button data-a="hint">💡<small>Tipp</small></button><button data-a="flip">⇅<small>Drehen</small></button><button data-a="coach">🎓<small>Lehrer</small></button><button data-a="ana">📊<small>Analyse</small></button><button data-a="resign">🏳<small>Aufgeben</small></button></div></div></div></div>`);
  const wrap = $('.bwrap', el);
  const board = mkBoard($('.bd', el), { tray: !cfg.fen,
    dots: settings.dots,
    movesFrom: (sq) => { if (busy || over) return null; const p = chess.get(sq); if (!p || p.color !== chess.turn() || (!two && p.color !== human)) return null; return [...new Set(chess.moves({ square: sq, verbose: true }).map((m) => m.to))]; },
    onMove: (from, to) => humanMove(from, to),
  });
  const hist = () => chess.history({ verbose: true }).map((m) => m.from + m.to + (m.promotion || ''));
  function save() {
    if (mp) return;
    if (over) { store.del('game'); store.set('last', { fen: cfg.fen, moves: hist(), human, mode: cfg.mode }); }
    else store.set('game', { mode: cfg.mode, level: cfg.level, human, fen: cfg.fen, moves: hist(), tc, clock });
  }
  function showClock() {
    const cl = $$('.clk', el); if (!clock) { cl.forEach((c) => { c.style.display = 'none'; }); return; }
    const top = orient === 'w' ? 'b' : 'w';
    [['top', top], ['bot', orient]].forEach(([k, c]) => { const e = $('.pbar.' + k + ' .clk', el); e.textContent = fmtClock(clock[c]); e.classList.toggle('low', clock[c] < 10000); e.classList.toggle('act', !over && chess.turn() === c); });
  }
  function draw() {
    const top = orient === 'w' ? 'b' : 'w', bot = orient;
    board.setOrientation(orient); board.draw(chess, { last: lastOf(chess), check: chess.inCheck() ? kingSq(chess) : null, hint });
    const nm = (c) => (mp ? (c === human ? 'Du' : cfg.opponent) : two ? (c === 'w' ? 'Weiß' : 'Schwarz') : c === human ? 'Du' : BOT[cfg.level].name + ' (Computer)');
    [['top', top], ['bot', bot]].forEach(([k, c]) => { const bar = $('.pbar.' + k, el), cp = capturedBar(chess, c === 'w' ? 'b' : 'w'); $('b', bar).textContent = (c === 'w' ? '♔ ' : '♚ ') + nm(c); $('.cap', bar).textContent = cp.s + (capturedBar(chess, c).diff > 0 ? ' +' + capturedBar(chess, c).diff : ''); });
    const hst = chess.history(); let s = ''; hst.forEach((m, i) => { s += (i % 2 === 0 ? `<em>${i / 2 + 1}.</em> ` : '') + deSan(m) + ' '; });
    const ml = $('.mlist', el); ml.innerHTML = s || '<i>Noch keine Züge</i>'; ml.scrollLeft = ml.scrollWidth;
    const r = gameResult(chess); let st;
    if (over && !r.over) st = 'Partie beendet.'; else if (r.over) st = r.text; else if (busy && !two && !mp && chess.turn() !== human) st = 'Computer denkt …'; else if (mp && chess.turn() !== human) st = cfg.opponent + ' ist am Zug …'; else st = (chess.turn() === 'w' ? 'Weiß' : 'Schwarz') + ' ist am Zug' + (chess.inCheck() ? ' – Schach!' : '');
    $('.status', el).textContent = st; showClock();
  }
  async function endDialog(text, remote = false, remoteScore = null) {
    over = true; save(); draw(); tick('end');
    if (mp && !rated) {
      rated = true; const gr = gameResult(chess); const opp = human === 'w' ? 'b' : 'w';
      const sc = remote ? remoteScore : gr.over ? (gr.winner ? (gr.winner === human ? 1 : 0) : 0.5) : 0;
      if (!remote) apiEndGame(cfg.gameId, { winner: sc === 1 ? human : sc === 0 ? opp : 'draw', reason: gr.over ? 'game' : 'resign' });
      if (chess.history().length >= 2 && sc != null) {
        const nw = await apiUpdateElo(oppElo, sc);
        if (nw) { text += ` Deine Elo: ${nw}.`; store.set('multiplayerUser', { ...mpUser(), elo: nw }); }
      }
    }
    if (cfg.mode === 'bot' && !rated && !cfg.fen && chess.history().length >= 4) {
      rated = true; const gr = gameResult(chess); let sc = null;
      if (gr.over) sc = gr.winner ? (gr.winner === human ? 1 : 0) : 0.5; else if (text.startsWith('Aufgegeben')) sc = 0; else if (/keine Zeit/.test(text)) sc = text.includes((human === 'w' ? 'Weiß' : 'Schwarz') + ' gewinnt') ? 1 : 0;
      if (helped) text += ' Hilfen (Zurück/Tipp) genutzt: nicht für deine Spielstärke gewertet.';
      else if (sc != null) { const old = myElo(), nw = (rate(BOT[cfg.level].elo, sc), myElo()); text += ` Deine geschätzte Spielstärke: ${nw} (${nw >= old ? '+' : ''}${nw - old}).`; }
    }
    const can = chess.history().length >= 2;
    const v = await modal(`<h3>Partie beendet</h3><p>${esc(text)}</p>`, [['Neue Partie', 'new', 'pri'], ...(can ? [['📊 Analyse', 'ana']] : []), ['Brett ansehen', 'stay'], ['Startseite', 'home']]);
    if (v === 'new') { if (mp) multiplayerLobby(); else playSetup({ mode: cfg.mode, level: cfg.level }); } else if (v === 'home') home(); else if (v === 'ana') analysisScreen({ fen: cfg.fen, moves: hist(), human, mode: cfg.mode });
  }
  async function finish() { const r = gameResult(chess); if (!r.over) return false; await endDialog(r.text); return true; }
  async function applyMove(mv) {
    const fenBefore = chess.fen(), mover = mv.color; busy = true; paused = true; hint = []; draw();
    await animate(wrap, chess, mv, orient);
    chess.move({ from: mv.from, to: mv.to, promotion: mv.promotion });
    if (mp && mv.color === human) apiSendMove(cfg.gameId, chess.history().length - 1, mv.from + mv.to + (mv.promotion || ''));
    if (clock && tc.inc) clock[mv.color] += tc.inc * 1000;
    if (settings.sound) tick(mv.captured ? 'cap' : 'move');
    if (two && settings.flip2p) orient = chess.turn();
    busy = false; paused = false; save(); draw();
    if (await finish()) return;
    if (settings.coach && !mp && (two || mover === human)) await coachMove(mv, fenBefore);
    if (!two && !mp && chess.turn() !== human && !over) botTurn();
  }
  async function coachMove(mv, fenBefore) {
    const box = $('.coach', el); busy = true; paused = true;
    try {
      const lim = (pr) => Promise.race([pr, new Promise((_, rj) => setTimeout(() => rj(new Error('t')), 4000))]);
      const pre = await lim(engine.go({ fen: fenBefore, level: 7, timeMs: 220 })), post = await lim(engine.go({ fen: chess.fen(), level: 7, timeMs: 220 }));
      const loss = Math.max(0, (pre.score || 0) + (post.score || 0)), best = pre.uci === mv.from + mv.to + (mv.promotion || '');
      let bs = '?'; try { const cc = new Chess(fenBefore); const bm = cc.move({ from: pre.uci.slice(0, 2), to: pre.uci.slice(2, 4), promotion: pre.uci[4] }); bs = bm.san; } catch (e) {}
      const r = coachText(mv, best ? 0 : loss, best, bs, chess.history().length);
      if (!alive) return; box.style.display = ''; box.className = 'coach q-' + r.kind; box.textContent = '🎓 ' + r.text;
    } catch (e) {} finally { busy = false; paused = false; }
  }
  async function humanMove(from, to) {
    const ms = chess.moves({ square: from, verbose: true }).filter((m) => m.to === to); if (!ms.length) return;
    let mv = ms[0]; if (ms.length > 1) { paused = true; const t = await askPromo(wrap, chess.turn()); paused = false; mv = ms.find((m) => m.promotion === t) || ms[0]; }
    applyMove(mv);
  }
  async function botTurn() {
    busy = true; draw(); const t0 = Date.now(); const me = chess.turn();
    const tm = clock && cfg.level >= 6 ? Math.max(300, Math.min(cfg.level === 7 ? 3500 : 1400, clock[me] / 30)) : undefined;
    const r = await engine.go({ fen: startFen, moves: hist(), level: cfg.level, timeMs: tm });
    if (!alive || over) return; await sleep(Math.max(0, 450 - (Date.now() - t0)));
    if (over) return;
    if (!r.uci) { busy = false; draw(); return finish(); }
    const mv = chess.moves({ verbose: true }).find((m) => m.from === r.uci.slice(0, 2) && m.to === r.uci.slice(2, 4) && (m.promotion || '') === (r.uci[4] || ''));
    if (mv) await applyMove(mv); else { busy = false; draw(); }
  }
  el.onclick = async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.classList.contains('back')) {
      if (mp && !over && chess.history().length) {
        const v = await modal('<h3>Partie verlassen?</h3><p>Das zählt als Aufgabe.</p>', [['Bleiben', 0], ['Verlassen', 1, 'pri']]);
        if (!v) return;
        apiEndGame(cfg.gameId, { winner: human === 'w' ? 'b' : 'w', reason: 'resign' });
        if (chess.history().length >= 2) apiUpdateElo(oppElo, 0);
        return multiplayerLobby();
      }
      save(); return mp ? multiplayerLobby() : home();
    }
    if (b.classList.contains('tutor') && mp) return toast('Im Online-Spiel nicht verfügbar');
    if (b.classList.contains('tutor')) return openTutor(() => `Partie gegen ${two ? 'einen Mitspieler' : BOT[cfg.level].name + ' (ungefähr ' + BOT[cfg.level].elo + ' Elo)'}. Stellung (FEN): ${chess.fen()}. Bisherige Züge: ${chess.history().join(' ') || 'keine'}. Der Schüler spielt ${two ? 'beide Seiten' : human === 'w' ? 'Weiß' : 'Schwarz'}.`, 'Frag mich zur aktuellen Stellung.');
    const a = b.dataset.a;
    if (a === 'coach') { settings.coach = !settings.coach; saveSettings(); b.classList.toggle('on', settings.coach); if (!settings.coach) { $('.coach', el).style.display = 'none'; } toast(settings.coach ? 'Lehrer-Kommentare an' : 'Lehrer-Kommentare aus'); }
    else if (a === 'flip') { orient = orient === 'w' ? 'b' : 'w'; draw(); }
    else if (a === 'undo') {
      if (busy || !chess.history().length) return; helped = true;
      if (two) chess.undo(); else { chess.undo(); if (chess.turn() !== human && chess.history().length) chess.undo(); }
      over = false; hint = []; save(); draw(); if (!two && chess.turn() !== human) botTurn();
    } else if (a === 'hint') {
      if (busy || over) return; helped = true; busy = true; $('.status', el).textContent = 'Ich überlege …';
      const r = await engine.go({ fen: startFen, moves: hist(), level: 7, timeMs: 900 }); busy = false;
      if (r.uci) { hint = [r.uci.slice(0, 2), r.uci.slice(2, 4)]; draw(); }
    } else if (a === 'ana') {
      if (chess.history().length < 2) return toast('Spiele zuerst ein paar Züge.');
      save(); analysisScreen({ fen: cfg.fen, moves: hist(), human, mode: cfg.mode });
    } else if (a === 'resign') {
      if (over) return; const v = await modal('<h3>Aufgeben?</h3><p>Die Partie wird beendet.</p>', [['Abbrechen', 0], ['Aufgeben', 1, 'pri']]);
      if (v) endDialog('Aufgegeben.');
    }
  };
  $('[data-a=coach]', el).classList.toggle('on', settings.coach);
  if (mp) ['undo', 'hint', 'coach'].forEach((k) => { $(`[data-a=${k}]`, el).style.display = 'none'; });
  show(el, { resize: () => fitBoard(330), cleanup: () => { alive = false; clearInterval(timer); clearInterval(mpTimer); } });
  draw();
  if (mp) {
    const poll = async () => {
      if (!alive || over || busy || mpBusy) return;
      mpBusy = true;
      try {
        apiMarkSeen();
        const r = await apiGetGameState(cfg.gameId);
        if (!alive || over || busy || r.error) return;
        const g = r.game; oppElo = (human === 'w' ? g.blackElo : g.whiteElo) || 1200;
        const hs = hist();
        if (g.moves.length > hs.length) {
          const u = g.moves[hs.length];
          const mv = chess.moves({ verbose: true }).find((m) => m.from === u.slice(0, 2) && m.to === u.slice(2, 4) && (m.promotion || '') === (u[4] || ''));
          if (mv && mv.color !== human) { mpBusy = false; return applyMove(mv); }
        } else if (g.moves.length < hs.length) {
          for (let i = g.moves.length; i < hs.length; i++) if ((i % 2 === 0) === (human === 'w')) apiSendMove(cfg.gameId, i, hs[i]);
        }
        if (g.result && !over) {
          const w = g.result.winner, sc = w === 'draw' ? 0.5 : w === human ? 1 : 0;
          endDialog(w === 'draw' ? 'Remis.' : w === human ? (g.result.reason === 'resign' ? cfg.opponent + ' hat aufgegeben. Du gewinnst.' : 'Du hast gewonnen.') : 'Du hast verloren.', true, sc);
        }
      } finally { mpBusy = false; }
    };
    mpTimer = setInterval(poll, 1000); poll();
  }
  if (clock) timer = setInterval(() => {
    const now = Date.now(), dt = now - lastT; lastT = now; if (over || paused) return;
    const t = chess.turn(); clock[t] -= dt;
    if (clock[t] <= 0) { clock[t] = 0; endDialog((t === 'w' ? 'Weiß' : 'Schwarz') + ' hat keine Zeit mehr. ' + (t === 'w' ? 'Schwarz' : 'Weiß') + ' gewinnt.'); } else showClock();
  }, 250);
  if (over || gameResult(chess).over) { over = true; draw(); } else if (!two && !mp && chess.turn() !== human) botTurn();
}

/* ───── Partie-Analyse ───── */
function qual(loss, isBest) {
  if (isBest) return { k: 'best', t: 'Bestzug', s: '' }; if (loss <= 20) return { k: 'good', t: 'Sehr guter Zug', s: '' };
  if (loss <= 50) return { k: 'good', t: 'Guter Zug', s: '' }; if (loss <= 100) return { k: 'inacc', t: 'Ungenauigkeit', s: '?!' };
  if (loss <= 250) return { k: 'mist', t: 'Fehler', s: '?' }; return { k: 'blun', t: 'Patzer', s: '??' };
}
function analysisScreen(g) {
  const startFen = g.fen || START, c = new Chess(startFen), sans = [], ucis = [], fens = [startFen];
  for (const u of g.moves) { const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); sans.push(m.san); ucis.push(u); fens.push(c.fen()); }
  const n = sans.length, ev = new Array(n + 1).fill(null), bestU = new Array(n + 1).fill(null);
  let ply = n, alive = true, done = false, better = false; const orient = g.human && g.mode !== 'two' ? g.human : 'w';
  const chess = new Chess(fens[ply]);
  const el = h(`<div class="screen lesson ana"><header><button class="back">←</button><h2>Analyse</h2><button class="tutor">💬</button></header><div class="lcol"><div class="lbd">${mkBoardHtml()}</div><div class="lpanel">
    <div class="prog"><div class="bar"><i style="width:0"></i></div><small>Die Engine prüft jeden Zug …</small></div>
    <svg class="graph" viewBox="0 0 300 70" preserveAspectRatio="none"></svg>
    <div class="ctrls lc"><button data-a="start">⏮</button><button data-a="prev">◀</button><button data-a="next">▶</button><button data-a="end">⏭</button><button data-a="pm">⚠<small>Vorheriger</small></button><button data-a="nm">⚠<small>Nächster</small></button></div>
    <div class="card note"><div class="tl"></div><p></p><div class="askb"></div></div><div class="card sum"></div><div class="chips2"></div></div></div></div>`);
  const board = mkBoard($('.bd', el), { tray: !g.fen, dots: false, movesFrom: () => null, onMove: () => {} });
  const turnAt = (i) => fens[i].split(' ')[1];
  const loss = (i) => (ev[i] == null || ev[i + 1] == null ? null : Math.max(0, ev[i] + ev[i + 1]));
  const qOf = (i) => { const l = loss(i); return l == null ? null : qual(l, bestU[i] === ucis[i]); };
  const sanOf = (i, u) => { try { const cc = new Chess(fens[i]); return cc.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san; } catch (e) { return null; } };
  const fmt = (l) => (l / 100).toFixed(1).replace('.', ',');
  function render() {
    chess.load(fens[ply]);
    const bu = better && ply < n ? bestU[ply] : null;
    board.setOrientation(orient); board.draw(chess, { last: ply > 0 ? { from: ucis[ply - 1].slice(0, 2), to: ucis[ply - 1].slice(2, 4) } : null, check: chess.inCheck() ? kingSq(chess) : null, hint: bu ? [bu.slice(0, 2), bu.slice(2, 4)] : [] });
    const note = $('.note', el), tl = $('.tl', note), p = $('p', note), bx = $('.askb', note); bx.innerHTML = '';
    if (better && bu) { tl.textContent = 'Besserer Zug'; p.textContent = 'Die Engine bevorzugt ' + deSan(sanOf(ply, bu) || '?') + '. Mit ▶ siehst du, was du gespielt hast.'; }
    else if (ply === 0) { tl.textContent = 'Ausgangsstellung'; p.textContent = 'Blättere mit den Pfeilen durch die Partie oder tippe auf einen Zug.'; }
    else {
      const i = ply - 1, q = qOf(i); tl.textContent = `${Math.ceil(ply / 2)}${ply % 2 ? '.' : '…'} ${deSan(sans[i])} ${q ? q.s : ''}`;
      if (!q) p.textContent = 'Wird noch analysiert …';
      else if (q.k === 'best' || q.k === 'good') p.textContent = q.t + '.';
      else {
        const bs = bestU[i] && sanOf(i, bestU[i]); p.textContent = `${q.t}: etwa ${fmt(loss(i))} Bauern Verlust.` + (bs ? ` Besser war ${deSan(bs)}.` : '');
        bx.innerHTML = '<button data-a="show">Besseren Zug zeigen</button><button data-a="why">Tutor fragen</button>';
      }
    }
    const pts = ev.map((e, i) => (e == null ? null : (turnAt(i) === 'w' ? e : -e)));
    const X = (i) => (n ? (i * 300) / n : 150), Y = (v) => 35 - 31 * Math.tanh(v / 450);
    const line = pts.map((v, i) => (v == null ? '' : `${X(i).toFixed(1)},${Y(v).toFixed(1)}`)).filter(Boolean).join(' ');
    $('.graph', el).innerHTML = `<line x1="0" y1="35" x2="300" y2="35" stroke="#444a5c" stroke-width=".8"/><polyline points="${line}" fill="none" stroke="#e3b341" stroke-width="1.6"/><line x1="${X(ply)}" y1="0" x2="${X(ply)}" y2="70" stroke="#4ea1ff" stroke-width="1.2"/>`;
    $('.chips2', el).innerHTML = sans.map((sn, i) => { const q = qOf(i); return `${i % 2 === 0 ? `<em>${i / 2 + 1}.</em>` : ''}<button data-p="${i + 1}" class="q-${q ? q.k : 'x'} ${ply === i + 1 ? 'cur' : ''}">${esc(deSan(sn))}${q ? q.s : ''}</button>`; }).join('');
    if (done) {
      const st = (col) => { let sum = 0, cnt = 0, a = 0, m = 0, b = 0; for (let i = 0; i < n; i++) if (i % 2 === (col === 'w' ? 0 : 1)) { const l = loss(i), q = qOf(i); sum += Math.min(l, 600); cnt++; if (q.k === 'inacc') a++; else if (q.k === 'mist') m++; else if (q.k === 'blun') b++; } return cnt ? `Ø Verlust ${fmt(sum / cnt)} · ?! ${a} · ? ${m} · ?? ${b}` : '–'; };
      const nm = (c) => (g.mode === 'two' ? (c === 'w' ? 'Weiß' : 'Schwarz') : c === g.human ? 'Du' : 'Gegner');
      $('.sum', el).innerHTML = `<div class="tl">Zusammenfassung</div><p>${nm('w')} (Weiß): ${st('w')}<br>${nm('b')} (Schwarz): ${st('b')}</p>`;
    } else $('.sum', el).style.display = 'none';
    if (done) $('.sum', el).style.display = '';
  }
  (async () => {
    for (let i = 0; i <= n; i++) {
      if (!alive) return; const cc = new Chess(fens[i]);
      if (cc.isCheckmate()) ev[i] = -1500; else if (cc.isGameOver()) ev[i] = 0;
      else { const r = await engine.go({ fen: fens[i], level: 7, timeMs: 150 }); if (!alive) return; ev[i] = Math.max(-1500, Math.min(1500, r.score || 0)); bestU[i] = r.uci || null; }
      $('.prog i', el).style.width = ((i + 1) / (n + 1)) * 100 + '%'; if (i % 3 === 0) render();
    }
    done = true; $('.prog', el).style.display = 'none'; render();
  })();
  const goPly = (p) => { ply = Math.max(0, Math.min(n, p)); better = false; render(); };
  const mistake = (dir) => { for (let i = ply + (dir > 0 ? 0 : -2); i >= 0 && i < n; i += dir) { const q = qOf(i); if (q && ['mist', 'blun', 'inacc'].includes(q.k)) return goPly(i + 1); } toast('Keine weiteren Fehler.'); };
  el.onclick = (e) => {
    const b = e.target.closest('button, svg'); if (!b) return;
    if (b.classList.contains('back')) return home();
    if (b.classList.contains('tutor')) return openTutor(() => `Analyse einer Partie. Stellung (FEN): ${fens[ply]}. Bisherige Züge: ${sans.slice(0, ply).join(' ')}.`, 'Ich helfe dir, deine Partie zu verstehen.');
    if (b.dataset.p) return goPly(+b.dataset.p);
    const a = b.dataset.a;
    if (a === 'start') goPly(0); else if (a === 'end') goPly(n); else if (a === 'prev') goPly(ply - 1); else if (a === 'next') goPly(better ? ply : ply + 1);
    else if (a === 'nm') mistake(1); else if (a === 'pm') mistake(-1);
    else if (a === 'show') { ply -= 1; better = true; render(); }
    else if (a === 'why') { const i = ply - 1, bs = bestU[i] && sanOf(i, bestU[i]); openTutor(() => `Partieanalyse. Stellung vor dem Zug (FEN): ${fens[i]}. Gespielt wurde ${sans[i]}, die Engine bevorzugt ${bs || 'einen anderen Zug'}.`, 'Ich erkläre dir den Fehler.', `Warum war ${deSan(sans[i])} ein Fehler und warum ist ${deSan(bs || '?')} besser?`); }
  };
  $('.graph', el).onclick = (e) => { const r = e.currentTarget.getBoundingClientRect(); goPly(Math.round(((e.clientX - r.left) / r.width) * n)); };
  show(el, { resize: () => fitBoard(420), cleanup: () => { alive = false; } });
  render();
}

/* ───── Lernbereich ───── */
function learnHome(trackId = store.get('track', 'grund')) {
  store.set('track', trackId);
  const tr = TRACKS.find((t) => t.id === trackId), ls = LESSONS.filter((l) => l.track === trackId);
  const el = h(`<div class="screen learn"><header><button class="back">←</button><h2>Lernen</h2><span></span></header>
    <div class="tabs">${TRACKS.map((t) => `<button data-t="${t.id}" class="${t.id === trackId ? 'on' : ''}"><span>${t.icon}</span>${esc(t.name)}</button>`).join('')}</div>
    <div class="pad"><p class="desc">${esc(tr.desc)}</p>${[1, 2, 3, 4].map((lv) => {
    const items = ls.filter((l) => l.level === lv); if (!items.length) return '';
    const d = items.filter((l) => progress.done[l.id]).length;
    return `<div class="lvh"><b>Stufe ${lv} · ${LEVELS[lv - 1]}</b><span>${d}/${items.length}</span></div><div class="bar"><i style="width:${(d / items.length) * 100}%"></i></div>` +
      items.map((l) => `<button class="lrow" data-l="${l.id}"><span class="ck">${progress.done[l.id] ? '✓' : '○'}</span><span class="lt">${esc(l.title)}</span>${l.ask ? '<small>Aufgabe</small>' : ''}<span class="ar">›</span></button>`).join('');
  }).join('')}</div></div>`);
  el.onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.classList.contains('back')) return home();
    if (b.dataset.t) return learnHome(b.dataset.t);
    if (b.dataset.l) lessonScreen(b.dataset.l);
  };
  show(el);
}

function lessonScreen(id) {
  const l = LESSONS.find((x) => x.id === id), startFen = l.fen || START;
  const chess = new Chess(startFen); let idx = 0, busy = false, running = false, solved = new Set(), alive = true, hintShown = false;
  const el = h(`<div class="screen lesson"><header><button class="back">←</button><h2>${esc(l.title)}</h2><button class="tutor">💬</button></header>
    <div class="lcol"><div class="lbd">${mkBoardHtml()}</div><div class="lpanel">
    <div class="chip">${esc(TRACKS.find((t) => t.id === l.track).name)} · Stufe ${l.level} ${esc(LEVELS[l.level - 1])}</div>
    <div class="card idea"><div class="tl">Idee</div><p></p></div>
    <div class="card note" style="display:none"><div class="tl"></div><p></p></div>
    <div class="askbox" style="display:none"></div>
    <div class="ctrls lc"><button data-a="start">⏮</button><button data-a="prev">◀</button><button data-a="play">▶<small>Abspielen</small></button><button data-a="next">▶|</button><button data-a="redo">🎬<small>3D</small></button></div>
    <div class="done" style="display:none"></div></div></div></div>`);
  $('.idea p', el).textContent = l.intro;
  const wrap = $('.bwrap', el), orient = (chess.turn() === 'b' && l.fen && !l.moves.length) ? 'b' : (l.fen && chess.turn() === 'b' ? 'b' : 'w');
  const askAt = () => (l.ask && l.ask.includes(idx) && !solved.has(idx));
  const board = mkBoard($('.bd', el), {
    dots: settings.dots,
    movesFrom: (sq) => { if (busy || !askAt()) return null; const p = chess.get(sq); if (!p || p.color !== chess.turn()) return null; return [...new Set(chess.moves({ square: sq, verbose: true }).map((m) => m.to))]; },
    onMove: (f, t) => tryMove(f, t),
  });
  const expected = () => { const c = new Chess(chess.fen()); const m = c.move(l.moves[idx]); const alts = ((l.alt && l.alt[idx]) || []).map((s) => { try { return new Chess(chess.fen()).move(s); } catch (e) { return null; } }).filter(Boolean); return [m, ...alts]; };
  function draw(hint = []) {
    board.setOrientation(orient); board.draw(chess, { last: lastOf(chess), check: chess.inCheck() ? kingSq(chess) : null, hint });
    const note = $('.note', el), ask = $('.askbox', el), done = $('.done', el);
    const nt = idx > 0 && l.notes && l.notes[idx - 1];
    const lm = lastOf(chess);
    if (idx > 0 && lm) { note.style.display = ''; $('.tl', note).textContent = `Zug ${Math.ceil(idx / 2)}${idx % 2 ? '' : '…'} · ${deSan(lm.san)}`; $('p', note).textContent = nt || moveSpoken(lm).replace(/([a-h]) ([1-8])/g, '$1$2'); } else note.style.display = 'none';
    if (askAt()) { ask.style.display = ''; ask.innerHTML = `<b>Du bist dran!</b> Finde den richtigen Zug für ${chess.turn() === 'w' ? 'Weiß' : 'Schwarz'}.<div class="askb"><button data-a="hint">💡 Tipp</button><button data-a="sol">Lösung zeigen</button></div><div class="fb"></div>`; hintShown = false; } else ask.style.display = 'none';
    const fin = idx >= l.moves.length && !askAt();
    if (fin || (!l.moves.length)) {
      progress.done[l.id] = true; saveProgress(); done.style.display = '';
      const i = LESSONS.findIndex((x) => x.id === l.id), nxt = LESSONS.slice(i + 1).find((x) => x.track === l.track);
      done.innerHTML = `<b>✓ Lektion abgeschlossen</b><div class="dbtns">${nxt ? `<button class="btn pri" data-a="nxt">Nächste Lektion</button>` : ''}${!gameResult(chess).over ? `<button class="btn" data-a="game">Ab hier gegen Computer spielen</button>` : ''}<button class="btn" data-a="list">Zur Liste</button></div>`;
    } else done.style.display = 'none';
  }
  async function forward(auto = false) {
    if (busy || idx >= l.moves.length || askAt()) return; busy = true;
    const m = chess.moves({ verbose: true }).find((x) => x.san === l.moves[idx]); if (!m) { busy = false; return; }
    await animate(wrap, chess, m, orient);
    chess.move(m.san); idx++; if (settings.sound) tick(m.captured ? 'cap' : 'move'); busy = false; draw();
    if (auto) { await sleep(1500); }
  }
  async function tryMove(from, to) {
    const ms = chess.moves({ square: from, verbose: true }).filter((m) => m.to === to); if (!ms.length) return;
    let mv = ms[0]; if (ms.length > 1) { const t = await askPromo(wrap, chess.turn()); mv = ms.find((m) => m.promotion === t) || ms[0]; }
    const ok = expected().some((e) => sameMove(e, mv)), fb = $('.fb', el), key = mv.san.replace(/[+#]/g, '');
    if (!ok) {
      const w = l.wrong && l.wrong[key]; if (fb) fb.textContent = w || 'Nicht ganz. Versuch es noch einmal oder tippe auf „Tipp“.'; if (fb) fb.className = 'fb bad'; board.draw(chess, { last: lastOf(chess), check: chess.inCheck() ? kingSq(chess) : null }); return;
    }
    solved.add(idx); busy = true; await animate(wrap, chess, mv, orient); chess.move({ from: mv.from, to: mv.to, promotion: mv.promotion }); idx++; busy = false; tick('end'); draw();
    toast('Richtig! ✓');
  }
  async function playAll() {
    running = true; $('[data-a=play]', el).classList.add('on');
    while (running && alive && idx < l.moves.length && !askAt()) { await forward(true); }
    running = false; $('[data-a=play]', el).classList.remove('on');
  }
  el.onclick = async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.classList.contains('back')) return learnHome(l.track);
    if (b.classList.contains('tutor')) return openTutor(() => `Lektion „${l.title}“ (Stufe ${l.level}, ${LEVELS[l.level - 1]}). Ziel der Lektion: ${l.intro} Aktuelle Stellung (FEN): ${chess.fen()}. Bisher gespielte Lektionszüge: ${chess.history().join(' ') || 'keine'}.`, 'Frag mich zu dieser Lektion.');
    const a = b.dataset.a;
    if (a === 'next') { running = false; await forward(false); }
    else if (a === 'prev') { running = false; if (busy || idx === 0) return; chess.undo(); idx--; draw(); }
    else if (a === 'start') { running = false; if (busy) return; while (chess.history().length) chess.undo(); idx = 0; draw(); }
    else if (a === 'play') { if (running) { running = false; } else playAll(); }
    else if (a === 'redo') { const m = lastOf(chess); if (m && !busy) { busy = true; chess.undo(); const mv = chess.moves({ verbose: true }).find((x) => x.san === m.san); board.draw(chess, { last: lastOf(chess) }); await animate(wrap, chess, mv, orient); chess.move(m.san); busy = false; draw(); } else toast('Erst einen Zug abspielen.'); }
    else if (a === 'hint') { const [m] = expected(); const fb = $('.fb', el); if (!hintShown) { hintShown = true; fb.className = 'fb'; fb.textContent = (l.hint && l.hint[idx]) || 'Überlege, welche Figur etwas bedroht.'; } else { draw([m.from]); const f2 = $('.fb', el); f2.className = 'fb'; f2.textContent = 'Die markierte Figur musst du ziehen.'; } }
    else if (a === 'sol') { solved.add(idx); await forward(false); }
    else if (a === 'nxt') { const i = LESSONS.findIndex((x) => x.id === l.id), nx = LESSONS.slice(i + 1).find((x) => x.track === l.track); if (nx) lessonScreen(nx.id); }
    else if (a === 'list') learnHome(l.track);
    else if (a === 'game') { gameScreen({ mode: 'bot', level: 3, human: chess.turn(), fen: chess.fen(), moves: [] }); }
  };
  show(el, { resize: () => fitBoard(380), cleanup: () => { alive = false; running = false; } });
  draw();
}

/* ───── Training ───── */
const KINDS = { m1: ['Matt in 1', 'Finde den Zug, der sofort Schachmatt setzt.'], m2: ['Matt in 2', 'Setze in zwei Zügen matt, egal wie der Gegner antwortet.'], win: ['Material gewinnen', 'Finde den stärksten Zug.'] };
function mateIn(c, n) {
  for (const m of c.moves({ verbose: true })) {
    c.move(m); let ok;
    if (c.isCheckmate()) ok = true;
    else if (n > 1 && !c.isGameOver()) { ok = true; for (const r of c.moves({ verbose: true })) { c.move(r); if (!mateIn(c, n - 1)) ok = false; c.undo(); if (!ok) break; } } else ok = false;
    c.undo(); if (ok) return true;
  }
  return false;
}
/* ───── Aktives Wiederholen (Abfrage aus dem Gedächtnis, Leitner-Intervalle) ───── */
const DAY = 864e5, BOX_DAYS = [0, 1, 3, 7, 21];
progress.rep = progress.rep || {};
const repOk = (l) => l.moves.length >= 4;
const repDue = (l) => { const r = progress.rep[l.id]; return !r || (r.due || 0) <= Date.now(); };
const repStars = (id) => (progress.rep[id] && progress.rep[id].best) || 0;
function repQueue(track) {
  const pool = LESSONS.filter((l) => repOk(l) && (track === 'all' || l.track === track));
  const due = pool.filter((l) => progress.rep[l.id] && repDue(l));
  const fresh = pool.filter((l) => !progress.rep[l.id] && progress.done[l.id]);
  const rest = pool.filter((l) => !progress.rep[l.id] && !progress.done[l.id]);
  const mix = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((x) => x[1]);
  return [...mix(due), ...mix(fresh), ...mix(rest)].slice(0, 5);
}
function trainHome() {
  const cats = [['all', '🎯', 'Alles gemischt'], ...TRACKS.filter((t) => t.id !== 'grund').map((t) => [t.id, t.icon, t.name])];
  const cnt = (t) => LESSONS.filter((l) => repOk(l) && (t === 'all' || l.track === t) && progress.rep[l.id] && repDue(l)).length;
  const el = h(`<div class="screen setup"><header><button class="back">←</button><h2>Training</h2><span></span></header><div class="pad">
    <p class="desc"><b>Aktiv wiederholen:</b> Du spielst die Züge aus dem Gedächtnis, der Gegner antwortet automatisch. Bei Fehlern gibt es Hinweise. Was du sicher kannst, kommt seltener wieder.</p>
    ${cats.map(([k, ic, n]) => { const d = cnt(k); return `<button class="lrow" data-r="${k}"><span class="ck">${ic}</span><span class="lt">${n}<br><small>5 Partien · Angriffe, Verteidigung, Fallen, Eröffnungen</small></span><small>${d ? d + ' fällig' : ''}</small><span class="ar">›</span></button>`; }).join('')}
    <p class="desc" style="margin-top:14px"><b>Taktik-Aufgaben</b></p>
    ${Object.keys(KINDS).map((k) => `<button class="lrow" data-k="${k}"><span class="ck">${k === 'm1' ? '♚' : k === 'm2' ? '♛' : '⚔'}</span><span class="lt">${KINDS[k][0]}<br><small>${KINDS[k][1]}</small></span><small>${progress.puz[k] || 0} gelöst</small><span class="ar">›</span></button>`).join('')}</div></div>`);
  el.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; if (b.classList.contains('back')) return home(); if (b.dataset.r) { const q = repQueue(b.dataset.r); if (q.length) repeatScreen(q, 0, b.dataset.r); else toast('Hier gibt es noch nichts.'); } if (b.dataset.k) puzzleScreen(b.dataset.k); };
  show(el);
}
function repeatScreen(queue, qi, cat, flipSide) {
  const l = queue[qi], startFen = l.fen || START, chess = new Chess(startFen);
  const first = chess.turn();
  let side = first; if (l.ask && l.ask.length) side = l.ask[0] % 2 ? (first === 'w' ? 'b' : 'w') : first;
  if (flipSide) side = side === 'w' ? 'b' : 'w';
  let idx = 0, busy = false, alive = true, miss = 0, totalMiss = 0, finished = false;
  const el = h(`<div class="screen lesson"><header><button class="back">←</button><h2>${esc(l.title)}</h2><span class="rc">${qi + 1}/${queue.length}</span></header>
    <div class="lcol"><div class="lbd">${mkBoardHtml()}</div><div class="lpanel">
    <div class="chip">${esc(TRACKS.find((t) => t.id === l.track).name)} · du spielst ${side === 'w' ? 'Weiß' : 'Schwarz'}</div>
    <div class="card idea"><div class="tl">Aufgabe</div><p></p></div>
    <div class="askbox"><div class="prog"></div><div class="fb"></div></div>
    <div class="ctrls lc"><button data-a="hint">💡<small>Tipp</small></button><button data-a="show">👁<small>Zeigen</small></button><button data-a="side">🔄<small>Seite</small></button><button data-a="skip">⏭<small>Weiter</small></button></div>
    <div class="done" style="display:none"></div></div></div></div>`);
  $('.idea p', el).textContent = `${l.title}: Spiele diese Variante aus dem Gedächtnis nach. ${l.intro.split('. ')[0]}.`;
  const wrap = $('.bwrap', el);
  const expected = () => { const m = new Chess(chess.fen()).move(l.moves[idx]); const alts = ((l.alt && l.alt[idx]) || []).map((x) => { try { return new Chess(chess.fen()).move(x); } catch (e) { return null; } }).filter(Boolean); return [m, ...alts]; };
  const mine = () => idx < l.moves.length && chess.turn() === side;
  const board = mkBoard($('.bd', el), {
    dots: settings.dots,
    movesFrom: (sq) => { if (busy || finished || !mine()) return null; const p = chess.get(sq); if (!p || p.color !== side) return null; return [...new Set(chess.moves({ square: sq, verbose: true }).map((m) => m.to))]; },
    onMove: (f, t) => tryMove(f, t),
  });
  const fbSet = (t, bad) => { const fb = $('.fb', el); fb.textContent = t; fb.className = 'fb' + (bad ? ' bad' : ''); };
  function draw(hint = []) {
    board.setOrientation(side); board.draw(chess, { last: lastOf(chess), check: chess.inCheck() ? kingSq(chess) : null, hint });
    $('.prog', el).textContent = `Zug ${Math.floor(idx / 2) + 1} von ${Math.ceil(l.moves.length / 2)} · Fehler: ${totalMiss}`;
  }
  async function play(m) { busy = true; await animate(wrap, chess, m, side); chess.move({ from: m.from, to: m.to, promotion: m.promotion }); idx++; if (settings.sound) tick(m.captured ? 'cap' : 'move'); busy = false; draw(); }
  async function opp() {
    while (alive && !finished && idx < l.moves.length && chess.turn() !== side) { await sleep(350); if (!alive) return; const m = chess.moves({ verbose: true }).find((x) => x.san === l.moves[idx]); if (!m) break; await play(m); }
    if (alive && idx >= l.moves.length) return finish();
    if (alive) fbSet('Du bist dran. Welcher Zug folgt?');
  }
  function finish() {
    if (finished) return; finished = true;
    const stars = totalMiss === 0 ? 3 : totalMiss <= 2 ? 2 : 1, r = progress.rep[l.id] || { box: 0, best: 0, n: 0 };
    r.n++; r.best = Math.max(r.best || 0, stars);
    r.box = stars === 3 ? Math.min(BOX_DAYS.length - 1, (r.box || 0) + 1) : stars === 2 ? (r.box || 0) : 0;
    r.due = Date.now() + BOX_DAYS[r.box] * DAY; progress.rep[l.id] = r; saveProgress();
    const done = $('.done', el); done.style.display = '';
    const last = qi + 1 >= queue.length;
    done.innerHTML = `<b>${'★'.repeat(stars)}${'☆'.repeat(3 - stars)} ${stars === 3 ? 'Fehlerfrei!' : stars === 2 ? 'Gut gemacht' : 'Geschafft, das üben wir nochmal'}</b><div class="dbtns">${last ? '' : '<button class="btn pri" data-a="next">Nächste Partie</button>'}<button class="btn ${last ? 'pri' : ''}" data-a="again">Nochmal (andere Seite)</button><button class="btn" data-a="list">Zum Training</button></div>`;
    $('.askbox', el).style.display = 'none'; tick('end'); draw();
  }
  async function tryMove(from, to) {
    if (busy || finished) return;
    const ms = chess.moves({ square: from, verbose: true }).filter((m) => m.to === to); if (!ms.length) return;
    let mv = ms[0]; if (ms.length > 1) { const t = await askPromo(wrap, chess.turn()); mv = ms.find((m) => m.promotion === t) || ms[0]; }
    if (expected().some((e) => sameMove(e, mv))) { miss = 0; fbSet('Richtig! ✓'); await play(mv); return opp(); }
    miss++; totalMiss++; const key = mv.san.replace(/[+#]/g, '');
    draw(miss >= 2 ? [expected()[0].from] : []);
    fbSet((l.wrong && l.wrong[key]) || (miss === 1 ? ((l.hint && l.hint[idx]) || 'Nicht dieser Zug. Überlege, was die Idee der Variante ist.') : miss === 2 ? 'Die markierte Figur musst du ziehen.' : 'Ich zeige dir den Zug.'), true);
    if (miss >= 3) { miss = 0; await sleep(600); await play(expected()[0]); opp(); }
  }
  el.onclick = async (e) => {
    const b = e.target.closest('button'); if (!b) return; const a = b.dataset.a;
    if (b.classList.contains('back') || a === 'list') return trainHome();
    if (a === 'next') return repeatScreen(queue, qi + 1, cat);
    if (a === 'again') return repeatScreen(queue, qi, cat, true);
    if (a === 'skip') return qi + 1 < queue.length ? repeatScreen(queue, qi + 1, cat) : trainHome();
    if (a === 'side') return repeatScreen(queue, qi, cat, true);
    if (busy || finished || !mine()) return;
    if (a === 'hint') { totalMiss++; draw([expected()[0].from]); fbSet((l.hint && l.hint[idx]) || 'Die markierte Figur musst du ziehen.'); }
    else if (a === 'show') { totalMiss += 2; await play(expected()[0]); opp(); }
  };
  show(el, { resize: () => fitBoard(380), cleanup: () => { alive = false; } });
  draw(); opp();
}
const seen = {};
function puzzleScreen(kind) {
  const pool = PUZ[kind]; seen[kind] = seen[kind] || [];
  if (seen[kind].length >= pool.length) seen[kind] = [];
  let p; do { p = pool[Math.floor(Math.random() * pool.length)]; } while (seen[kind].includes(p) && seen[kind].length < pool.length); seen[kind].push(p);
  const chess = new Chess(p.fen), side = chess.turn(); let busy = false, step = 0, solvedP = false;
  const el = h(`<div class="screen lesson"><header><button class="back">←</button><h2>${KINDS[kind][0]}</h2><span></span></header><div class="lcol"><div class="lbd">${mkBoardHtml()}</div><div class="lpanel">
    <div class="card idea"><div class="tl">${side === 'w' ? 'Weiß' : 'Schwarz'} am Zug</div><p>${KINDS[kind][1]}</p></div><div class="askbox"><div class="fb"></div></div>
    <div class="ctrls lc"><button data-a="hint">💡<small>Tipp</small></button><button data-a="sol">👁<small>Lösung</small></button><button data-a="next">⏭<small>Nächste</small></button></div></div></div></div>`);
  const wrap = $('.bwrap', el), fb = $('.fb', el);
  const board = mkBoard($('.bd', el), {
    dots: settings.dots,
    movesFrom: (sq) => { if (busy || solvedP) return null; const q = chess.get(sq); if (!q || q.color !== chess.turn() || q.color !== side) return null; return [...new Set(chess.moves({ square: sq, verbose: true }).map((m) => m.to))]; },
    onMove: async (f, t) => {
      const ms = chess.moves({ square: f, verbose: true }).filter((m) => m.to === t); if (!ms.length) return;
      let mv = ms[0]; if (ms.length > 1) { const pt = await askPromo(wrap, chess.turn()); mv = ms.find((m) => m.promotion === pt) || ms[0]; }
      const test = new Chess(chess.fen()); test.move({ from: mv.from, to: mv.to, promotion: mv.promotion });
      let ok = false, finished = false;
      if (test.isCheckmate()) { ok = true; finished = true; }
      else if (kind === 'm2' && step === 0) { ok = !test.isGameOver() && test.moves({ verbose: true }).every((r) => { test.move(r); const v = mateIn(test, 1); test.undo(); return v; }); }
      else if (kind === 'win') { const sol = new Chess(p.fen).move(p.sol); ok = sameMove(sol, mv); finished = ok; }
      if (!ok) { fb.className = 'fb bad'; fb.textContent = kind === 'm1' ? 'Das ist kein Matt. Prüfe alle Schachgebote.' : 'Das führt nicht zum Ziel. Versuch es noch einmal.'; return; }
      busy = true; await animate(wrap, chess, mv, side); chess.move({ from: mv.from, to: mv.to, promotion: mv.promotion }); step++;
      if (finished) { solvedP = true; progress.puz[kind] = (progress.puz[kind] || 0) + 1; saveProgress(); tick('end'); fb.className = 'fb good'; fb.textContent = chess.isCheckmate() ? 'Richtig – Schachmatt! ✓' : 'Richtig! ✓ Starker Zug.'; busy = false; board.draw(chess, { last: lastOf(chess) }); return; }
      board.draw(chess, { last: lastOf(chess) });
      fb.className = 'fb good'; fb.textContent = 'Gut! Der Gegner antwortet …';
      const r = await engine.go({ fen: chess.fen(), level: 4 }); const rm = r.uci && chess.moves({ verbose: true }).find((m) => m.from === r.uci.slice(0, 2) && m.to === r.uci.slice(2, 4));
      if (rm) { await animate(wrap, chess, rm, side); chess.move(rm.san); }
      board.draw(chess, { last: lastOf(chess) }); fb.textContent = 'Jetzt setze Matt!'; busy = false;
    },
  });
  el.onclick = async (e) => {
    const b = e.target.closest('button'); if (!b) return; if (b.classList.contains('back')) return trainHome();
    const a = b.dataset.a;
    if (a === 'next') puzzleScreen(kind);
    else if (a === 'hint') { const c = new Chess(chess.fen()); let m = null; if (step === 0 && kind !== 'm1') m = c.move(p.sol); else { m = c.moves({ verbose: true }).find((x) => { c.move(x); const k = c.isCheckmate(); c.undo(); return k; }); } if (m) { board.draw(chess, { last: lastOf(chess), hint: [m.from] }); fb.className = 'fb'; fb.textContent = 'Diese Figur musst du ziehen.'; } }
    else if (a === 'sol') { if (busy || solvedP) return; const c = new Chess(chess.fen()); let m = step === 0 ? c.move(p.sol) : c.moves({ verbose: true }).find((x) => { c.move(x); const k = c.isCheckmate(); c.undo(); return k; }); if (m) { busy = true; await animate(wrap, chess, m, side); chess.move({ from: m.from, to: m.to, promotion: m.promotion }); board.draw(chess, { last: lastOf(chess) }); fb.className = 'fb'; fb.textContent = 'Lösung: ' + deSan(m.san); busy = false; if (kind !== 'win' && step === 0 && !chess.isCheckmate()) fb.textContent += ' – danach geht es mit Matt weiter.'; solvedP = true; } }
  };
  show(el, { resize: () => fitBoard(380) });
  board.setOrientation(side); board.draw(chess, {});
}

/* ───── Einstellungen ───── */
function settingsScreen() {
  const el = h(`<div class="screen setup"><header><button class="back">←</button><h2>Einstellungen</h2><span></span></header><div class="pad">
    <div class="opt"><small>Tippe während einer Zugbewegung auf das Brett, um sie zu überspringen.</small></div>
    <div class="opt"><label>Tempo der Animation</label><div class="seg" data-k="speed"><button data-v="1">Normal</button><button data-v="1.6">Schnell</button><button data-v="2.4">Sehr schnell</button></div></div>
    <div class="opt tg" data-k="sound"><label>Klicktöne</label><button class="sw"></button></div>
    <div class="opt tg" data-k="dots"><label>Mögliche Züge anzeigen</label><button class="sw"></button></div>
    <div class=”opt tg” data-k=”coach”><label>🎓 Lehrer-Kommentare in Partien</label><button class=”sw”></button></div>
    <div class=”opt tg” data-k=”flip2p”><label>Brett im 2-Spieler-Modus drehen</label><button class=”sw”></button></div>
    <div class=”opt”><label>Auf dem Home-Bildschirm</label><small>iPhone/iPad: In Safari auf „Teilen” tippen, dann „Zum Home-Bildschirm”. Dann startet die App im Vollbild.</small></div>
    <button class=”btn wide” data-a=”reset”>Lernfortschritt zurücksetzen</button>
    <button class=”btn wide” data-a=”reload” style=”margin-top:16px;”>🔄 App neu laden</button></div></div>`);
  const sync = () => {
    $$('[data-k=speed] button', el).forEach((b) => b.classList.toggle('on', +b.dataset.v === settings.speed));
    $$('.tg', el).forEach((t) => $('.sw', t).classList.toggle('on', !!settings[t.dataset.k]));
  };
  el.onclick = async (e) => {
    const b = e.target.closest('button'); if (!b) return; if (b.classList.contains('back')) return home();
    const p = b.parentElement;
    if (p.dataset.k === 'speed') settings.speed = +b.dataset.v;
    else if (b.classList.contains('sw')) { const k = p.dataset.k; settings[k] = !settings[k]; }
    else if (b.dataset.a === 'reset') { if (await modal('<h3>Fortschritt löschen?</h3><p>Alle abgeschlossenen Lektionen und gelösten Aufgaben werden zurückgesetzt.</p>', [['Abbrechen', 0], ['Löschen', 1, 'pri']])) { progress.done = {}; progress.puz = { m1: 0, m2: 0, win: 0 }; saveProgress(); toast('Zurückgesetzt'); } return; }
    else if (b.dataset.a === 'reload') { window.location.reload(); return; }
    saveSettings(); sync();
  };
  show(el); sync();
}

window.__app = { LESSONS, repeatScreen, repQueue, sqXY: (q) => window.__board && window.__board.sqXY(q), analysisScreen, home, gameScreen, lessonScreen, learnHome, trainHome, puzzleScreen, settings };
mpUser() ? setupMultiplayer() : home();
