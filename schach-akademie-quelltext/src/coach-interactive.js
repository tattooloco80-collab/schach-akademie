// Interaktiver Coach mit Sprachausgabe
// Gibt Tipps nach jedem Zug - angenehm, verständlich, nachdenklich anregend

export class InteractiveCoach {
  constructor(engine, speak, store) {
    this.engine = engine;
    this.speak = speak;
    this.store = store;
    this.enabled = store.get('coachTips', true);
    this.isAnalyzing = false;
  }

  toggle() {
    this.enabled = !this.enabled;
    this.store.set('coachTips', this.enabled);
    return this.enabled;
  }

  async analyzeAndSpeak(mv, chess, isHuman) {
    if (!this.enabled || this.isAnalyzing) return;

    this.isAnalyzing = true;

    try {
      // Längere Pause damit vorherige Sprache endet
      await new Promise(r => setTimeout(r, 600));

      // Analysis vom gegnerischen Zug
      const nextMoves = chess.moves({ verbose: true }).slice(0, 3);

      if (!nextMoves.length) {
        // Spiel ist vorbei
        this.isThinking = false;
        return;
      }

      const tip = this.generateTip(mv, chess, nextMoves, isHuman);

      if (tip) {
        // Sprachausgabe - globale Queue in speak() handhabt Synchronisation
        await this.speak(tip, 0.75);  // Viel langsamer für natürlichere Stimme
      }
    } catch (e) {
      console.warn('Coach error:', e);
    } finally {
      this.isAnalyzing = false;
    }
  }

  generateTip(lastMove, chess, nextMoves, wasHumanMove) {
    const ply = chess.history().length;
    const phase = this.getGamePhase(ply);

    // Nach Menschenspiel: Hinweis auf gegnerische Antwort
    if (wasHumanMove) {
      return this.tipAfterHumanMove(lastMove, chess, nextMoves, phase);
    }

    // Nach Computer-Zug: Ermutigung
    return this.tipAfterComputerMove(lastMove, phase);
  }

  tipAfterHumanMove(mv, chess, nextMoves, phase) {
    // Was könnte der Gegner jetzt tun?
    const threats = this.findThreats(chess, nextMoves);

    if (threats.length === 0) {
      return this.pickRandom([
        'Super Zug! Das war wirklich solide. Jetzt denkt der Computer nach...',
        'Ausgezeichnet! Du spielst gut. Der Computer antwortet gleich...',
        'Das war schön gespielt! Lass den Computer denken...',
      ]);
    }

    // Threat vorhanden - Spieler zum Nachdenken anregen
    if (threats.some(t => t.type === 'checkmate')) {
      return this.pickRandom([
        'Vorsicht, das könnte kritisch werden! Der Computer droht ein Matt. Wo ist dein König am sichersten?',
        'Aufgepasst! Es könnte spannend werden. Hast du eine Rettung für deinen König?',
      ]);
    }

    if (threats.some(t => t.type === 'piece-loss')) {
      return this.pickRandom([
        'Moment! Der Computer könnte jetzt deine Figuren angreifen. Welche brauchst du zu schützen?',
        'Vorsicht! Deine Figuren könnten jetzt gefährdet sein. Hast du das im Blick?',
        'Denkpause: Welche deiner Figuren sind ungeschützt? Das ist wichtig!',
      ]);
    }

    if (threats.some(t => t.type === 'center-attack')) {
      return this.pickRandom([
        'Der Computer könnte das Zentrum angreifen. Wie verteidigst du das? Das ist spannend!',
        'Interessant! Der Computer zielt aufs Zentrum. Wie spielst du das am besten?',
      ]);
    }

    // Generischer Tipp
    return this.pickRandom([
      'Das war wirklich schön gespielt! Jetzt denkt der Computer nach...',
      'Super! Lass den Computer denken, was er jetzt macht...',
      'Gut eingeleitet! Was wird die nächste Reaktion sein? Spannend!',
      'Ich mag deinen Zug! Der Computer überlegt sich jetzt die beste Antwort...',
    ]);
  }

  tipAfterComputerMove(mv, phase) {
    // Ermutigung & Strategie-Hinweis - freundlich und fröhlich

    if (phase === 'opening') {
      return this.pickRandom([
        'Der Computer hat gezogen! Jetzt tu dein Bestes – welche Figur entwickelst du als nächstes?',
        'Super Partie! Der Computer antwortet. Wie setzt du deine Entwicklung fort?',
        'Spannend! Der Computer hat gezogen. Kann dein Plan noch aufgehen?',
      ]);
    }

    if (phase === 'middlegame') {
      return this.pickRandom([
        'Der Computer hat gezogen! Jetzt geht es richtig los. Hast du einen Plan?',
        'Spannend wird es! Schau nach Angriffen und Schwächen des Gegners!',
        'Der Computer hat gezogen. Wo sind deine besten Chancen? Schau genau hin!',
        'Interessant! Wie antwortest du jetzt am besten?',
      ]);
    }

    // Endgame
    return this.pickRandom([
      'Im Endspiel zählt jeder Zug! Du kannst das schaffen! Wie geht es weiter?',
      'Der Gegner hat gezogen. Das wird spannend! Wie aktivierst du deine Figuren?',
      'Zeit zu zeigen, was du kannst! Wie spielst du richtig weiter?',
      'Der Computer hat gezogen. Jetzt brauchst du deine beste Taktik!',
    ]);
  }

  findThreats(chess, nextMoves) {
    const threats = [];

    // Schach-Drohung?
    if (nextMoves.some(m => m.san.includes('+'))) {
      threats.push({ type: 'check', san: 'check' });
    }

    // Matt-Drohung?
    if (nextMoves.some(m => m.san.includes('#'))) {
      threats.push({ type: 'checkmate', san: 'mate' });
    }

    // Figur-Angriff?
    const myPieces = this.getMySidePieces(chess, chess.turn() === 'w');
    for (const move of nextMoves.slice(0, 2)) {
      if (myPieces.includes(move.to)) {
        threats.push({ type: 'piece-loss', square: move.to, piece: move.piece });
      }
    }

    // Zentrum-Angriff?
    if (nextMoves.some(m => ['d4', 'd5', 'e4', 'e5'].includes(m.to))) {
      threats.push({ type: 'center-attack', square: 'center' });
    }

    return threats;
  }

  getMySidePieces(chess, isWhite) {
    const board = chess.board();
    const pieces = [];
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const sq = String.fromCharCode(97 + f) + (8 - r);
        const piece = board[r][f];
        if (piece && ((isWhite && piece.color === 'w') || (!isWhite && piece.color === 'b'))) {
          pieces.push(sq);
        }
      }
    }
    return pieces;
  }

  getGamePhase(ply) {
    if (ply <= 10) return 'opening';
    if (ply <= 35) return 'middlegame';
    return 'endgame';
  }

  pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
}
