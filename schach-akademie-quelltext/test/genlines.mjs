import { Chess } from 'chess.js';
import { chooseMove } from '../src/engine.js';
function line(fen, ms=250, maxPly=60){
  const c=new Chess(fen); const san=[]; const uci=[];
  while(!c.isGameOver() && san.length<maxPly){
    const r=chooseMove({fen, moves:uci, level:7, timeMs:ms});
    const m=c.move({from:r.uci.slice(0,2),to:r.uci.slice(2,4),promotion:r.uci[4]});
    san.push(m.san); uci.push(r.uci);
  }
  return {san:san.join(' '), n:san.length, mate:c.isCheckmate()};
}
console.log('KD', JSON.stringify(line('8/8/8/3k4/8/8/8/Q3K3 w - - 0 1')));
