/* AbilityFish depth-15 browser worker backed by the custom interactive
 * Fairy-Stockfish WASM build produced by build-abilityfish.yml.
 */
const ENGINE_JS = './abilityfish-stockfish.js';
const ENGINE_WASM = './abilityfish-stockfish.wasm';
const ENGINE_WORKER = './abilityfish-stockfish.worker.js';

self.Module = self.Module || {};
self.Module.locateFile = locateEngineFile;
importScripts(ENGINE_JS);

let enginePromise = null;
let active = null;

function locateEngineFile(path) {
  if (path.endsWith('.wasm')) return ENGINE_WASM;
  if (path.endsWith('.worker.js')) return ENGINE_WORKER;
  return path;
}

function getEngine() {
  if (!enginePromise) {
    enginePromise = Promise.resolve(
      typeof Stockfish === 'function'
        ? Stockfish({ locateFile: locateEngineFile })
        : Promise.reject(new Error('Custom AbilityFish WASM module did not load'))
    ).then((engine) => {
      engine.postMessage('uci');
      return engine;
    });
  }
  return enginePromise;
}

function parseInfo(line) {
  const info = { raw: line };
  let m = line.match(/\bdepth\s+(\d+)/); if (m) info.depth = Number(m[1]);
  m = line.match(/\bnodes\s+(\d+)/); if (m) info.nodes = Number(m[1]);
  m = line.match(/\bnps\s+(\d+)/); if (m) info.nps = Number(m[1]);
  m = line.match(/\bscore\s+(cp|mate)\s+(-?\d+)/);
  if (m) info.score = { type: m[1], value: Number(m[2]) };
  m = line.match(/\bpv\s+(.+)$/); if (m) info.pv = m[1].trim().split(/\s+/);
  m = line.match(/\bmultipv\s+(\d+)/); if (m) info.multipv = Number(m[1]);
  return info;
}

function decodeAbilityAction(packed) {
  const v = packed >>> 0;
  return {
    kind: v & 0x1f,
    from: (v >>> 5) & 0x7f,
    to: (v >>> 12) & 0x7f,
    aux: (v >>> 19) & 0x3f,
    flags: (v >>> 25) & 0x7f
  };
}

const int = (v, d = 0) => Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : d;
const bit = (v) => v ? 1 : 0;
const sideName = (v) => v === 'b' || v === 1 || v === 'black' ? 'b' : 'w';
function sq(v) {
  if (v == null) return 64;
  if (typeof v === 'number') return Math.max(0, Math.min(64, int(v, 64)));
  if (typeof v === 'string' && /^[a-h][1-8]$/i.test(v)) {
    return (Number(v[1]) - 1) * 8 + (v.toLowerCase().charCodeAt(0) - 97);
  }
  if (typeof v === 'object') {
    if (v.index != null) return sq(v.index);
    if (v.r != null && v.c != null) return Math.max(0, Math.min(63, (7 - int(v.r)) * 8 + int(v.c)));
  }
  return 64;
}

function sideEntry(value, side) {
  if (Array.isArray(value)) return value[side === 'w' ? 0 : 1] || null;
  if (!value || typeof value !== 'object') return null;
  return value[side] ?? value[side === 'w' ? 'white' : 'black'] ?? value[side === 'w' ? 0 : 1] ?? null;
}

function timedCommand(kind, side, value) {
  const entry = sideEntry(value, side);
  if (!entry) return null;
  const square = sq(entry.square ?? entry.sq ?? entry.index ?? entry);
  const turns = int(entry.ownerTurnsRemaining ?? entry.turnsRemaining ?? entry.turns ?? 0);
  const activeFlag = entry.active == null ? square < 64 : Boolean(entry.active);
  return `abilitytimed ${kind} ${side} ${square} ${turns} ${bit(activeFlag)}`;
}

function lastMoveCommand(side, value) {
  const entry = sideEntry(value, side);
  if (!entry) return null;
  return `abilitylastmove ${side} ${sq(entry.from)} ${sq(entry.to)} ${int(entry.pieceCode ?? entry.code ?? 0)} ${bit(entry.valid ?? (entry.from != null && entry.to != null))}`;
}

const UPGRADE_CODE = Object.freeze({
  vanguard:1,
  reverse_gear:2,
  veteran:3,
  lancer:4,
  charger:5,
  cardinal:6,
  color_shift:7,
  archbishop:8,
  bastion:9,
  turret:10,
  chancellor:11,
  phase_step:12,
  royal_step:13,
  escape_route:14
});
const PIECE_TYPE_INDEX = Object.freeze({p:0,n:1,b:2,r:3,q:4,k:5,pawn:0,knight:1,bishop:2,rook:3,queen:4,king:5});

function upgradeCommands(value) {
  const commands=[];
  if (!value || typeof value !== 'object') return commands;
  for (const side of ['w','b']) {
    const sideUpgrades=sideEntry(value,side);
    if (!sideUpgrades || typeof sideUpgrades !== 'object') continue;
    for (const [pieceKey, rawUpgrade] of Object.entries(sideUpgrades)) {
      const typeIndex=PIECE_TYPE_INDEX[String(pieceKey).toLowerCase()];
      if (typeIndex == null) continue;
      const id=typeof rawUpgrade==='string'
        ? rawUpgrade
        : rawUpgrade?.id ?? rawUpgrade?.upgradeId ?? rawUpgrade?.name ?? null;
      const encoded=UPGRADE_CODE[String(id||'').toLowerCase()] || int(rawUpgrade?.encoded ?? rawUpgrade?.code ?? 0);
      if (encoded>=0 && encoded<=14) commands.push(`abilityupgrade ${side} ${typeIndex} ${encoded}`);
    }
  }
  return commands;
}

function abilityCommands(job) {
  const state = job.abilityState || {};
  const commands = ['abilityfish on'];
  commands.push(`abilitypoints ${Math.max(0, int(state.whitePoints ?? state.points?.w ?? 0))} ${Math.max(0, int(state.blackPoints ?? state.points?.b ?? 0))}`);
  commands.push(`abilityturn ${sideName(state.turn)} ${Math.max(0, int(state.boardMovesRemaining, 1))} ${bit(state.doubleMoveActive)} ${bit(state.beganTurnInCheck)}`);

  const used = state.abilityUsedThisTurn ?? state.abilityUsed ?? {};
  commands.push(`abilityused ${bit(sideEntry(used, 'w'))} ${bit(sideEntry(used, 'b'))}`);
  commands.push(`abilityflags ${bit(state.abilitiesEnabled ?? true)} ${bit(state.upgradesEnabled ?? true)} ${Math.max(0, int(state.upgradeLimit, 3))}`);

  for (const side of ['w', 'b']) {
    for (const [kind, value] of [['shield', state.shields ?? state.shield], ['freeze', state.frozen ?? state.frozenEnemy], ['ambush', state.ambushes ?? state.ambush]]) {
      const cmd = timedCommand(kind, side, value); if (cmd) commands.push(cmd);
    }
    const lm = lastMoveCommand(side, state.lastMove ?? state.lastMoves); if (lm) commands.push(lm);
    const fort = sideEntry(state.fortify ?? state.fortifications, side);
    if (fort) {
      const squares = fort.squares || [];
      commands.push(`abilityfortify ${side} ${sq(squares[0])} ${sq(squares[1])} ${sq(squares[2])} ${sq(squares[3])} ${int(fort.ownerTurnsRemaining ?? fort.turnsRemaining ?? fort.turns ?? 0)} ${bit(fort.active ?? true)}`);
    }
  }

  const portalsValue=state.portals;
  if (Array.isArray(portalsValue)) {
    for (let i = 0; i < Math.min(2, portalsValue.length); i++) {
      const p = portalsValue[i] || {};
      commands.push(`abilityportal ${i} ${sq(p.a)} ${sq(p.b)} ${sideName(p.owner)} ${int(p.ownerTurnsRemaining ?? p.turnsRemaining ?? p.turns ?? 0)} ${bit(p.active ?? true)}`);
    }
  } else if (portalsValue && typeof portalsValue==='object') {
    let i=0;
    for (const side of ['w','b']) {
      const p=sideEntry(portalsValue,side);
      if (!p || i>=2) continue;
      commands.push(`abilityportal ${i++} ${sq(p.a)} ${sq(p.b)} ${side} ${int(p.ownerTurnsRemaining ?? p.turnsRemaining ?? p.turns ?? 0)} ${bit(p.active ?? true)}`);
    }
  }

  commands.push(...upgradeCommands(state.upgrades));
  return commands;
}

async function analyze(job) {
  const engine = await getEngine();
  if (active) {
    try { engine.postMessage('stop'); } catch {}
    active.reject(new Error('Superseded by a newer AbilityFish search'));
    active = null;
  }

  return new Promise((resolve, reject) => {
    const lines = new Map();
    let bestAbilityAction = null;
    const requestedDepth = Math.max(1, Math.min(40, Number(job.depth || 15)));
    // Three lines are useful for the quick pass, but MultiPV makes deep browser
    // searches dramatically more expensive. Refine only the best line above d5.
    const defaultMultiPV = requestedDepth > 5 ? 1 : 3;
    const multiPV = Math.max(1, Math.min(8, Number(job.multiPV ?? defaultMultiPV)));
    // Browser refinement is a responsiveness feature, not a benchmark. Put a
    // ceiling on deep searches and report the depth actually completed.
    const defaultTimeMs = requestedDepth >= 15 ? 9000 : requestedDepth >= 10 ? 4000 : 0;
    const maxTimeMs = Math.max(0, Math.min(30000, Number(job.maxTimeMs ?? defaultTimeMs)));
    const listener = (line) => {
      if (typeof line !== 'string') return;
      if (line.startsWith('info string abilityaction ')) {
        const m = line.match(/^info string abilityaction\s+(\d+)(?:\s+score\s+(cp|mate)\s+(-?\d+))?(?:\s+depth\s+(\d+))?/);
        if (m) {
          bestAbilityAction = {
            packed: Number(m[1]),
            action: decodeAbilityAction(Number(m[1])),
            score: m[2] ? { type: m[2], value: Number(m[3]) } : null,
            depth: m[4] ? Number(m[4]) : null
          };
          self.postMessage({ id: job.id, type: 'abilityinfo', ability: bestAbilityAction });
        }
        return;
      }
      if (line.startsWith('info ')) {
        const info = parseInfo(line);
        const key = info.multipv || 1;
        if (info.pv?.length) lines.set(key, info);
        self.postMessage({ id: job.id, type: 'info', info });
        return;
      }
      if (line.startsWith('bestmove ')) {
        cleanup();
        const bestmove = line.split(/\s+/)[1] || null;
        const ordered = [...lines.entries()].sort((a,b)=>a[0]-b[0]).map(([,v])=>v);
        const achievedDepth = Number(ordered[0]?.depth || bestAbilityAction?.depth || 0);
        resolve({
          bestmove: bestmove === '0000' && bestAbilityAction ? null : bestmove,
          abilityAction: bestAbilityAction,
          depth: achievedDepth,
          requestedDepth,
          capped: maxTimeMs > 0 && achievedDepth < requestedDepth,
          lines: ordered
        });
      }
    };
    const cleanup = () => {
      try { engine.removeMessageListener?.(listener); } catch {}
      if (active?.id === job.id) active = null;
    };
    active = { id: job.id, reject, cleanup };
    engine.addMessageListener(listener);
    try {
      engine.postMessage('setoption name UCI_Variant value chess');
      engine.postMessage(`setoption name MultiPV value ${multiPV}`);
      engine.postMessage('isready');
      engine.postMessage(job.fen === 'startpos' ? 'position startpos' : `position fen ${job.fen}`);
      for (const command of abilityCommands(job)) engine.postMessage(command);
      engine.postMessage(maxTimeMs > 0
        ? `go depth ${requestedDepth} movetime ${maxTimeMs}`
        : `go depth ${requestedDepth}`);
    } catch (err) {
      cleanup(); reject(err);
    }
  });
}

self.onmessage = async (event) => {
  const job = event.data || {};
  if (job.type === 'stop') {
    try { (await getEngine()).postMessage('stop'); } catch {}
    return;
  }
  try {
    if (!job.fen) throw new Error('Missing FEN');
    const result = await analyze(job);
    self.postMessage({ id: job.id, type: 'result', result });
  } catch (error) {
    self.postMessage({ id: job.id, type: 'error', error: String(error?.stack || error) });
  }
};
