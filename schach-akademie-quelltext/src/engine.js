// Kompakte Schach-Engine (0x88). Regeln: Rochade, en passant, Umwandlung, 50-Züge, Wiederholung.
const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
const CAP = 1 << 17, EPF = 1 << 18, CASF = 1 << 19, DPP = 1 << 20;
const MATE = 30000, INF = 32000;
const VAL = [0, 100, 320, 330, 500, 900, 0];
const KN = [33, 31, 18, 14, -33, -31, -18, -14];
const BD = [17, 15, -17, -15];
const RD = [16, -16, 1, -1];
const KD = [17, 15, -17, -15, 16, -16, 1, -1];

const CM = new Uint8Array(128).fill(15);
CM[0] = 13; CM[7] = 14; CM[4] = 12; CM[112] = 7; CM[119] = 11; CM[116] = 3;

// Zobrist
let seed = 0x9e3779b9;
function rnd() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed | 0; }
const Z1 = [], Z2 = [];
for (let i = 0; i < 13; i++) { Z1.push(new Int32Array(128).map(rnd)); Z2.push(new Int32Array(128).map(rnd)); }
const ZC1 = new Int32Array(16).map(rnd), ZC2 = new Int32Array(16).map(rnd);
const ZE1 = new Int32Array(8).map(rnd), ZE2 = new Int32Array(8).map(rnd);
const ZS1 = rnd(), ZS2 = rnd();
const pidx = (p) => (p > 0 ? p : 6 - p);

// Figur-Feld-Tabellen (aus Sicht Weiß, oben = 8. Reihe)
const PST = [null,
  [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
  [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
  [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
  [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
  [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
  [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
];
const KEG = [-50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30, -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50];

// Transposition table
const TTBITS = 19, TTSIZE = 1 << TTBITS, TTMASK = TTSIZE - 1;
const TTK1 = new Int32Array(TTSIZE), TTK2 = new Int32Array(TTSIZE), TTS = new Int32Array(TTSIZE),
  TTM = new Int32Array(TTSIZE), TTD = new Int8Array(TTSIZE), TTF = new Int8Array(TTSIZE);

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const sqName = (s) => 'abcdefgh'[s & 7] + ((s >> 4) + 1);
const sqFrom = (n) => (n.charCodeAt(0) - 97) + (n.charCodeAt(1) - 49) * 16;
export const moveUci = (m) => sqName(m & 127) + sqName((m >> 7) & 127) + ('  nbrq'[(m >> 14) & 7]).trim();

export class Pos {
  constructor() {
    this.b = new Int8Array(128); this.side = 1; this.castle = 0; this.ep = -1; this.half = 0;
    this.ksq = [4, 116]; this.h1 = 0; this.h2 = 0; this.ply = 0;
    this.stC = new Int8Array(1024); this.stCast = new Uint8Array(1024); this.stEp = new Int16Array(1024);
    this.stHalf = new Int16Array(1024); this.stH1 = new Int32Array(1024); this.stH2 = new Int32Array(1024);
    this.bufs = []; for (let i = 0; i < 130; i++) this.bufs.push(new Int32Array(256));
    this.killers = []; for (let i = 0; i < 130; i++) this.killers.push([0, 0]);
    this.hist = new Int32Array(2 * 16384);
    this.nodes = 0; this.stop = false; this.deadline = 0; this.noQ = false;
  }
  fromFEN(fen) {
    const [pp, stm, cas, ep, hm] = fen.trim().split(/\s+/);
    this.b.fill(0); let r = 7, f = 0;
    for (const ch of pp) {
      if (ch === '/') { r--; f = 0; continue; }
      if (ch >= '1' && ch <= '8') { f += +ch; continue; }
      const t = 'pnbrqk'.indexOf(ch.toLowerCase()) + 1; const col = ch === ch.toUpperCase() ? 1 : -1;
      const sq = r * 16 + f; this.b[sq] = t * col; if (t === K) this.ksq[col === 1 ? 0 : 1] = sq; f++;
    }
    this.side = stm === 'b' ? -1 : 1;
    this.castle = 0;
    if (cas && cas !== '-') for (const c of cas) this.castle |= { K: 1, Q: 2, k: 4, q: 8 }[c] || 0;
    this.ep = ep && ep !== '-' ? sqFrom(ep) : -1;
    this.half = +hm || 0; this.ply = 0; this.computeHash();
  }
  computeHash() {
    let a = 0, c = 0;
    for (let s = 0; s < 128; s++) { if (s & 0x88) { s += 7; continue; } const p = this.b[s]; if (p) { a ^= Z1[pidx(p)][s]; c ^= Z2[pidx(p)][s]; } }
    a ^= ZC1[this.castle]; c ^= ZC2[this.castle];
    if (this.ep >= 0) { a ^= ZE1[this.ep & 7]; c ^= ZE2[this.ep & 7]; }
    if (this.side === -1) { a ^= ZS1; c ^= ZS2; }
    this.h1 = a; this.h2 = c;
  }
  attacked(sq, by) {
    const b = this.b; let s;
    if (by === 1) { s = sq - 15; if (!(s & 0x88) && b[s] === P) return true; s = sq - 17; if (!(s & 0x88) && b[s] === P) return true; }
    else { s = sq + 15; if (!(s & 0x88) && b[s] === -P) return true; s = sq + 17; if (!(s & 0x88) && b[s] === -P) return true; }
    for (let i = 0; i < 8; i++) { s = sq + KN[i]; if (!(s & 0x88) && b[s] === by * N) return true; }
    for (let i = 0; i < 8; i++) { s = sq + KD[i]; if (!(s & 0x88) && b[s] === by * K) return true; }
    for (let i = 0; i < 4; i++) {
      const d = BD[i]; s = sq + d;
      while (!(s & 0x88)) { const p = b[s]; if (p) { if (p === by * B || p === by * Q) return true; break; } s += d; }
    }
    for (let i = 0; i < 4; i++) {
      const d = RD[i]; s = sq + d;
      while (!(s & 0x88)) { const p = b[s]; if (p) { if (p === by * R || p === by * Q) return true; break; } s += d; }
    }
    return false;
  }
  inCheck() { return this.attacked(this.ksq[this.side === 1 ? 0 : 1], -this.side); }
  gen(buf, caps) {
    let n = 0; const b = this.b, us = this.side;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = b[sq]; if (!p || (p > 0) !== (us > 0)) continue;
      const t = p * us;
      if (t === P) {
        const dir = us * 16, rank = sq >> 4, start = us === 1 ? 1 : 6, last = us === 1 ? 6 : 1;
        let to = sq + dir;
        if (b[to] === 0) {
          if (rank === last) {
            buf[n++] = sq | (to << 7) | (Q << 14);
            if (!caps) { buf[n++] = sq | (to << 7) | (R << 14); buf[n++] = sq | (to << 7) | (B << 14); buf[n++] = sq | (to << 7) | (N << 14); }
          } else if (!caps) {
            buf[n++] = sq | (to << 7);
            if (rank === start && b[to + dir] === 0) buf[n++] = sq | ((to + dir) << 7) | DPP;
          }
        }
        for (let k = -1; k <= 1; k += 2) {
          to = sq + dir + k; if (to & 0x88) continue;
          const c = b[to];
          if (c && (c > 0) !== (us > 0)) {
            if (rank === last) {
              buf[n++] = sq | (to << 7) | (Q << 14) | CAP;
              if (!caps) { buf[n++] = sq | (to << 7) | (R << 14) | CAP; buf[n++] = sq | (to << 7) | (B << 14) | CAP; buf[n++] = sq | (to << 7) | (N << 14) | CAP; }
            } else buf[n++] = sq | (to << 7) | CAP;
          } else if (to === this.ep) buf[n++] = sq | (to << 7) | CAP | EPF;
        }
      } else if (t === N || t === K) {
        const offs = t === N ? KN : KD;
        for (let i = 0; i < 8; i++) {
          const to = sq + offs[i]; if (to & 0x88) continue;
          const c = b[to];
          if (c === 0) { if (!caps) buf[n++] = sq | (to << 7); }
          else if ((c > 0) !== (us > 0)) buf[n++] = sq | (to << 7) | CAP;
        }
        if (t === K && !caps) {
          if (us === 1 && sq === 4) {
            if ((this.castle & 1) && !b[5] && !b[6] && b[7] === R && !this.attacked(4, -1) && !this.attacked(5, -1)) buf[n++] = 4 | (6 << 7) | CASF;
            if ((this.castle & 2) && !b[3] && !b[2] && !b[1] && b[0] === R && !this.attacked(4, -1) && !this.attacked(3, -1)) buf[n++] = 4 | (2 << 7) | CASF;
          } else if (us === -1 && sq === 116) {
            if ((this.castle & 4) && !b[117] && !b[118] && b[119] === -R && !this.attacked(116, 1) && !this.attacked(117, 1)) buf[n++] = 116 | (118 << 7) | CASF;
            if ((this.castle & 8) && !b[115] && !b[114] && !b[113] && b[112] === -R && !this.attacked(116, 1) && !this.attacked(115, 1)) buf[n++] = 116 | (114 << 7) | CASF;
          }
        }
      } else {
        const dirs = t === B ? BD : t === R ? RD : KD;
        for (let i = 0; i < dirs.length; i++) {
          const d = dirs[i]; let to = sq + d;
          while (!(to & 0x88)) {
            const c = b[to];
            if (c === 0) { if (!caps) buf[n++] = sq | (to << 7); }
            else { if ((c > 0) !== (us > 0)) buf[n++] = sq | (to << 7) | CAP; break; }
            to += d;
          }
        }
      }
    }
    return n;
  }
  make(m) {
    const b = this.b, from = m & 127, to = (m >> 7) & 127, promo = (m >> 14) & 7, us = this.side;
    const p = b[from], cap = b[to], i = this.ply;
    this.stC[i] = cap; this.stCast[i] = this.castle; this.stEp[i] = this.ep; this.stHalf[i] = this.half;
    this.stH1[i] = this.h1; this.stH2[i] = this.h2;
    let h1 = this.h1, h2 = this.h2;
    if (this.ep >= 0) { h1 ^= ZE1[this.ep & 7]; h2 ^= ZE2[this.ep & 7]; }
    h1 ^= ZC1[this.castle]; h2 ^= ZC2[this.castle];
    const pi = pidx(p); h1 ^= Z1[pi][from]; h2 ^= Z2[pi][from]; b[from] = 0;
    if (cap) { const ci = pidx(cap); h1 ^= Z1[ci][to]; h2 ^= Z2[ci][to]; }
    const placed = promo ? us * promo : p; const pl = pidx(placed);
    h1 ^= Z1[pl][to]; h2 ^= Z2[pl][to]; b[to] = placed;
    if (m & EPF) {
      const cs = to - us * 16, ci = pidx(-us * P);
      h1 ^= Z1[ci][cs]; h2 ^= Z2[ci][cs]; b[cs] = 0;
    }
    if (m & CASF) {
      let rf, rt; if (to > from) { rf = to + 1; rt = to - 1; } else { rf = to - 2; rt = to + 1; }
      const rk = b[rf], ri = pidx(rk);
      h1 ^= Z1[ri][rf] ^ Z1[ri][rt]; h2 ^= Z2[ri][rf] ^ Z2[ri][rt]; b[rt] = rk; b[rf] = 0;
    }
    if (p === K * us) this.ksq[us === 1 ? 0 : 1] = to;
    this.castle &= CM[from] & CM[to];
    this.ep = (m & DPP) ? (from + to) >> 1 : -1;
    this.half = (p * us === P || cap || (m & EPF)) ? 0 : this.half + 1;
    this.side = -us; h1 ^= ZS1; h2 ^= ZS2;
    h1 ^= ZC1[this.castle]; h2 ^= ZC2[this.castle];
    if (this.ep >= 0) { h1 ^= ZE1[this.ep & 7]; h2 ^= ZE2[this.ep & 7]; }
    this.h1 = h1; this.h2 = h2; this.ply++;
    if (this.attacked(this.ksq[us === 1 ? 0 : 1], -us)) { this.unmake(m); return false; }
    return true;
  }
  unmake(m) {
    this.ply--; const i = this.ply; this.side = -this.side; const us = this.side;
    const b = this.b, from = m & 127, to = (m >> 7) & 127, promo = (m >> 14) & 7;
    let p = b[to]; if (promo) p = us * P;
    b[from] = p; b[to] = this.stC[i];
    if (m & EPF) { b[to] = 0; b[to - us * 16] = -us * P; }
    if (m & CASF) {
      let rf, rt; if (to > from) { rf = to + 1; rt = to - 1; } else { rf = to - 2; rt = to + 1; }
      b[rf] = b[rt]; b[rt] = 0;
    }
    if (p === K * us) this.ksq[us === 1 ? 0 : 1] = from;
    this.castle = this.stCast[i]; this.ep = this.stEp[i]; this.half = this.stHalf[i];
    this.h1 = this.stH1[i]; this.h2 = this.stH2[i];
  }
  makeNull() {
    const i = this.ply;
    this.stCast[i] = this.castle; this.stEp[i] = this.ep; this.stHalf[i] = this.half; this.stH1[i] = this.h1; this.stH2[i] = this.h2;
    if (this.ep >= 0) { this.h1 ^= ZE1[this.ep & 7]; this.h2 ^= ZE2[this.ep & 7]; }
    this.ep = -1; this.side = -this.side; this.h1 ^= ZS1; this.h2 ^= ZS2; this.half++; this.ply++;
  }
  unmakeNull() {
    this.ply--; const i = this.ply; this.side = -this.side;
    this.castle = this.stCast[i]; this.ep = this.stEp[i]; this.half = this.stHalf[i]; this.h1 = this.stH1[i]; this.h2 = this.stH2[i];
  }
  isRep() {
    for (let i = this.ply - 2, lim = this.ply - this.half; i >= lim && i >= 0; i -= 2)
      if (this.stH1[i] === this.h1 && this.stH2[i] === this.h2) return true;
    return false;
  }
  evaluate() {
    const b = this.b; let np = 0;
    for (let s = 0; s < 128; s++) { if (s & 0x88) { s += 7; continue; } const p = b[s]; if (p) { const t = p < 0 ? -p : p; if (t > 1 && t < 6) np += VAL[t]; } }
    const eg = np <= 2400; let sc = 0, wb = 0, bb = 0;
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = b[s]; if (!p) continue;
      const r = s >> 4, f = s & 7;
      if (p > 0) {
        const tb = (p === K && eg) ? KEG : PST[p];
        sc += VAL[p] + tb[(7 - r) * 8 + f]; if (p === B) wb++;
      } else {
        const t = -p, tb = (t === K && eg) ? KEG : PST[t];
        sc -= VAL[t] + tb[r * 8 + f]; if (t === B) bb++;
      }
    }
    if (wb >= 2) sc += 30; if (bb >= 2) sc -= 30;
    return (this.side === 1 ? sc : -sc) + 8;
  }
  scoreMoves(buf, n, sp, ttm) {
    const sc = new Int32Array(n), b = this.b, k = this.killers[sp], hb = this.side === 1 ? 0 : 16384;
    for (let i = 0; i < n; i++) {
      const m = buf[i]; let s = 0;
      if (m === ttm) s = 2000000;
      else if (m & CAP) {
        const v = (m & EPF) ? P : Math.abs(b[(m >> 7) & 127]); const a = Math.abs(b[m & 127]);
        s = 1000000 + v * 16 - a;
      } else if ((m >> 14) & 7) s = 900000;
      else if (m === k[0]) s = 800000; else if (m === k[1]) s = 790000;
      else s = this.hist[hb + (m & 16383)];
      sc[i] = s;
    }
    return sc;
  }
  qsearch(alpha, beta, sp) {
    if ((++this.nodes & 2047) === 0 && now() > this.deadline) this.stop = true;
    if (this.stop) return 0;
    const stand = this.evaluate();
    if (sp >= 100) return stand;
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    const buf = this.bufs[sp], n = this.gen(buf, true), sc = this.scoreMoves(buf, n, sp, 0), b = this.b;
    for (let i = 0; i < n; i++) {
      let bi = i; for (let j = i + 1; j < n; j++) if (sc[j] > sc[bi]) bi = j;
      if (bi !== i) { const t = buf[i]; buf[i] = buf[bi]; buf[bi] = t; const u = sc[i]; sc[i] = sc[bi]; sc[bi] = u; }
      const m = buf[i];
      if (!((m >> 14) & 7)) { const v = (m & EPF) ? P : Math.abs(b[(m >> 7) & 127]); if (stand + VAL[v] + 200 < alpha) continue; }
      if (!this.make(m)) continue;
      const s = -this.qsearch(-beta, -alpha, sp + 1);
      this.unmake(m);
      if (this.stop) return 0;
      if (s >= beta) return beta;
      if (s > alpha) alpha = s;
    }
    return alpha;
  }
  search(depth, alpha, beta, sp, allowNull) {
    if ((++this.nodes & 2047) === 0 && now() > this.deadline) this.stop = true;
    if (this.stop) return 0;
    const ci = this.side === 1 ? 0 : 1;
    const inCheck = this.attacked(this.ksq[ci], -this.side);
    if (inCheck && sp < 60) depth++;
    if (sp > 0) { if (this.half >= 100 || this.isRep()) return 0; }
    if (depth <= 0) return this.noQ ? this.evaluate() : this.qsearch(alpha, beta, sp);
    if (sp >= 100) return this.evaluate();
    const origAlpha = alpha; let ttm = 0;
    const ti = this.h1 & TTMASK;
    if (TTK1[ti] === this.h1 && TTK2[ti] === this.h2) {
      ttm = TTM[ti];
      if (TTD[ti] >= depth && sp > 0) {
        let s = TTS[ti]; if (s > MATE - 1000) s -= sp; else if (s < -MATE + 1000) s += sp;
        const f = TTF[ti];
        if (f === 0) return s; if (f === 1 && s >= beta) return s; if (f === 2 && s <= alpha) return s;
      }
    }
    if (allowNull && !inCheck && depth >= 3 && sp > 0 && beta < MATE - 1000) {
      let has = false; const b = this.b, us = this.side;
      for (let s = 0; s < 128; s++) { if (s & 0x88) { s += 7; continue; } const p = b[s] * us; if (p > 1 && p < 6) { has = true; break; } }
      if (has) {
        this.makeNull();
        const s = -this.search(depth - 3, -beta, -beta + 1, sp + 1, false);
        this.unmakeNull();
        if (this.stop) return 0;
        if (s >= beta) return beta;
      }
    }
    const buf = this.bufs[sp], n = this.gen(buf, false), sc = this.scoreMoves(buf, n, sp, ttm);
    let legal = 0, best = -INF, bestM = 0;
    for (let i = 0; i < n; i++) {
      let bi = i; for (let j = i + 1; j < n; j++) if (sc[j] > sc[bi]) bi = j;
      if (bi !== i) { const t = buf[i]; buf[i] = buf[bi]; buf[bi] = t; const u = sc[i]; sc[i] = sc[bi]; sc[bi] = u; }
      const m = buf[i];
      if (!this.make(m)) continue;
      legal++;
      let s;
      const quiet = !(m & CAP) && !((m >> 14) & 7);
      if (legal === 1) s = -this.search(depth - 1, -beta, -alpha, sp + 1, true);
      else {
        let red = 0;
        if (depth >= 3 && legal > 4 && quiet && !inCheck) red = 1;
        s = -this.search(depth - 1 - red, -alpha - 1, -alpha, sp + 1, true);
        if (s > alpha && red) s = -this.search(depth - 1, -alpha - 1, -alpha, sp + 1, true);
        if (s > alpha && s < beta) s = -this.search(depth - 1, -beta, -alpha, sp + 1, true);
      }
      this.unmake(m);
      if (this.stop) return 0;
      if (s > best) { best = s; bestM = m; }
      if (s > alpha) {
        alpha = s;
        if (alpha >= beta) {
          if (quiet) {
            const k = this.killers[sp]; if (k[0] !== m) { k[1] = k[0]; k[0] = m; }
            this.hist[(this.side === 1 ? 0 : 16384) + (m & 16383)] += depth * depth;
          }
          break;
        }
      }
    }
    if (legal === 0) return inCheck ? -MATE + sp : 0;
    let flag = 0; if (best <= origAlpha) flag = 2; else if (best >= beta) flag = 1;
    let st = best; if (st > MATE - 1000) st += sp; else if (st < -MATE + 1000) st -= sp;
    TTK1[ti] = this.h1; TTK2[ti] = this.h2; TTS[ti] = st; TTM[ti] = bestM; TTD[ti] = Math.max(0, Math.min(127, depth)); TTF[ti] = flag;
    return best;
  }
  legalMoves() {
    const buf = new Int32Array(256), n = this.gen(buf, false), out = [];
    for (let i = 0; i < n; i++) { if (this.make(buf[i])) { this.unmake(buf[i]); out.push(buf[i]); } }
    return out;
  }
  playUci(u) {
    const from = sqFrom(u.slice(0, 2)), to = sqFrom(u.slice(2, 4)), pr = u[4] ? 'pnbrqk'.indexOf(u[4]) + 1 : 0;
    for (const m of this.legalMoves()) if ((m & 127) === from && ((m >> 7) & 127) === to && ((m >> 14) & 7) === pr) { this.make(m); return true; }
    return false;
  }
}

export function perft(pos, depth) {
  if (depth === 0) return 1;
  const buf = pos.bufs[depth], n = pos.gen(buf, false); let c = 0;
  for (let i = 0; i < n; i++) { const m = buf[i]; if (pos.make(m)) { c += perft(pos, depth - 1); pos.unmake(m); } }
  return c;
}

// Stärkestufen (Elo grob geschätzt)
export const LEVELS = [
  { name: 'Zufall', elo: 400 }, { name: 'Anfänger', elo: 600 }, { name: 'Einsteiger', elo: 800 },
  { name: 'Hobby', elo: 1000 }, { name: 'Vereinsneuling', elo: 1300 }, { name: 'Vereinsspieler', elo: 1600 },
  { name: 'Experte', elo: 1900 }, { name: 'Profi', elo: 2100 },
];
const CFG = [
  null,
  { depth: 1, noise: 450, noQ: true }, { depth: 1, noise: 220 }, { depth: 2, noise: 110 },
  { depth: 3, noise: 50 }, { depth: 4, noise: 18 },
  { time: 1400, maxDepth: 7 }, { time: 3500, maxDepth: 10 },
];

export function chooseMove({ fen, moves = [], level = 3, timeMs }) {
  const pos = new Pos(); pos.fromFEN(fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  for (const u of moves) pos.playUci(u);
  const legal = pos.legalMoves();
  if (!legal.length) return { uci: null };
  if (legal.length === 1) return { uci: moveUci(legal[0]), score: 0, depth: 0 };
  const rootPly = pos.ply;
  if (level <= 0) return { uci: moveUci(legal[Math.floor(Math.random() * legal.length)]), score: 0, depth: 0 };
  pos.hist.fill(0); for (const k of pos.killers) { k[0] = 0; k[1] = 0; }
  const cfg = CFG[Math.min(level, 7)];
  pos.stop = false; pos.nodes = 0;
  if (cfg.depth) {
    pos.deadline = now() + 20000; pos.noQ = !!cfg.noQ;
    let bestM = legal[0], bestS = -Infinity;
    for (const m of legal) {
      pos.make(m);
      let s;
      const o = pos.legalMoves();
      if (!o.length) s = pos.inCheck() ? MATE : 0;
      else s = -pos.search(cfg.depth - 1, -INF, INF, 1, true);
      pos.unmake(m);
      s += (Math.random() + Math.random() + Math.random() - 1.5) * cfg.noise;
      if (s > bestS) { bestS = s; bestM = m; }
    }
    return { uci: moveUci(bestM), score: Math.round(bestS), depth: cfg.depth };
  }
  const limit = timeMs || cfg.time; const start = now(); pos.deadline = start + limit; pos.noQ = false;
  let bestM = legal[0], bestS = 0, done = 0, order = legal.slice();
  for (let d = 1; d <= cfg.maxDepth; d++) {
    let curBest = 0, curS = -INF, alpha = -INF;
    for (const m of order) {
      pos.make(m);
      const s = -pos.search(d - 1, -INF, -alpha, 1, true);
      pos.unmake(m);
      if (pos.stop) break;
      if (s > curS) { curS = s; curBest = m; if (s > alpha) alpha = s; }
    }
    if (pos.stop && !curBest) break;
    if (curBest && (!pos.stop || curS > -INF)) {
      if (!pos.stop) { bestM = curBest; bestS = curS; done = d; order = [curBest, ...order.filter((x) => x !== curBest)]; }
      else if (curBest && done < d) { /* teilweise Iteration verwerfen */ }
    }
    if (pos.stop || Math.abs(bestS) > MATE - 100) break;
    if (now() - start > limit * 0.6) break;
  }
  return { uci: moveUci(bestM), score: bestS, depth: done };
}
