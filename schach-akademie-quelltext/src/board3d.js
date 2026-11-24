// 3D-Szene: animierte Zugsequenzen (Three.js). Ein Renderer, wird zwischen Containern verschoben.
import {
  Scene, PerspectiveCamera, WebGLRenderer, Color, HemisphereLight, DirectionalLight, Mesh, MeshStandardMaterial,
  MeshBasicMaterial, BoxGeometry, LatheGeometry, SphereGeometry, CylinderGeometry, ExtrudeGeometry, Shape, Group,
  Vector2, Vector3, PlaneGeometry, TextureLoader, CanvasTexture, SRGBColorSpace, PCFShadowMap, TorusGeometry, CapsuleGeometry, TubeGeometry, CatmullRomCurve3,
} from 'three';

import handUrl from './hand.webp';
import handShadowUrl from './handshadow.webp';
import sleeveUrl from './sleeve.webp';
import pmeta from './pieces/meta.json';
import pwr from './pieces/wr.webp'; import pwn from './pieces/wn.webp'; import pwb from './pieces/wb.webp'; import pwq from './pieces/wq.webp'; import pwk from './pieces/wk.webp'; import pwp from './pieces/wp.webp';
import pbr from './pieces/br.webp'; import pbn from './pieces/bn.webp'; import pbb from './pieces/bb.webp'; import pbq from './pieces/bq.webp'; import pbk from './pieces/bk.webp'; import pbp from './pieces/bp.webp';
const PURL = { wr: pwr, wn: pwn, wb: pwb, wq: pwq, wk: pwk, wp: pwp, br: pbr, bn: pbn, bb: pbb, bq: pbq, bk: pbk, bp: pbp };
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const lin = (t) => t;
const prof = (pts) => new LatheGeometry(pts.map(([r, y]) => new Vector2(r, y)), 28);

export function webglSupported() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}

export class Board3D {
  constructor() {
    this.ok = false;
    try { this._init(); this.ok = true; } catch (e) { console.warn('3D nicht verfügbar', e); }
  }
  _init() {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = PCFShadowMap;
    this.canvas = this.renderer.domElement; this.canvas.className = 'c3d';
    this.scene = new Scene(); this.scene.background = new Color(0x5a606a);
    this.camera = new PerspectiveCamera(36, 1, 0.1, 100);
    this.scene.add(new HemisphereLight(0xffffff, 0xa4a9b2, 1.3));
    const sun = new DirectionalLight(0xffffff, 1.1); sun.position.set(5, 11, 7); sun.castShadow = true; sun.shadow.intensity = .75;
    sun.shadow.mapSize.set(1024, 1024); const sc = sun.shadow.camera; sc.left = -7; sc.right = 7; sc.top = 7; sc.bottom = -7; sc.near = 1; sc.far = 30;
    this.scene.add(sun);
    this.base = { az: 0, el: 0.95, r: 14.2, tx: 0, tz: 0 };
    this.cam = { ...this.base };
    this.view = 'top'; this.showTray = false; this.dots = []; this.dotGeo = new CylinderGeometry(.15, .15, .02, 20); this.dotMat = new MeshBasicMaterial({ color: 0xd9a400, transparent: true, opacity: .9 });
    this.ringGeo = new TorusGeometry(.42, .05, 8, 28); this.ringMat = new MeshBasicMaterial({ color: 0xff5a4a, transparent: true, opacity: .9 }); this.trayMeshes = []; this.hand = null;
    this.pieces = new Map(); this.tiles = []; this._tw = []; this._parts = []; this._pending = []; this._raf = 0; this._last = 0; this.slow = 1; this._skip = false;
    this.pGeo = new SphereGeometry(0.07, 6, 6);
    this.matW = new MeshStandardMaterial({ color: 0xfffdf4, roughness: 0.3, metalness: 0.02 });
    this.matB = new MeshStandardMaterial({ color: 0x25282e, roughness: 0.28, metalness: 0.08 });
    this._buildGeo(); this._buildBoard(); try { this._buildHand(); } catch (e) { /* Hand optional */ }
  }
  _buildGeo() {
    const g = {};
    g.pawn = [{ geo: prof([[0, 0], [.34, 0], [.36, .05], [.33, .1], [.22, .17], [.15, .3], [.19, .38], [.1, .42], [0, .42]]) }, { geo: new SphereGeometry(.2, 20, 16), y: .56 }];
    g.rook = [{ geo: prof([[0, 0], [.36, 0], [.38, .06], [.3, .14], [.23, .3], [.22, .55], [.3, .62], [.32, .76], [0, .76]]) }];
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) g.rook.push({ geo: new BoxGeometry(.15, .14, .15), x: sx * .21, z: sz * .21, y: .82 });
    g.bishop = [{ geo: prof([[0, 0], [.34, 0], [.36, .06], [.3, .14], [.18, .3], [.13, .5], [.19, .62], [.15, .68], [0, .68]]) },
      { geo: new SphereGeometry(.2, 20, 16), y: .86, sy: 1.4 }, { geo: new SphereGeometry(.06, 10, 8), y: 1.17 }];
    g.queen = [{ geo: prof([[0, 0], [.38, 0], [.4, .06], [.34, .14], [.22, .3], [.16, .55], [.2, .8], [.3, .95], [.26, 1.02], [0, 1.02]]) }, { geo: new SphereGeometry(.1, 12, 10), y: 1.2 }];
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.queen.push({ geo: new SphereGeometry(.065, 8, 6), x: Math.cos(a) * .22, z: Math.sin(a) * .22, y: 1.08 }); }
    g.king = [{ geo: prof([[0, 0], [.38, 0], [.4, .06], [.34, .14], [.22, .3], [.17, .6], [.22, .9], [.32, 1.02], [.28, 1.1], [0, 1.1]]) },
      { geo: new BoxGeometry(.11, .36, .11), y: 1.3 }, { geo: new BoxGeometry(.28, .1, .11), y: 1.34 }];
    const s = new Shape();
    s.moveTo(-.26, 0); s.lineTo(.28, 0); s.quadraticCurveTo(.3, .3, .18, .5); s.lineTo(.4, .56); s.lineTo(.42, .68); s.lineTo(.2, .8);
    s.lineTo(.16, .93); s.lineTo(.06, .85); s.quadraticCurveTo(-.2, .85, -.3, .5); s.quadraticCurveTo(-.34, .25, -.26, 0);
    const eg = new ExtrudeGeometry(s, { depth: .3, bevelEnabled: true, bevelSize: .04, bevelThickness: .04, bevelSegments: 2, curveSegments: 8 });
    eg.translate(0, 0, -.15);
    g.knight = [{ geo: prof([[0, 0], [.34, 0], [.36, .06], [.3, .14], [.22, .2], [0, .2]]) }, { geo: eg, y: .18, knight: true }];
    this.G = g;
  }
  _buildBoard() {
    const root = new Group(); this.scene.add(root);
    const lightM = new MeshStandardMaterial({ color: 0xfff6e2, roughness: 1 }), darkM = new MeshStandardMaterial({ color: 0x221c17, roughness: .7 });
    const tg = new BoxGeometry(1, .2, 1);
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const m = ((r + f) % 2 === 0 ? darkM : lightM).clone();
      const t = new Mesh(tg, m); t.position.set(f - 3.5, -.1, 3.5 - r); t.receiveShadow = true; root.add(t); this.tiles[r * 8 + f] = t;
    }
    const frame = new Mesh(new BoxGeometry(8.6, .34, 8.6), new MeshStandardMaterial({ color: 0x6a3217, roughness: .55, metalness: .05 }));
    frame.position.y = -.27; frame.receiveShadow = true; root.add(frame);
    const table = new Mesh(new CylinderGeometry(10, 10, .3, 48), new MeshStandardMaterial({ color: 0x4f555f, roughness: .95 }));
    table.position.y = -.6; table.receiveShadow = true; root.add(table);
    this.labels = [];
    const mkLab = (ch) => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#eadcc0'; x.font = 'bold 44px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ch, 32, 36);
      const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; const m = new Mesh(new PlaneGeometry(.24, .24), new MeshBasicMaterial({ map: t, transparent: true, toneMapped: false })); root.add(m); this.labels.push(m); };
    for (const ch of 'abcdefgh') mkLab(ch); for (const ch of '12345678') mkLab(ch);
    this.root = root;
  }
  attach(el) {
    if (!this.ok) return; el.appendChild(this.canvas); this.container = el; this.resize();
  }
  resize() {
    if (!this.ok || !this.container) return;
    const w = this.container.clientWidth || 300, h = this.container.clientHeight || 300;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h;
    this._rebase(); this._applyCam(); this.renderer.render(this.scene, this.camera);
  }
  _rebase() {
    if (!this.container) return;
    const w = this.container.clientWidth || 300, h = this.container.clientHeight || 300, br = this.showTray ? 15.3 : 13.7;
    this.base.r = w / h < 1 ? br / Math.min(1, (w / h) * 1.05) : br; if (this.cam) this.cam.r = this.base.r;
  }
  setView(v) {
    this.view = v; this.base = { az: this.base.az, el: v === 'top' ? Math.PI / 2 : 0.95, r: 14.2, tx: 0, tz: 0 }; this.cam = { ...this.base }; this._rebase();
  }
  sqPos(n) { return { x: n.charCodeAt(0) - 97 - 3.5, z: 3.5 - (+n[1] - 1) }; }
  _mat(color) { return color === 'w' ? this.matW : this.matB; }
  _pieceMat(key) {
    this._pm = this._pm || {};
    if (!this._pm[key]) {
      const t = new TextureLoader().load(PURL[key], () => this._kick()); t.colorSpace = SRGBColorSpace; t.anisotropy = 4;
      this._pm[key] = new MeshBasicMaterial({ map: t, alphaTest: .08, alphaToCoverage: true, toneMapped: false });
    }
    return this._pm[key];
  }
  // Figur als Foto-Aufsicht: ein flaches Bild, das auf dem Brett liegt (wie auf dem echten Brett von oben)
  makePiece(type, color) {
    const key = color + type, mt = pmeta[key], grp = new Group(), mat = this._pieceMat(key).clone();
    const geo = new PlaneGeometry(mt.w, mt.h), sp = new Mesh(geo, mat);
    sp.rotation.x = -Math.PI / 2; sp.position.set(0, .06, .47 - mt.h / 2); grp.add(sp);
    if (!this._shTex) {
      const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 32);
      g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
      this._shTex = new CanvasTexture(c); this._shGeo = new PlaneGeometry(.95, .5);
    }
    const sh = new Mesh(this._shGeo, new MeshBasicMaterial({ map: this._shTex, transparent: true, depthWrite: false, toneMapped: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.set(.04, .02, .36); sh.renderOrder = 1; grp.add(sh);
    const pulseMat = { emissive: { setRGB: (r) => mat.color.setRGB(1, 1 - r * .75, 1 - r * .75) } };
    grp.rotation.y = this.base.az; grp.userData = { type, color, mat: pulseMat, sp };
    return grp;
  }
  _order(m) { const sg = Math.cos(this.base.az) >= 0 ? 1 : -1; m.userData.sp.position.y = .06 + sg * m.position.z * .004; }
  setPosition(chess, orientation = 'w') {
    if (!this.ok) return;
    for (const m of this.pieces.values()) this.root.remove(m);
    for (const m of this.trayMeshes) this.root.remove(m); this.trayMeshes = []; if (this.hand) this.root.remove(this.hand);
    this.base.az = orientation === 'w' ? 0 : Math.PI;
    this.pieces.clear(); this._clearHL(); this._clearDots(); this._placeLabels(orientation);
    for (const row of chess.board()) for (const c of row) {
      if (!c) continue;
      const m = this.makePiece(c.type, c.color); const p = this.sqPos(c.square); m.position.set(p.x, 0, p.z); this._order(m);
      this.root.add(m); this.pieces.set(c.square, m);
    }
    if (this.showTray) {
      const start = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };
      for (const col of ['w', 'b']) {
        const have = { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 }; for (const row of chess.board()) for (const c of row) if (c && c.color === col) have[c.type]++;
        let k = 0; for (const t of ['q', 'r', 'b', 'n', 'p']) for (let i = 0; i < Math.max(0, start[t] - have[t]); i++) {
          const m = this.makePiece(t, col), sl = this.traySlot(col, k++); m.position.set(sl.x, 0, sl.z); this._order(m); m.scale.setScalar(.4); this.root.add(m); this.trayMeshes.push(m);
        }
      }
    }
    this.base.az = orientation === 'w' ? 0 : Math.PI; this.cam = { ...this.base }; this._rebase();
    this._applyCam(); this.renderer.render(this.scene, this.camera);
  }
  _applyCam() {
    const c = this.cam, ch = Math.cos(c.el) * c.r;
    this.camera.position.set(c.tx + Math.sin(c.az) * ch, Math.sin(c.el) * c.r, c.tz + Math.cos(c.az) * ch);
    if (this.view === 'top') this.camera.up.set(-Math.sin(c.az), 0, -Math.cos(c.az));
    this.camera.lookAt(c.tx, 0, c.tz);
  }
  _clearHL() { for (const t of this.tiles) t.material.emissive.setHex(0x000000); }
  _hl(sq, hex) { const f = sq.charCodeAt(0) - 97, r = +sq[1] - 1; this.tiles[r * 8 + f].material.emissive.setHex(hex); }
  _clearDots() { for (const d of this.dots) this.root.remove(d); this.dots = []; }
  _dot(sq, cap) {
    const p = this.sqPos(sq), m = cap ? new Mesh(this.ringGeo, this.ringMat) : new Mesh(this.dotGeo, this.dotMat); m.position.set(p.x, cap ? .03 : .02, p.z);
    if (cap) m.rotation.x = Math.PI / 2; this.root.add(m); this.dots.push(m);
  }
  setMarks(m) {
    this._clearHL(); this._clearDots(); const hl = (sq, hex) => { if (sq) this._hl(sq, hex); };
    if (m.last) { hl(m.last.from, 0x6a5200); hl(m.last.to, 0x8a6a00); }
    hl(m.check, 0x9a1212); (m.hint || []).forEach((q) => hl(q, 0x14803f)); hl(m.sel, 0x1c5c9e);
    (m.dots || []).forEach((q) => this._dot(q, false)); (m.caps || []).forEach((q) => this._dot(q, true));
    this.renderer.render(this.scene, this.camera);
  }
  _placeLabels(o) {
    const w = o === 'w'; this.labels.forEach((l, i) => {
      l.rotation.order = 'YXZ'; l.rotation.set(-Math.PI / 2, w ? 0 : Math.PI, 0);
      if (i < 8) l.position.set(i - 3.5, -.08, w ? 4.13 : -4.13); else { const r = i - 8; l.position.set(w ? -4.13 : 4.13, -.08, 3.5 - r); }
    });
  }
  skip() { this._skip = true; this._kick(); }
  _kick() { if (!this._raf) this._raf = requestAnimationFrame(this._frame); }
  _tween(dur, fn, ease = lin) {
    return new Promise((res) => { this._tw.push({ t0: null, dur: Math.max(1, dur * 1000 * this.slow), fn, ease, res }); this._kick(); });
  }
  _frame = (ts) => {
    this._raf = 0; const dt = this._last ? Math.min(0.05, (ts - this._last) / 1000) : 0.016; this._last = ts;
    for (const tw of this._tw.slice()) {
      if (tw.t0 == null) tw.t0 = ts;
      const p = this._skip ? 1 : Math.min(1, (ts - tw.t0) / tw.dur);
      tw.fn(tw.ease(p));
      if (p >= 1) { this._tw.splice(this._tw.indexOf(tw), 1); tw.res(); }
    }
    for (const q of this._parts.slice()) {
      q.life -= dt; q.v.y -= 9 * dt; q.m.position.x += q.v.x * dt; q.m.position.y += q.v.y * dt; q.m.position.z += q.v.z * dt;
      q.m.scale.setScalar(Math.max(0.01, q.life / q.max));
      if (q.life <= 0 || this._skip) { this.root.remove(q.m); this._parts.splice(this._parts.indexOf(q), 1); }
    }
    this._aimHand(); this._applyCam(); this.renderer.render(this.scene, this.camera);
    if (this._tw.length || this._parts.length) this._kick(); else this._last = 0;
  };
  _burst(x, y, z, hex, n = 14, power = 3) {
    for (let i = 0; i < n; i++) {
      const m = new Mesh(this.pGeo, new MeshBasicMaterial({ color: hex })); m.position.set(x, y, z); this.root.add(m);
      const a = Math.random() * Math.PI * 2, s = (0.4 + Math.random()) * power;
      this._parts.push({ m, v: { x: Math.cos(a) * s, y: 2 + Math.random() * 3, z: Math.sin(a) * s }, life: .7, max: .7 });
    }
    this._kick();
  }
  _camTo(t, dur) {
    const c0 = { ...this.cam };
    return this._tween(dur, (e) => { for (const k in t) this.cam[k] = lerp(c0[k], t[k], e); }, easeInOut);
  }
  _pulse(mesh, dur, times) {
    const mat = mesh.userData.mat;
    return this._tween(dur, (e) => { const v = Math.abs(Math.sin(e * Math.PI * times)); mat.emissive.setRGB(v * .9, v * .08, v * .08); if (e >= 1) mat.emissive.setRGB(0, 0, 0); });
  }
  async _hop(mesh, from, to, dur = .55) {
    const a = this.sqPos(from), b = this.sqPos(to);
    await this._tween(dur, (e) => { mesh.position.x = lerp(a.x, b.x, e); mesh.position.z = lerp(a.z, b.z, e); mesh.position.y = Math.sin(Math.PI * e) * .8; }, easeInOut);
    mesh.position.y = 0;
  }
  traySlot(col, k) { return col === 'w' ? { x: -4.62, z: 3.9 - k * .48 } : { x: 4.62, z: -3.9 + k * .48 }; }
  _buildHand() {
    // Foto einer echten Hand (Rückansicht, weißer Hemdärmel) als flache Textur über dem Brett
    const W = 2.8, k = W / 1024, Hh = 1536 * k, g = new Group(), ph = new Group(), loader = new TextureLoader();
    const mk = (u, o) => { const t = loader.load(u, () => this._kick()); t.colorSpace = SRGBColorSpace; return new MeshBasicMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, ...o }); };
    const geo = new PlaneGeometry(W, Hh), extGeo = new PlaneGeometry(402 * k, 12);
    { const q = extGeo.attributes.position; for (let i = 2; i < 4; i++) q.setX(i, q.getX(i) * 1.7); }   // Ärmel weitet sich zur Schulter hin
    const shadow = new Mesh(geo, mk(handShadowUrl)); shadow.position.set(.22, -.3, 0); shadow.renderOrder = 10;
    const hand = new Mesh(geo, mk(handUrl)); hand.renderOrder = 12;
    const ext = new Mesh(extGeo, mk(sleeveUrl)); ext.position.set(((361 + 763) / 2 - 512) * k, -Hh / 2 - 6 + .03, 0); ext.renderOrder = 13;
    ph.add(shadow, ext, hand); ph.rotation.x = -Math.PI / 2;
    ph.position.set(-(500 - 512) * k, 0, (768 + 120) * k);   // Schiebepunkt knapp vor den Fingerspitzen = Ursprung
    g.add(ph); g.userData = {}; this.hand = g;
  }
  _pinchSet(w) { this.pinchW = w; }
  _pinch(w, dur) { const w0 = this.pinchW; return this._tween(dur, (e) => this._pinchSet(lerp(w0, w, e)), easeInOut); }
  _handTo(x, y, z, dur) { const h = this.hand, a = { x: h.position.x, y: h.position.y, z: h.position.z }; return this._tween(dur, (e) => h.position.set(lerp(a.x, x, e), lerp(a.y, y, e), lerp(a.z, z, e)), easeInOut); }
  _aimHand() {
    const h = this.hand; if (!h || !h.parent) return;
    h.rotation.y = Math.atan2(0 - h.position.x, this.hside * 11 - h.position.z);   // Rückseite der Hand zeigt zur Schulter
  }
  _ensureHand(side) {
    this.hside = side;
    if (!this.hand) this._buildHand(); const h = this.hand; this.root.add(h); this._pinchSet(.75); h.position.set(0, 2.6, side * 7.2); this._aimHand();
  }
  _hgt(m) { return { p: .74, r: .9, b: 1.2, q: 1.3, k: 1.5, n: 1.1 }[m.userData.type] || 1; }
  async _carry(mesh, from, to, o = {}) {
    const h = this.hand, H = this._hgt(mesh), gy = H * .5, hover = H + 1.0, lift = o.arc ? .8 : .1, arc = o.arc ? .5 : 0;
    const dx = to.x - from.x, dz = to.z - from.z, dist = Math.hypot(dx, dz) || 1;
    const bx = -from.x, bz = this.hside * 11 - from.z, bl = Math.hypot(bx, bz) || 1, sx = from.x + (bx / bl) * 1.6, sz = from.z + (bz / bl) * 1.6;
    await this._handTo(h.position.x, Math.max(hover, h.position.y), h.position.z, .08);
    await this._handTo(sx, hover, sz, .36);
    await this._handTo(sx, gy, sz, .14); await this._handTo(from.x, gy, from.z, .16);
    const sc = o.scaleTo || 1;
    await this._tween(Math.min(.8, .28 + dist * .06), (e) => {
      const up = Math.sin(Math.PI * e) * arc + lift * Math.min(1, e * 6) * (o.arc ? 1 : 0);
      mesh.position.x = lerp(from.x, to.x, e); mesh.position.z = lerp(from.z, to.z, e); mesh.position.y = up; mesh.scale.setScalar(lerp(1, sc, e));
      h.position.set(mesh.position.x, gy + up, mesh.position.z);
    }, easeInOut);
    mesh.position.y = 0;
  }
  async _handAway() {
    const h = this.hand, bx = -h.position.x, bz = this.hside * 11 - h.position.z, bl = Math.hypot(bx, bz) || 1;
    await this._handTo(h.position.x, h.position.y + .8, h.position.z, .08); await this._handTo(h.position.x + bx / bl * 7, h.position.y, h.position.z + bz / bl * 7, .3); this.root.remove(h);
  }
  // Draufsicht: eine Hand greift die Figur, schiebt sie und räumt Geschlagenes an den Rand.
  async animateHand(mv, o = {}) {
    if (!this.ok) return;
    this.slow = 1 / (o.speed || 1); this._skip = false; this._pending = [];
    const mesh = this.pieces.get(mv.from); if (!mesh) return;
    const f = this.sqPos(mv.from), t = this.sqPos(mv.to), side = mv.color === 'w' ? 1 : -1;
    this._hl(mv.from, 0x6a5200); this._hl(mv.to, 0x8a6a00); this._ensureHand(side);
    const ep = mv.flags.includes('e'), vsq = ep ? mv.to[0] + mv.from[1] : mv.to, victim = mv.captured ? this.pieces.get(vsq) : null;
    if (victim) {
      const vc = victim.userData.color, k = this.trayMeshes.filter((m) => m.userData.color === vc).length;
      await this._carry(victim, this.sqPos(vsq), this.traySlot(vc, k), { scaleTo: .4, arc: true });
      this.pieces.delete(vsq); this.trayMeshes.push(victim); this._burst(victim.position.x, .4, victim.position.z, 0xffd24a, 8, 1.5);
    }
    await this._carry(mesh, f, t, { arc: mv.piece === 'n' });
    this.pieces.delete(mv.from); this.pieces.set(mv.to, mesh);
    if (mv.flags.includes('k') || mv.flags.includes('q')) {
      const rank = mv.color === 'w' ? '1' : '8', kk = mv.flags.includes('k'), rf = (kk ? 'h' : 'a') + rank, rt = (kk ? 'f' : 'd') + rank, rook = this.pieces.get(rf);
      if (rook) { await this._carry(rook, this.sqPos(rf), this.sqPos(rt), {}); this.pieces.delete(rf); this.pieces.set(rt, rook); }
    }
    await this._handAway(side);
    let cur = mesh;
    if (mv.promotion) {
      await this._tween(.18, (e) => { cur.scale.setScalar(1 - e); }, easeIn0);
      this.root.remove(cur);
      const np = this.makePiece(mv.promotion, mv.color); np.position.set(t.x, 0, t.z); this._order(np); np.scale.setScalar(.01); this.root.add(np);
      this._burst(t.x, .5, t.z, 0xffd24a, 22, 3.5); this.pieces.set(mv.to, np); cur = np;
      await this._tween(.35, (e) => { np.scale.setScalar(e < .7 ? lerp(0, 1.25, e / .7) : lerp(1.25, 1, (e - .7) / .3)); }, lin);
    }
    const mate = mv.san.endsWith('#'), chk = mv.san.endsWith('+');
    if (chk || mate) {
      let king = null; for (const [, m] of this.pieces) if (m.userData.type === 'k' && m.userData.color !== mv.color) king = m;
      if (king) {
        await this._pulse(king, .7, 2);
        if (mate) { this._burst(king.position.x, .8, king.position.z, 0xff4040, 26, 4); const y0 = king.position.y, ax = mv.color === 'w' ? 1 : -1; await this._tween(.6, (e) => { king.rotation.x = ax * e * 1.45; king.position.y = lerp(y0, .32, e); }, (x) => x * x); }
      }
    }
    await Promise.all(this._pending); this._clearHL(); this.renderer.render(this.scene, this.camera);
  }
}
const easeIn0 = (t) => t * t;
