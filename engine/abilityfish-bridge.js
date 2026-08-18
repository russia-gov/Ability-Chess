/* Browser-facing bridge for the depth-15 Fairy-Stockfish evaluator. */
export class AbilityFishDepth15 {
  constructor(workerUrl = './fairy-depth15-worker.js') {
    this.worker = new Worker(workerUrl);
    this.seq = 0;
    this.pending = new Map();
    this.worker.onmessage = (event) => {
      const msg = event.data || {};
      const p = this.pending.get(msg.id);
      if (!p) return;
      if (msg.type === 'info') {
        p.onInfo?.(msg.info);
      } else if (msg.type === 'abilityinfo') {
        p.onAbilityInfo?.(msg.ability);
      } else if (msg.type === 'result') {
        this.pending.delete(msg.id); p.resolve(msg.result);
      } else if (msg.type === 'error') {
        this.pending.delete(msg.id); p.reject(new Error(msg.error));
      }
    };
  }

  analyzeFen(fen, { depth = 15, multiPV = 3, onInfo, onAbilityInfo } = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onInfo, onAbilityInfo });
      this.worker.postMessage({ id, fen, depth, multiPV });
    });
  }

  stop() { this.worker.postMessage({ type: 'stop' }); }
  terminate() { this.worker.terminate(); this.pending.clear(); }
}

export function abilityStateBoardToFen(state) {
  const rows = [];
  for (let r = 0; r < 8; r++) {
    let row = '', empty = 0;
    for (let c = 0; c < 8; c++) {
      const p = state.board?.[r]?.[c] || null;
      if (!p) { empty++; continue; }
      if (empty) { row += empty; empty = 0; }
      const color = p[0], type = p[1];
      row += color === 'w' ? type.toUpperCase() : type;
    }
    if (empty) row += empty;
    rows.push(row);
  }
  const turn = state.turn === 'b' ? 'b' : 'w';
  let castling = '';
  if (state.castlingRights?.w?.k) castling += 'K';
  if (state.castlingRights?.w?.q) castling += 'Q';
  if (state.castlingRights?.b?.k) castling += 'k';
  if (state.castlingRights?.b?.q) castling += 'q';
  if (!castling) castling = '-';
  const ep = state.enPassant?.r != null ? squareName(state.enPassant.r, state.enPassant.c) : '-';
  return `${rows.join('/')} ${turn} ${castling} ${ep} 0 1`;
}

function squareName(r,c) {
  return String.fromCharCode(97 + c) + String(8 - r);
}
