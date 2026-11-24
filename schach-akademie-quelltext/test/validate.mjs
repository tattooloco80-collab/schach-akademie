import { Chess } from 'chess.js';
import { LESSONS } from '../src/lessons.js';
let bad = 0;
for (const l of LESSONS) {
  let c;
  try { c = l.fen ? new Chess(l.fen) : new Chess(); } catch (e) { console.log('FEN-FEHLER', l.id, e.message); bad++; continue; }
  let ok = true;
  l.moves.forEach((m, i) => { if (!ok) return; try { c.move(m); } catch (e) { console.log('ILLEGAL', l.id, 'Zug', i, m); ok = false; bad++; } });
  if (ok && l.moves.length) {
    const last = l.moves[l.moves.length - 1];
    if (last.endsWith('#') && !c.isCheckmate()) { console.log('KEIN MATT', l.id); bad++; }
  }
  if (ok) for (const k of Object.keys(l.notes || {})) if (+k >= l.moves.length) { console.log('NOTE ausserhalb', l.id, k); bad++; }
  if (ok) for (const k of (l.ask || [])) if (k >= l.moves.length) { console.log('ASK ausserhalb', l.id, k); bad++; }
}
console.log(LESSONS.length, 'Lektionen,', bad, 'Fehler');
