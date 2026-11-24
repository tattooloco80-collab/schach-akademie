export const store = {
  get(k, d) { try { const v = localStorage.getItem('sa_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('sa_' + k, JSON.stringify(v)); } catch (e) { /* ohne Speicher weiterlaufen */ } },
  del(k) { try { localStorage.removeItem('sa_' + k); } catch (e) { /* egal */ } },
};
const GL = { K: 'K', Q: 'D', R: 'T', B: 'L', N: 'S' };
export const deSan = (s) => s.replace(/[KQRBN]/g, (c) => GL[c]);
export const PNAME = { p: 'Bauer', n: 'Springer', b: 'Läufer', r: 'Turm', q: 'Dame', k: 'König' };
export const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const sqSpoken = (s) => s[0] + ' ' + s[1];
export function moveSpoken(mv) {
  let t;
  if (mv.flags.includes('k')) t = 'kurze Rochade';
  else if (mv.flags.includes('q')) t = 'lange Rochade';
  else t = PNAME[mv.piece] + (mv.captured ? ' schlägt auf ' : ' nach ') + sqSpoken(mv.to) + (mv.flags.includes('e') ? ' en passant' : '');
  if (mv.promotion) t += ' und wird zur ' + PNAME[mv.promotion];
  if (mv.san.endsWith('#')) t += ', Schachmatt'; else if (mv.san.endsWith('+')) t += ', Schach';
  return t;
}
// Sprachausgabe (eingebaute Browser-Stimme, Deutsch)
let voice = null, token = 0, noVoice = !!store.get('noVoice', false);
const score = (v) => { const n = v.name; let sc = 0;
  if (/premium/i.test(n)) sc += 100; if (/enhanced|erweitert|verbessert/i.test(n)) sc += 70; if (/neural|natural|online/i.test(n)) sc += 60;
  if (/siri/i.test(n)) sc += 50; if (/anna|petra|markus|yannick|helena|viktor|katja|conrad|amala/i.test(n)) sc += 20;
  if (/compact|eloquence/i.test(n)) sc -= 30; if (/^de[-_]de/i.test(v.lang)) sc += 5; return sc; };
export function germanVoices() { try { return speechSynthesis.getVoices().filter((v) => v.lang && v.lang.toLowerCase().startsWith('de')).sort((a, b) => score(b) - score(a)); } catch (e) { return []; } }
export function pickVoice() {
  const vs = germanVoices(), want = store.get('voiceName', '');
  voice = noVoice ? null : ((want && vs.find((v) => v.name === want)) || vs[0] || null);
}
export const speechOk = () => 'speechSynthesis' in window;
if (speechOk()) { pickVoice(); try { speechSynthesis.onvoiceschanged = pickVoice; } catch (e) { /* ok */ } }
// iOS erlaubt Sprache nur, wenn sie einmal durch eine Berührung freigeschaltet wurde (und nicht nach langer Animation)
let unlocked = false;
export function unlockSpeech() {
  if (unlocked || !speechOk()) return; unlocked = true;
  try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; u.lang = 'de-DE'; speechSynthesis.speak(u); } catch (e) { /* ok */ }
}
for (const ev of ['touchstart', 'touchend', 'pointerdown', 'click', 'keydown']) { try { document.addEventListener(ev, unlockSpeech, { capture: true, passive: true }); } catch (e) { /* ok */ } }
// Wachhalten: iOS pausiert die Sprachausgabe gern von selbst
setInterval(() => { try { if (speechSynthesis.paused) speechSynthesis.resume(); } catch (e) { /* ok */ } }, 1500);
export function stopSpeak() { token++; try { speechSynthesis.cancel(); } catch (e) { /* ok */ } }
// Text in kurze Sätze teilen: natürlichere Betonung und Pausen
function chunks(t) { return t.replace(/\s+/g, ' ').replace(/\bz\. B\./g, 'zum Beispiel').match(/[^.!?;:–]+[.!?;:–]?/g)?.map((x) => x.trim()).filter(Boolean) || [t]; }
function say(txt, rate, my) {
  return new Promise((res) => {
    try {
      const u = new SpeechSynthesisUtterance(txt); u.lang = 'de-DE'; if (voice) u.voice = voice;
      u.rate = rate; u.pitch = /\?$/.test(txt) ? 1.05 : 1;
      let d = false; const fin = (v) => { if (!d) { d = true; res(v); } }; u.onend = () => fin(true); u.onerror = () => fin(false); setTimeout(() => fin(false), 4000 + txt.length * 110); try { speechSynthesis.resume(); } catch (e) { /* ok */ } speechSynthesis.speak(u);
    } catch (e) { res(false); }
  });
}
export async function speak(text, rate = 0.92) {
  if (!speechOk() || !text) return true;
  const my = ++token; try { speechSynthesis.cancel(); } catch (e) { /* ok */ }
  await new Promise((r) => setTimeout(r, 80));   // iOS verschluckt sonst die erste Äußerung nach cancel()
  for (const c of chunks(text)) { if (my !== token) return false; const ok = await say(c, rate, my); if (!ok && my === token) return false; if (my === token) await new Promise((r) => setTimeout(r, 140)); }
  return my === token;
}
// kleiner Klick-Ton
let ac = null;
export function tick(kind = 'move') {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain(); o.connect(g); g.connect(ac.destination);
    o.frequency.value = kind === 'cap' ? 180 : kind === 'end' ? 520 : 300; o.type = 'triangle';
    g.gain.setValueAtTime(0.15, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + (kind === 'end' ? 0.35 : 0.09));
    o.start(); o.stop(ac.currentTime + 0.4);
  } catch (e) { /* kein Ton */ }
}
// Spracherkennung (nur wenn der Browser sie in dieser Umgebung zulässt)
export function listenOnce(onText, onErr) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { onErr('unsupported'); return () => {}; }
  let r; try { r = new SR(); } catch (e) { onErr('unsupported'); return () => {}; }
  r.lang = 'de-DE'; r.interimResults = false; r.maxAlternatives = 3; r.continuous = false;
  r.onresult = (e) => { const alts = []; for (const a of e.results[0]) alts.push(a.transcript); onText(alts); };
  r.onerror = (e) => onErr(e.error || 'error');
  try { r.start(); } catch (e) { onErr('error'); }
  return () => { try { r.stop(); } catch (e) { /* ok */ } };
}
const NUM = { eins: '1', ein: '1', zwei: '2', drei: '3', vier: '4', fünf: '5', fuenf: '5', sechs: '6', sieben: '7', acht: '8' };
const LET = { be: 'b', bee: 'b', ce: 'c', cee: 'c', de: 'd', dee: 'd', ef: 'f', eff: 'f', ge: 'g', gee: 'g', ha: 'h', hah: 'h', ah: 'a', eh: 'e' };
export function parseVoiceMove(text, chess) {
  let t = ' ' + text.toLowerCase().replace(/[.,!?]/g, ' ') + ' ';
  if (/rochade/.test(t) || /o-o/.test(t)) {
    const long = /lang|gross|groß|o-o-o|damenseite/.test(t);
    return chess.moves({ verbose: true }).find((m) => m.flags.includes(long ? 'q' : 'k')) || null;
  }
  t = t.split(/\s+/).map((w) => NUM[w] || LET[w] || w).join(' ');
  t = t.replace(/([a-h])\s+([1-8])/g, '$1$2');
  const sq = t.match(/[a-h][1-8]/g) || [];
  const legal = chess.moves({ verbose: true });
  if (sq.length >= 2) return legal.find((m) => m.from === sq[0] && m.to === sq[1]) || null;
  if (sq.length === 1) {
    const p = /springer/.test(t) ? 'n' : /läufer|laeufer/.test(t) ? 'b' : /turm/.test(t) ? 'r' : /dame/.test(t) ? 'q' : /könig|koenig/.test(t) ? 'k' : 'p';
    const c = legal.filter((m) => m.to === sq[0] && m.piece === p);
    return c.length === 1 ? c[0] : null;
  }
  return null;
}
// Tutor: fragt Claude (Fähigkeit "sample") – nur in der veröffentlichten Seite verfügbar
let samplePromise = null;
export function getSample() {
  if (samplePromise) return samplePromise;
  samplePromise = (async () => { try { return window.claude && window.claude.use ? await window.claude.use('sample') : null; } catch (e) { return null; } })();
  return samplePromise;
}
let dictPromise = null;
export function getDictation() {
  if (dictPromise) return dictPromise;
  dictPromise = (async () => { try { return window.claude && window.claude.use ? await window.claude.use('dictation') : null; } catch (e) { return null; } })();
  return dictPromise;
}

// Diagnose: startet die Sprachausgabe wirklich? Erst mit gewählter Stimme, dann mit Systemstandard.
function probeOnce(text, useV) {
  return new Promise((res) => {
    try {
      speechSynthesis.cancel(); try { speechSynthesis.resume(); } catch (e) { /* ok */ }
      const u = new SpeechSynthesisUtterance(text); u.lang = 'de-DE'; if (useV && voice) u.voice = voice; u.rate = 0.92;
      let d = false; const fin = (v) => { if (!d) { d = true; clearInterval(iv); res(v); } };
      u.onstart = () => fin(true); u.onerror = () => fin(false); u.onend = () => fin(true);
      const iv = setInterval(() => { try { if (speechSynthesis.speaking && !speechSynthesis.paused) fin(true); } catch (e) { /* ok */ } }, 250);
      setTimeout(() => fin(false), 3500); setTimeout(() => { try { speechSynthesis.speak(u); } catch (e) { fin(false); } }, 120);
    } catch (e) { res(false); }
  });
}
export async function speakProbe(text) {
  if (!speechOk()) return false;
  const vs = germanVoices().slice(0, 4), want = store.get('voiceName', '');
  const order = want ? [vs.find((v) => v.name === want), ...vs.filter((v) => v.name !== want)].filter(Boolean) : vs;
  for (const v of order) {
    noVoice = false; voice = v;
    if (await probeOnce(text, true)) { store.set('noVoice', false); store.set('voiceName', v.name); return true; }
    try { speechSynthesis.cancel(); } catch (e) { /* ok */ }
  }
  if (await probeOnce(text, false)) { voice = null; noVoice = true; store.set('noVoice', true); return true; }
  return false;
}
export const voiceCount = () => germanVoices().length;

// Debug-Logging für iPhone
let debugLogs = [];
export function addDebugLog(msg) {
  const time = new Date().toLocaleTimeString();
  debugLogs.push(`[${time}] ${msg}`);
  if (debugLogs.length > 50) debugLogs.shift(); // Max 50 Logs
  console.log(msg);
}
export function getDebugLogs() {
  return debugLogs;
}
