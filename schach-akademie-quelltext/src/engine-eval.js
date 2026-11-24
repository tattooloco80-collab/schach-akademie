// Engine-Bewertung mit visuellem Stab (einzigartig für diese App!)
// Zeigt Vorteil in Echtzeit als Farb-Stab neben dem Brett

export class EngineEval {
  constructor(container) {
    this.container = container;
    this.score = 0;  // Mittelpunkt = 0
    this.build();
  }

  build() {
    // Container für Bewertungsstab
    const bar = document.createElement('div');
    bar.className = 'engine-eval';
    bar.style.cssText = `
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      width: 30px;
      height: 300px;
      background: #2a2a2a;
      border-radius: 4px;
      border: 1px solid #555;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;

    // Weißer Bereich (oben = Weiß besser)
    const white = document.createElement('div');
    white.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 50%;
      background: linear-gradient(to bottom, #f0f0f0, #e8e8e8);
      border-bottom: 1px solid #ccc;
    `;

    // Schwarzer Bereich (unten = Schwarz besser)
    const black = document.createElement('div');
    black.style.cssText = `
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 50%;
      background: linear-gradient(to top, #333, #444);
      border-top: 1px solid #555;
    `;

    // Bewertungs-Indikator (roter Strich)
    const indicator = document.createElement('div');
    indicator.style.cssText = `
      position: absolute;
      left: 0;
      width: 100%;
      height: 3px;
      background: #ff6b6b;
      top: 50%;
      transition: top 0.3s ease;
      box-shadow: 0 0 8px rgba(255, 107, 107, 0.6);
    `;

    bar.appendChild(white);
    bar.appendChild(black);
    bar.appendChild(indicator);
    this.container.appendChild(bar);

    this.bar = bar;
    this.indicator = indicator;

    // Label
    const label = document.createElement('div');
    label.style.cssText = `
      position: absolute;
      right: 50px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 12px;
      color: #aaa;
      font-family: monospace;
      min-width: 40px;
      text-align: right;
    `;
    this.container.appendChild(label);
    this.label = label;
  }

  // Bewertung setzen: -300...+300 für visuellen Stab
  setScore(cp) {
    this.score = cp;

    // Normalize -300 bis +300 zu 0 bis 300 Pixel
    const height = 300;
    const middle = height / 2;
    const normalized = Math.max(-300, Math.min(300, cp));
    const pos = middle - (normalized / 300) * middle;

    this.indicator.style.top = pos + 'px';

    // Label-Text
    let label = '';
    if (cp > 300) label = '+∞';
    else if (cp < -300) label = '-∞';
    else if (cp >= 0) label = '+' + (cp / 100).toFixed(1);
    else label = (cp / 100).toFixed(1);

    this.label.textContent = label;
  }

  // Farbe basierend auf Bewertung
  getScoreColor(cp) {
    if (cp > 150) return '#27ae60';  // Grün: großer Vorteil
    if (cp > 50) return '#2ecc71';   // Hellgrün: Vorteil
    if (cp > -50) return '#ecf0f1';  // Neutral/Grau
    if (cp > -150) return '#e74c3c'; // Orange: Nachteil
    return '#c0392b';                // Rot: großer Nachteil
  }
}

// Visueller Move-Arrow für beste Varianten (Lichess-Style)
export class MoveArrow {
  constructor(scene) {
    this.scene = scene;
    this.arrows = [];
  }

  // Zug visualisieren als Pfeil
  drawArrow(from, to, color = 0x00ff00, opacity = 0.6) {
    // Platzierung auf dem Brett berechnen
    const fpos = this.getSquarePos(from);
    const tpos = this.getSquarePos(to);

    if (!fpos || !tpos) return;

    // Arrow-Mesh erstellen (später: Three.js Arrow Geometry)
    // Für jetzt: einfache Linie mit Pfeilspitze
    console.log(`Arrow: ${from} → ${to} (${color.toString(16)})`);
  }

  getSquarePos(square) {
    const f = square.charCodeAt(0) - 97;  // a-h → 0-7
    const r = +(square[1]) - 1;            // 1-8 → 0-7
    return { x: f - 3.5, z: 3.5 - r };
  }

  clear() {
    // Alle Pfeile entfernen
    this.arrows = [];
  }
}
