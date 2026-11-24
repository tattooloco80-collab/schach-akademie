import { chooseMove } from './engine.js';
self.onmessage = (e) => {
  let r; try { r = chooseMove(e.data); } catch (err) { r = { uci: null, error: String(err) }; }
  self.postMessage({ id: e.data.id, ...r });
};
