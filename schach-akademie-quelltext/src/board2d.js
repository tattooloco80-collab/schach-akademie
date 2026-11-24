import { GLYPH } from './util.js';

// 2D-Brett mit Tippen und Ziehen. Die Regeln liefert der Aufrufer (movesFrom / onMove).
export class Board2D {
  constructor(host, o) {
    this.host = host; this.o = o; this.orient = 'w'; this.sel = null; this.targets = []; this.cells = {}; this.drag = null; this.enabled = true;
    host.classList.add('board');
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const sq = 'abcdefgh'[f] + (r + 1), d = document.createElement('div');
      d.className = 'sq ' + ((r + f) % 2 === 0 ? 'dk' : 'lt'); d.dataset.sq = sq; host.appendChild(d); this.cells[sq] = d;
    }
    host.addEventListener('pointerdown', (e) => this._down(e));
    host.addEventListener('pointermove', (e) => this._move(e));
    host.addEventListener('pointerup', (e) => this._up(e));
    host.addEventListener('pointercancel', () => this._cancelDrag());
    this._layout();
  }
  setOrientation(c) { this.orient = c; this._layout(); }
  _layout() {
    for (const sq in this.cells) {
      const f = sq.charCodeAt(0) - 97, r = +sq[1] - 1, c = this.cells[sq];
      const x = this.orient === 'w' ? f : 7 - f, y = this.orient === 'w' ? 7 - r : r;
      c.style.left = x * 12.5 + '%'; c.style.top = y * 12.5 + '%';
      c.dataset.file = (y === 7) ? sq[0] : ''; c.dataset.rank = (x === 0) ? sq[1] : '';
    }
  }
  render(chess, st = {}) {
    const board = chess.board(); this.chess = chess;
    for (const sq in this.cells) { const c = this.cells[sq]; c.className = 'sq ' + (c.classList.contains('dk') ? 'dk' : 'lt'); c.textContent = ''; }
    for (const row of board) for (const p of row) {
      if (!p) continue;
      const s = document.createElement('span'); s.className = 'pc ' + p.color; s.textContent = GLYPH[p.type] + '︎'; this.cells[p.square].appendChild(s);
    }
    const add = (sq, cls) => { if (sq && this.cells[sq]) this.cells[sq].classList.add(cls); };
    if (st.last) { add(st.last.from, 'last'); add(st.last.to, 'last'); }
    if (st.check) add(st.check, 'chk');
    (st.hint || []).forEach((s) => add(s, 'hint'));
    if (this.sel) { add(this.sel, 'sel'); if (this.o.dots !== false) this.targets.forEach((t) => add(t, board_has(board, t) ? 'cap' : 'dot')); }
  }
  select(sq, targets) { this.sel = sq; this.targets = targets; this.render(this.chess, this.lastSt || {}); }
  clear() { this.sel = null; this.targets = []; if (this.chess) this.render(this.chess, this.lastSt || {}); }
  draw(chess, st) { this.lastSt = st; this.sel = null; this.targets = []; this.render(chess, st); }
  _sqAt(x, y) { const el = document.elementFromPoint(x, y); const c = el && el.closest && el.closest('.sq'); return c && this.host.contains(c) ? c.dataset.sq : null; }
  _down(e) {
    if (!this.enabled) return;
    const sq = this._sqAt(e.clientX, e.clientY); if (!sq) return;
    if (this.sel && this.targets.includes(sq)) { const from = this.sel; this.clear(); this.o.onMove(from, sq); return; }
    const t = this.o.movesFrom(sq);
    if (t && t.length) {
      this.select(sq, t); this.drag = { sq, x: e.clientX, y: e.clientY, ghost: null };
      try { this.host.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
    } else this.clear();
  }
  _move(e) {
    const d = this.drag; if (!d) return;
    if (!d.ghost && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) {
      const src = this.cells[d.sq].querySelector('.pc'); if (!src) return;
      const g = src.cloneNode(true); g.classList.add('ghost'); const sz = this.cells[d.sq].offsetWidth; g.style.fontSize = sz * 0.82 + 'px'; g.style.width = g.style.height = sz + 'px';
      document.body.appendChild(g); d.ghost = g; src.style.opacity = '0.25';
    }
    if (d.ghost) { d.ghost.style.left = e.clientX + 'px'; d.ghost.style.top = e.clientY - 16 + 'px'; }
  }
  _up(e) {
    const d = this.drag; if (!d) return; this._cancelDrag();
    if (!d.ghost) return;
    const sq = this._sqAt(e.clientX, e.clientY);
    if (sq && sq !== d.sq && this.targets.includes(sq)) { const from = this.sel; this.clear(); this.o.onMove(from, sq); } else if (sq !== d.sq) this.clear();
  }
  _cancelDrag() { const d = this.drag; this.drag = null; if (d && d.ghost) { d.ghost.remove(); const src = this.cells[d.sq].querySelector('.pc'); if (src) src.style.opacity = ''; } }
}
function board_has(board, sq) { const f = sq.charCodeAt(0) - 97, r = 8 - +sq[1]; return !!board[r][f]; }
