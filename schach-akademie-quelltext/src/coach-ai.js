// Advanced Coach mit natürlicher Sprachausgabe
// Ersetzt die statischen Kommentare durch dynamische, gesprächige Tipps

export class AdvancedCoach {
  constructor(engine, speak) {
    this.engine = engine;
    this.speak = speak;
    this.context = { phase: 'opening', lastMistakes: [] };
  }

  async analyzeMove(mv, fenBefore, fenAfter, chess) {
    const ply = chess.history().length;

    // Spiel-Phase bestimmen
    this.updatePhase(ply, chess);

    // Bewertung von Engine holen
    const before = await this.engine.go({ fen: fenBefore, level: 7, timeMs: 220 });
    const after = await this.engine.go({ fen: fenAfter, level: 7, timeMs: 220 });

    if (!before.score || !after.score) return null;

    const loss = Math.max(0, before.score + after.score);
    const isBest = before.uci === mv.from + mv.to + (mv.promotion || '');

    // Natürliches Feedback generieren
    return this.generateNaturalFeedback(mv, loss, isBest, chess, ply);
  }

  updatePhase(ply, chess) {
    if (ply <= 10) this.context.phase = 'opening';
    else if (ply <= 20) this.context.phase = 'middlegame-early';
    else if (ply <= 35) this.context.phase = 'middlegame';
    else this.context.phase = 'endgame';
  }

  generateNaturalFeedback(mv, loss, isBest, chess, ply) {
    const feedback = { text: '', kind: 'neutral', shouldSpeak: false };

    // Perfekte Züge
    if (isBest && loss <= 10) {
      feedback.text = this.pickRandom([
        `Ausgezeichnet! Das war genau der beste Zug. Die Figuren sind perfekt positioniert.`,
        `Perfekt! Du hast das Zentrum konsequent gespielt.`,
        `Sehr stark! Dein ${this.pieceName(mv.piece)} greift genau am richtigen Moment an.`
      ]);
      feedback.kind = 'best';
      feedback.shouldSpeak = true;
      return feedback;
    }

    // Gute Züge
    if (loss <= 50) {
      feedback.text = this.pickRandom([
        `Guter Zug! Du hast deine Figuren aktiv eingesetzt.`,
        `Solide Entwicklung. Dein Spiel ist harmonisch.`,
        `Klug gespielt. Du hast die Schwäche des Gegners erkannt.`
      ]);
      feedback.kind = 'good';
      feedback.shouldSpeak = true;
      return feedback;
    }

    // Ungenaue Züge
    if (loss <= 100) {
      const better = `Der ${this.pieceName(mv.piece)} hätte hier ein Tempo verloren.`;
      feedback.text = `Etwas ungenau. ${better} Nächstes Mal noch präziser.`;
      feedback.kind = 'inaccuracy';
      return feedback;
    }

    // Fehler
    if (loss <= 250) {
      feedback.text = `Das war ein Fehler! Dein ${this.pieceName(mv.piece)} steht jetzt nicht gut. Achte auf die gegnerischen Drohungen.`;
      feedback.kind = 'mistake';
      feedback.shouldSpeak = true;
      return feedback;
    }

    // Grobe Blunder
    feedback.text = `Oh, das war ein Blunder! Du hast eine Figur verloren. Nächstes Mal erst zwei Züge vorausdenken.`;
    feedback.kind = 'blunder';
    feedback.shouldSpeak = true;
    return feedback;
  }

  pieceName(type) {
    const names = { p: 'Bauer', n: 'Springer', b: 'Läufer', r: 'Turm', q: 'Dame', k: 'König' };
    return names[type] || 'Figur';
  }

  pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
}
