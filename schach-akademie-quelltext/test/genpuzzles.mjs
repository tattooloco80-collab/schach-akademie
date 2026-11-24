import { Chess } from 'chess.js';
import { chooseMove, Pos, moveUci } from '../src/engine.js';
import fs from 'fs';
function mateIn(c, n) { // Seite am Zug kann in n Zügen erzwingen
  for (const m of c.moves({ verbose: true })) {
    c.move(m); let ok;
    if (c.isCheckmate()) ok = true;
    else if (n > 1 && !c.isGameOver()) { ok = true; for (const r of c.moves({ verbose: true })) { c.move(r); if (!mateIn(c, n - 1)) ok = false; c.undo(); if (!ok) break; } }
    else ok = false;
    c.undo(); if (ok) return m.san;
  }
  return null;
}
const out = { m1: [], m2: [], win: [] }; const seen = new Set();
const t0 = Date.now();
let g = 0;
while (Date.now() - t0 < 200000 && (out.m1.length < 24 || out.m2.length < 22 || out.win.length < 18)) {
  g++; const c = new Chess(); const uci = [];
  for (let ply = 0; ply < 90 && !c.isGameOver(); ply++) {
    const lv = ply < 8 ? 0 : 3;
    const r = chooseMove({ fen: undefined, moves: uci, level: lv });
    if (!r.uci) break;
    const mv = c.move({ from: r.uci.slice(0, 2), to: r.uci.slice(2, 4), promotion: r.uci[4] }); uci.push(r.uci);
    if (ply < 14 || c.isGameOver()) continue;
    const fen = c.fen(); const key = fen.split(' ')[0];
    if (seen.has(key)) continue;
    const pieces = (fen.split(' ')[0].match(/[a-zA-Z]/g) || []).length;
    // Matt in 1
    if (out.m1.length < 24) {
      const ms = c.moves({ verbose: true }).filter((m) => { c.move(m); const k = c.isCheckmate(); c.undo(); return k; });
      if (ms.length === 1 && pieces >= 8) { seen.add(key); out.m1.push({ fen, sol: ms[0].san, kind: 'm1' }); continue; }
    }
    if (out.m2.length < 22 && pieces >= 8 && !c.inCheck()) {
      const r2 = chooseMove({ fen, level: 7, timeMs: 60 });
      if (r2.score >= 29997 && r2.score < 29999) { const s = mateIn(c, 2); if (s && !mateIn(c, 1)) { seen.add(key); out.m2.push({ fen, sol: s, kind: 'm2' }); continue; } }
    }
    if (out.win.length < 18 && pieces >= 10 && !c.inCheck()) {
      const pos = new Pos(); pos.fromFEN(fen); const scores = [];
      const legal = pos.legalMoves(); if (legal.length < 8) continue;
      const base = chooseMove({ fen, level: 7, timeMs: 120 }); const best = base.uci;
      // zweitbester Zug: Engine mit verbotenem besten Zug -> vereinfachte Prüfung: Materialgewinn nach Tiefe
      const cc = new Chess(fen); const before = mat(cc);
      const mm = cc.move({ from: best.slice(0, 2), to: best.slice(2, 4), promotion: best[4] });
      const rep = chooseMove({ fen: cc.fen(), level: 6, timeMs: 150 }); 
      if (rep.uci) { cc.move({ from: rep.uci.slice(0, 2), to: rep.uci.slice(2, 4), promotion: rep.uci[4] }); }
      const gain = (c.turn() === 'w' ? 1 : -1) * (mat(cc) - before);
      if (base.score > 250 && gain >= 2 && !mm.captured) { seen.add(key); out.win.push({ fen, sol: mm.san, kind: 'win' }); }
    }
  }
}
function mat(c) { const v = { p: 1, n: 3, b: 3, r: 5, q: 9 }; let s = 0; for (const row of c.board()) for (const p of row) if (p && p.type !== 'k') s += (p.color === 'w' ? 1 : -1) * v[p.type]; return s; }
fs.writeFileSync('src/puzzles.json', JSON.stringify(out));
console.log('Spiele', g, 'm1', out.m1.length, 'm2', out.m2.length, 'win', out.win.length, Date.now() - t0 + 'ms');
