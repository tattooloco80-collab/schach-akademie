// Das 3D-Brett von oben als Haupt-Brett: Tippen auf Felder, Markierungen, Punkte für mögliche Züge.
import { Raycaster, Vector2, Vector3, Plane } from 'three';

export class BoardView {
  constructor(b3, host, o) {
    this.b3 = b3; this.host = host; this.o = o; this.orient = 'w'; this.sel = null; this.targets = []; this.enabled = true; this.chess = null; this.st = {};
    host.classList.add('board'); b3.showTray = !!o.tray; b3.setView('top'); b3.attach(host);
    this.ro = new ResizeObserver(() => b3.resize()); this.ro.observe(host);
    this.ray = new Raycaster(); this.plane = new Plane(new Vector3(0, 1, 0), -0.3); this.hit = new Vector3();
    b3.canvas.onpointerdown = (e) => this._down(e); window.__board = this;
  }
  setOrientation(c) { this.orient = c; }
  _marks() {
    const board = this.chess ? this.chess.board() : null, caps = [], dots = [];
    if (this.sel && this.o.dots !== false && board) for (const t of this.targets) { const f = t.charCodeAt(0) - 97, r = 8 - +t[1]; (board[r][f] ? caps : dots).push(t); }
    this.b3.setMarks({ last: this.st.last, check: this.st.check, hint: this.st.hint, sel: this.sel, dots, caps });
  }
  draw(chess, st = {}) {
    this.chess = chess; this.st = st; this.sel = null; this.targets = [];
    this.b3.setPosition(chess, this.orient); this._marks();
  }
  select(sq, t) { this.sel = sq; this.targets = t; this._marks(); }
  clear() { this.sel = null; this.targets = []; if (this.chess) this._marks(); }
  sqXY(sq) {
    const p = this.b3.sqPos(sq), v = new Vector3(p.x, 0.3, p.z).project(this.b3.camera), r = this.b3.canvas.getBoundingClientRect();
    return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height];
  }
  _sqAt(e) {
    const b = this.b3, r = b.canvas.getBoundingClientRect(); b.camera.updateMatrixWorld();
    this.ray.setFromCamera(new Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), b.camera);
    if (!this.ray.ray.intersectPlane(this.plane, this.hit)) return null;
    const f = Math.floor(this.hit.x + 4), rk = Math.floor(4 - this.hit.z); if (f < 0 || f > 7 || rk < 0 || rk > 7) return null;
    return 'abcdefgh'[f] + (rk + 1);
  }
  _down(e) {
    if (this.b3._tw.length) this.b3.skip();   // laufende Bewegung überspringen und den Tipp trotzdem auswerten
    if (!this.enabled) return;
    const sq = this._sqAt(e); if (!sq) return;
    if (this.sel && this.targets.includes(sq)) { const from = this.sel; this.clear(); this.o.onMove(from, sq); return; }
    const t = this.o.movesFrom(sq);
    if (t && t.length) this.select(sq, t); else this.clear();
  }
}
